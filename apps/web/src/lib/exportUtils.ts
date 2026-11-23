/**
 * Avora Bank Institutional Data Export & Compliance Reporting Utilities
 * Supports Excel-compatible UTF-8 CSV, structured JSON, and Printable / Save-as-PDF layouts.
 */

export interface ExportColumn<T> {
  label: string;
  key?: keyof T | string;
  format?: (row: T) => string | number | null | undefined;
}

/**
 * Cleanly format any cell value for CSV formatting.
 * Properly handles quotes, commas, newlines, and objects.
 */
function sanitizeCsvCell(val: any): string {
  if (val === null || val === undefined) return '""';
  if (typeof val === 'object') {
    if (val instanceof Date) {
      return `"${val.toISOString()}"`;
    }
    try {
      return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
    } catch {
      return '""';
    }
  }
  const str = String(val);
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Export tabular data as a clean CSV file with UTF-8 BOM for Microsoft Excel & Google Sheets compatibility.
 */
export function exportToCsv<T>(
  filename: string,
  rows: T[],
  columns: ExportColumn<T>[]
): void {
  if (!rows || rows.length === 0) {
    alert('No data records available to export for the selected filter.');
    return;
  }

  // Header row
  const headerLine = columns.map((c) => sanitizeCsvCell(c.label)).join(',');

  // Data rows
  const dataLines = rows.map((row) => {
    return columns
      .map((col) => {
        let val: any;
        if (col.format) {
          val = col.format(row);
        } else if (col.key && typeof col.key === 'string' && col.key in (row as any)) {
          val = (row as any)[col.key];
        } else {
          val = '';
        }
        return sanitizeCsvCell(val);
      })
      .join(',');
  });

  // Prepend UTF-8 Byte Order Mark (\uFEFF) so Excel respects UTF-8 symbols and currency characters
  const csvContent = '\uFEFF' + [headerLine, ...dataLines].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const cleanFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', cleanFilename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export structured data as an audited JSON file.
 */
export function exportToJson(filename: string, data: any): void {
  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const cleanFilename = filename.endsWith('.json') ? filename : `${filename}.json`;
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', cleanFilename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Opens an institutional Avora Bank compliance print/save-to-PDF report view in a popup window.
 */
export function printReportTable<T>(params: {
  title: string;
  subtitle?: string;
  dateRangeText?: string;
  columns: ExportColumn<T>[];
  rows: T[];
  footerSummary?: string;
}): void {
  const { title, subtitle, dateRangeText, columns, rows, footerSummary } = params;

  if (!rows || rows.length === 0) {
    alert('No data records available to print for the selected filter.');
    return;
  }

  const printWindow = window.open('', '_blank', 'width=1100,height=800');
  if (!printWindow) {
    alert('Please allow popups to view and print this compliance report.');
    return;
  }

  const generatedDate = new Date().toUTCString();

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title} — Avora Bank Institutional Report</title>
  <style>
    @media print {
      body { margin: 15mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 24px;
      font-size: 11px;
      line-height: 1.4;
    }
    .header {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .brand { font-size: 18px; font-weight: 900; letter-spacing: -0.5px; color: #0f172a; }
    .brand span { color: #059669; }
    .title { font-size: 14px; font-weight: 800; margin-top: 4px; color: #1e293b; }
    .subtitle { font-size: 11px; color: #64748b; margin-top: 2px; }
    .meta-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 8px 12px;
      font-size: 10px;
      color: #475569;
      margin-bottom: 14px;
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
    }
    th {
      background: #f1f5f9;
      color: #334155;
      font-weight: 700;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1.5px solid #cbd5e1;
      border-top: 1px solid #e2e8f0;
      padding: 6px 8px;
      text-align: left;
    }
    td {
      padding: 6px 8px;
      border-bottom: 1px solid #f1f5f9;
      color: #1e293b;
      vertical-align: top;
    }
    tr:nth-child(even) { background-color: #fbfcfd; }
    .footer {
      margin-top: 24px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
      font-size: 9px;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .print-btn-bar {
      margin-bottom: 16px;
      display: flex;
      gap: 8px;
    }
    .btn {
      background: #0f172a;
      color: white;
      border: none;
      padding: 6px 14px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 11px;
      cursor: pointer;
    }
    .btn:hover { background: #334155; }
  </style>
</head>
<body>
  <div class="print-btn-bar no-print">
    <button class="btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
    <button class="btn" onclick="window.close()" style="background: #e2e8f0; color: #334155;">Close</button>
  </div>

  <div class="header">
    <div>
      <div class="brand">AVORA <span>BANK</span></div>
      <div class="title">${title}</div>
      ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ''}
    </div>
    <div style="text-align: right; font-size: 10px; color: #64748b;">
      <div><strong>Institutional Core Report</strong></div>
      <div>Confidential &amp; Audited</div>
    </div>
  </div>

  <div class="meta-box">
    <div><strong>Period Filter:</strong> ${dateRangeText || 'All Recorded Time'}</div>
    <div><strong>Total Records:</strong> ${rows.length.toLocaleString()}</div>
    <div><strong>Generated At:</strong> ${generatedDate}</div>
  </div>

  <table>
    <thead>
      <tr>
        ${columns.map((c) => `<th>${c.label}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${rows
        .map(
          (row) => `
        <tr>
          ${columns
            .map((col) => {
              let val = '';
              if (col.format) val = String(col.format(row) ?? '');
              else if (col.key && col.key in (row as any)) val = String((row as any)[col.key] ?? '');
              return `<td>${val || '—'}</td>`;
            })
            .join('')}
        </tr>`
        )
        .join('')}
    </tbody>
  </table>

  ${footerSummary ? `<div style="margin-top: 12px; font-weight: 700; font-size: 11px; text-align: right; color: #0f172a;">${footerSummary}</div>` : ''}

  <div class="footer">
    <div>Avora Bank Digital Treasury &amp; Core Ledger Platform • Compliance Document</div>
    <div>Page 1 of 1</div>
  </div>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
