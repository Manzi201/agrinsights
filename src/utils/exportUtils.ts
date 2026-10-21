import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { DataPoint } from '../types/agriculture';
import { getDistrictById, getCropById } from '../services/agricultureData';

/** Export an array of objects to a CSV file and trigger download. */
export function exportToCSV(
  rows: Record<string, string | number>[],
  filename: string,
): void {
  if (rows.length === 0) return;

  const headers = Object.keys(rows[0]);
  const csvLines: string[] = [headers.join(',')];

  for (const row of rows) {
    const values = headers.map((header) => {
      const val = row[header];
      const str = String(val ?? '');
      // Escape quotes and commas
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
    csvLines.push(values.join(','));
  }

  const csvContent = csvLines.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Convert data points to CSV-friendly rows. */
export function dataPointsToCSVRows(data: DataPoint[]): Record<string, string | number>[] {
  return data.map((dp) => {
    const district = getDistrictById(dp.districtId);
    const crop = getCropById(dp.cropId);
    return {
      District: district?.name ?? dp.districtId,
      Province: district?.province ?? '',
      Crop: crop?.name ?? dp.cropId,
      Season: dp.season,
      Year: dp.year,
      'Production (tons)': dp.production,
      'Area (hectares)': dp.area,
      'Yield (tons/ha)': dp.yieldPerHa,
    };
  });
}

/**
 * Capture a DOM element and export it as a PDF.
 * The element should contain the report content (charts, tables, etc.).
 */
export async function exportElementToPDF(
  element: HTMLElement,
  filename: string,
): Promise<void> {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position -= pageHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(filename);
}

/**
 * Generate a simple text-based PDF report (no html2canvas needed).
 */
export function exportReportToPDF(
  title: string,
  summaryLines: string[],
  tableHeaders: string[],
  tableRows: string[][],
  filename: string,
): void {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  let y = 20;

  // Title
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.text(title, 14, y);
  y += 10;

  // Date
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, 14, y);
  y += 12;

  // Summary lines
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');
  for (const line of summaryLines) {
    if (y > 270) {
      pdf.addPage();
      y = 20;
    }
    pdf.text(line, 14, y);
    y += 7;
  }
  y += 5;

  // Table
  if (tableRows.length > 0) {
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');

    const colWidth = (pageWidth - 28) / tableHeaders.length;
    pdf.setFillColor(22, 163, 74);
    pdf.rect(14, y - 5, pageWidth - 28, 8, 'F');
    pdf.setTextColor(255, 255, 255);

    tableHeaders.forEach((header, i) => {
      pdf.text(header, 14 + i * colWidth, y);
    });
    y += 8;

    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(0, 0, 0);

    for (const row of tableRows) {
      if (y > 280) {
        pdf.addPage();
        y = 20;
      }
      row.forEach((cell, i) => {
        const cellText = cell.length > 20 ? cell.substring(0, 18) + '..' : cell;
        pdf.text(cellText, 14 + i * colWidth, y);
      });
      y += 6;
    }
  }

  pdf.save(filename);
}
