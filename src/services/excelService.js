const XLSX = require('xlsx-js-style');

/**
 * Generates a polished, styled Excel buffer with BMU branding & status color badges.
 */
const generateRequestsExcel = (requests) => {
  const headers = [
    'S.NO',
    'NAME',
    'BMU EMAIL',
    'MOB.NO (IF GIVEN)',
    'STATUS',
    'ASSIGNED LOGIN EMAIL',
    'GENERATED PASSWORD',
    'REQUEST DATE'
  ];

  // Header Styling (Dark BMU Navy with bold white text)
  const headerStyle = {
    fill: { fgColor: { rgb: '131D35' } },
    font: { name: 'Arial', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: 'D6DEEC' } },
      bottom: { style: 'medium', color: { rgb: '118A5E' } },
      left: { style: 'thin', color: { rgb: 'D6DEEC' } },
      right: { style: 'thin', color: { rgb: 'D6DEEC' } }
    }
  };

  // Base Cell Styling
  const baseCellStyle = {
    font: { name: 'Arial', sz: 10 },
    alignment: { vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: 'E2E8F0' } },
      bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
      left: { style: 'thin', color: { rgb: 'E2E8F0' } },
      right: { style: 'thin', color: { rgb: 'E2E8F0' } }
    }
  };

  // Build matrix
  const data = [headers];

  requests.forEach((r, idx) => {
    data.push([
      idx + 1,
      r.name,
      r.bmuEmail,
      r.mobile || 'N/A',
      r.status.toUpperCase(),
      r.provisionedEmail || '—',
      r.temporaryPassword || '—',
      new Date(r.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(data);

  // Column Widths
  ws['!cols'] = [
    { wch: 7 },   // S.NO
    { wch: 24 },  // NAME
    { wch: 32 },  // BMU EMAIL
    { wch: 18 },  // MOB.NO
    { wch: 16 },  // STATUS
    { wch: 30 },  // LOGIN EMAIL
    { wch: 24 },  // PASSWORD
    { wch: 22 }   // DATE
  ];

  // Apply Styles Row by Row
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[cellRef]) continue;

      if (R === 0) {
        // Headers
        ws[cellRef].s = headerStyle;
      } else {
        // Data Rows
        const isStatusCol = C === 4;
        const statusVal = ws[cellRef].v;

        if (isStatusCol) {
          if (statusVal === 'APPROVED') {
            // Soft Green Badge
            ws[cellRef].s = {
              ...baseCellStyle,
              fill: { fgColor: { rgb: 'E2F7EE' } },
              font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '0F6E4C' } },
              alignment: { horizontal: 'center', vertical: 'center' }
            };
          } else {
            // Soft Orange / Amber Badge
            ws[cellRef].s = {
              ...baseCellStyle,
              fill: { fgColor: { rgb: 'FEF3D6' } },
              font: { name: 'Arial', sz: 10, bold: true, color: { rgb: 'B45309' } },
              alignment: { horizontal: 'center', vertical: 'center' }
            };
          }
        } else {
          ws[cellRef].s = {
            ...baseCellStyle,
            alignment: {
              horizontal: C === 0 ? 'center' : 'left',
              vertical: 'center'
            }
          };
        }
      }
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Day_Scholar_Roster');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
};

module.exports = { generateRequestsExcel };