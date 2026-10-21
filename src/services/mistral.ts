// ---------------------------------------------------------------------------
// Mistral AI Service
//
// Uses Mistral to generate intelligent, data-grounded analysis for a selected
// district and crop combination.
// On 429 rate-limit: retries with exponential backoff up to 3 times,
// then falls back to a local data-driven analysis so users always get a result.
// ---------------------------------------------------------------------------

const MISTRAL_API_URL = '/api/mistral/v1/chat/completions';
const MISTRAL_MODEL = 'mistral-small-latest';

export interface MistralAnalysis {
  summary: string;
  strengths: string[];
  concerns: string[];
  recommendations: string[];
  isFallback?: boolean; // true when generated locally instead of via API
}

export interface DistrictAnalysisInput {
  districtName: string;
  province: string;
  cropName: string;
  season: string;
  year: number;
  production: number;
  area: number;
  yieldPerHa: number;
  nationalAvgYield: number;
  previousYearProduction?: number;
  topDistrict?: { name: string; production: number };
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------
function buildPrompt(input: DistrictAnalysisInput): string {
  const yieldVsNational =
    input.nationalAvgYield > 0
      ? (((input.yieldPerHa - input.nationalAvgYield) / input.nationalAvgYield) * 100).toFixed(1)
      : '0';

  const yoyChange =
    input.previousYearProduction && input.previousYearProduction > 0
      ? (((input.production - input.previousYearProduction) / input.previousYearProduction) * 100).toFixed(1)
      : null;

  return `You are an agricultural analyst for Rwanda. Analyze the following agricultural data for a specific district and provide actionable insights.

## District Data
- **District:** ${input.districtName} (${input.province} Province)
- **Crop:** ${input.cropName}
- **Season:** Season ${input.season}, Year ${input.year}
- **Production:** ${input.production.toLocaleString()} tons
- **Cultivated Area:** ${input.area.toLocaleString()} hectares
- **Yield:** ${input.yieldPerHa} t/ha
- **National average yield for this crop:** ${input.nationalAvgYield} t/ha
- **Yield vs national average:** ${Number(yieldVsNational) > 0 ? '+' : ''}${yieldVsNational}%
${yoyChange !== null ? `- **Year-over-year production change:** ${Number(yoyChange) > 0 ? '+' : ''}${yoyChange}%` : ''}
${input.topDistrict ? `- **Top producing district nationally:** ${input.topDistrict.name} (${input.topDistrict.production.toLocaleString()} t)` : ''}

## Instructions
Respond ONLY with valid JSON in this exact format (no markdown, no explanation outside JSON):
{
  "summary": "2-3 sentence overall assessment",
  "strengths": ["strength 1", "strength 2"],
  "concerns": ["concern 1", "concern 2"],
  "recommendations": ["recommendation 1", "recommendation 2", "recommendation 3"]
}

Keep each item concise (1 sentence). Base analysis strictly on the data above. Consider Rwanda-specific factors: seasonal rainfall, hillside farming, smallholder agriculture.`;
}

// ---------------------------------------------------------------------------
// Local fallback — deterministic analysis from the numbers, no API needed
// ---------------------------------------------------------------------------
export function buildLocalAnalysis(input: DistrictAnalysisInput): MistralAnalysis {
  const yieldRatio =
    input.nationalAvgYield > 0 ? input.yieldPerHa / input.nationalAvgYield : 1;
  const yoyPct =
    input.previousYearProduction && input.previousYearProduction > 0
      ? ((input.production - input.previousYearProduction) / input.previousYearProduction) * 100
      : 0;

  const yieldLabel =
    yieldRatio >= 1.15
      ? 'significantly above average'
      : yieldRatio >= 1.0
      ? 'above average'
      : yieldRatio >= 0.85
      ? 'slightly below average'
      : 'well below average';

  const trendLabel =
    yoyPct > 5 ? 'improving' : yoyPct < -5 ? 'declining' : 'stable';

  const summary =
    `${input.districtName} (${input.province} Province) achieved ${input.yieldPerHa} t/ha for ${input.cropName} in Season ${input.season} ${input.year}, which is ${yieldLabel} compared to the national average of ${input.nationalAvgYield} t/ha. ` +
    `Total production was ${input.production.toLocaleString()} tons from ${input.area.toLocaleString()} hectares, with a ${trendLabel} year-over-year trend (${yoyPct >= 0 ? '+' : ''}${yoyPct.toFixed(1)}%).`;

  const strengths: string[] = [];
  const concerns: string[] = [];
  const recommendations: string[] = [];

  if (yieldRatio >= 1.0) {
    strengths.push(`Yield of ${input.yieldPerHa} t/ha is ${((yieldRatio - 1) * 100).toFixed(0)}% above the national average, indicating good farming practices or favourable conditions.`);
  }
  if (yoyPct > 0) {
    strengths.push(`Year-over-year production increased by ${yoyPct.toFixed(1)}%, showing positive momentum.`);
  }
  if (input.area >= 5000) {
    strengths.push(`A cultivated area of ${input.area.toLocaleString()} ha reflects strong land utilisation in the district.`);
  }

  if (yieldRatio < 0.9) {
    concerns.push(`Yield is ${((1 - yieldRatio) * 100).toFixed(0)}% below the national average, suggesting room for agronomic improvement.`);
  }
  if (yoyPct < -5) {
    concerns.push(`Production declined ${Math.abs(yoyPct).toFixed(1)}% compared to the previous year, which warrants investigation.`);
  }
  if (input.area < 2000) {
    concerns.push(`The cultivated area of ${input.area.toLocaleString()} ha is relatively small, which may limit overall output.`);
  }
  if (concerns.length === 0) {
    concerns.push(`Continued monitoring is needed to sustain current performance, especially during dry spells.`);
  }

  if (yieldRatio < 1.0) {
    recommendations.push(`Promote use of improved seed varieties and targeted fertiliser application to close the yield gap with the national average.`);
  }
  recommendations.push(`Strengthen farmer extension services in ${input.districtName} to share best practices from high-yield districts like ${input.topDistrict?.name ?? 'top performers'}.`);
  if (yoyPct < 0) {
    recommendations.push(`Investigate and address the causes of the ${Math.abs(yoyPct).toFixed(1)}% production decline, including climate factors and input availability.`);
  } else {
    recommendations.push(`Replicate successful Season ${input.season} practices in adjacent seasons and districts to broaden productivity gains.`);
  }
  recommendations.push(`Invest in post-harvest handling and market linkages to ensure farmers capture the value of ${input.cropName} produced.`);

  return {
    summary,
    strengths: strengths.length > 0 ? strengths : [`${input.districtName} contributes meaningfully to national ${input.cropName} production.`],
    concerns,
    recommendations: recommendations.slice(0, 3),
    isFallback: true,
  };
}

// ---------------------------------------------------------------------------
// Retry helper — waits retryAfterMs then retries, up to maxRetries
// ---------------------------------------------------------------------------
async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callMistralWithRetry(
  apiKey: string,
  prompt: string,
  maxRetries = 3,
): Promise<MistralAnalysis> {
  let lastError = '';
  let delayMs = 4000; // start at 4 s

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(MISTRAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MISTRAL_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 600,
      }),
    });

    if (response.ok) {
      const data = (await response.json()) as {
        choices: { message: { content: string } }[];
      };
      const content = data.choices[0]?.message?.content ?? '';
      const cleaned = content
        .replace(/^```(?:json)?\n?/i, '')
        .replace(/\n?```$/i, '')
        .trim();
      try {
        return JSON.parse(cleaned) as MistralAnalysis;
      } catch {
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]) as MistralAnalysis;
        throw new Error('Could not parse Mistral response as JSON');
      }
    }

    // 429 — respect Retry-After header if present, otherwise exponential backoff
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : delayMs;
      lastError = `rate_limited`;
      if (attempt < maxRetries) {
        await sleep(waitMs);
        delayMs = Math.min(delayMs * 2, 30000); // cap at 30 s
        continue;
      }
      throw new RateLimitError(`Rate limit reached after ${maxRetries} retries`);
    }

    // Other error — don't retry
    const body = await response.text();
    throw new Error(`Mistral API error ${response.status}: ${body}`);
  }

  throw new RateLimitError(lastError);
}

// Custom error class so caller can distinguish rate-limit from other errors
export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Analyze a district using Mistral AI.
 * On rate limit (after retries), returns a locally-generated fallback analysis
 * so the UI always shows something useful.
 */
export async function analyzeDistrict(input: DistrictAnalysisInput): Promise<MistralAnalysis> {
  const apiKey = import.meta.env.VITE_MISTRAL_API_KEY;
  if (!apiKey) {
    // No key configured — return local analysis immediately
    return buildLocalAnalysis(input);
  }

  try {
    return await callMistralWithRetry(apiKey, buildPrompt(input));
  } catch (err) {
    if (err instanceof RateLimitError) {
      // Rate limited after all retries — silently fall back to local analysis
      return buildLocalAnalysis(input);
    }
    throw err;
  }
}
