// ---------------------------------------------------------------------------
// Mistral AI Service
//
// Uses Mistral to generate intelligent, data-grounded analysis for a selected
// district and crop combination.
// ---------------------------------------------------------------------------

const MISTRAL_API_URL = '/api/mistral/v1/chat/completions';
const MISTRAL_MODEL = 'mistral-small-latest';

export interface MistralAnalysis {
  summary: string;
  strengths: string[];
  concerns: string[];
  recommendations: string[];
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

function buildPrompt(input: DistrictAnalysisInput): string {
  const yieldVsNational = input.nationalAvgYield > 0
    ? ((input.yieldPerHa - input.nationalAvgYield) / input.nationalAvgYield * 100).toFixed(1)
    : '0';

  const yoyChange = input.previousYearProduction && input.previousYearProduction > 0
    ? ((input.production - input.previousYearProduction) / input.previousYearProduction * 100).toFixed(1)
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
  "summary": "2-3 sentence overall assessment of this district's agricultural performance for this crop",
  "strengths": ["strength 1", "strength 2"],
  "concerns": ["concern 1", "concern 2"],
  "recommendations": ["recommendation 1", "recommendation 2", "recommendation 3"]
}

Keep each item concise (1 sentence). Base analysis on the data provided. Consider Rwanda-specific factors like seasonal rainfall patterns, hillside farming, and smallholder agriculture.`;
}

export async function analyzeDistrict(input: DistrictAnalysisInput): Promise<MistralAnalysis> {
  const apiKey = import.meta.env.VITE_MISTRAL_API_KEY;
  if (!apiKey) throw new Error('Mistral API key not configured');

  const response = await fetch(MISTRAL_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MISTRAL_MODEL,
      messages: [
        {
          role: 'user',
          content: buildPrompt(input),
        },
      ],
      temperature: 0.3,
      max_tokens: 600,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Mistral API error ${response.status}: ${err}`);
  }

  const data = await response.json() as {
    choices: { message: { content: string } }[];
  };

  const content = data.choices[0]?.message?.content ?? '';

  // Strip markdown fences if model wraps JSON
  const cleaned = content.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();

  try {
    return JSON.parse(cleaned) as MistralAnalysis;
  } catch {
    // Fallback: extract JSON object from response
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as MistralAnalysis;
    throw new Error('Could not parse Mistral response as JSON');
  }
}
