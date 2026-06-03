import * as XLSX from 'xlsx';

export function exportToExcel(filename: string, sheets: Record<string, Array<Record<string, unknown>>>) {
  const wb = XLSX.utils.book_new();
  for (const [sheetName, rows] of Object.entries(sheets)) {
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));
  }
  const date = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `${filename}_${date}.xlsx`);
}
