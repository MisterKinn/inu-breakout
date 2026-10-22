const SHEET_NAME = 'records';

function sheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  return spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);
}

function doGet() {
  const target = sheet();
  if (target.getLastRow() === 0) target.appendRow(['timestamp', 'name', 'finishTime']);
  const rows = target.getLastRow() < 2 ? [] : target.getRange(2, 1, target.getLastRow() - 1, 3).getDisplayValues();
  const records = rows.map(row => ({ name: row[1], finishTime: row[2] }))
    .sort((a, b) => seconds(a.finishTime) - seconds(b.finishTime)).slice(0, 3);
  return ContentService.createTextOutput(JSON.stringify(records)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const target = sheet();
  if (data.action === 'cleanupTestRecords') {
    let removed = 0;
    for (let row = target.getLastRow(); row >= 2; row -= 1) {
      const name = String(target.getRange(row, 2).getValue());
      const testNames = ['undefined', '모바일', 'mobile', '모바일검증', '자동검증', '효과검증', '테스트모드검증', '배경음검증'];
      if (name.startsWith('연결검증-') || testNames.includes(name)) {
        target.deleteRow(row);
        removed += 1;
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ ok: true, removed })).setMimeType(ContentService.MimeType.JSON);
  }
  if (target.getLastRow() === 0) target.appendRow(['timestamp', 'name', 'finishTime']);
  target.appendRow([new Date(), String(data.name).slice(0, 30), '']);
  target.getRange(target.getLastRow(), 3).setNumberFormat('@').setValue(String(data.finishTime));
  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}

function seconds(value) {
  const parts = String(value).split(':').map(Number);
  return (parts[0] || 0) * 60 + (parts[1] || 0);
}
