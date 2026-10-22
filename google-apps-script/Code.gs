const SHEET_NAME = 'records';

function sheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  return spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);
}

function doGet() {
  const target = sheet();
  if (target.getLastRow() === 0) target.appendRow(['timestamp', 'name', 'finishTime']);
  const rows = target.getLastRow() < 2 ? [] : target.getRange(2, 1, target.getLastRow() - 1, 3).getValues();
  const records = rows.map(row => ({ name: row[1], finishTime: row[2] }))
    .sort((a, b) => seconds(a.finishTime) - seconds(b.finishTime)).slice(0, 3);
  return ContentService.createTextOutput(JSON.stringify(records)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const target = sheet();
  if (target.getLastRow() === 0) target.appendRow(['timestamp', 'name', 'finishTime']);
  target.appendRow([new Date(), String(data.name).slice(0, 30), data.finishTime]);
  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}

function seconds(value) {
  const parts = String(value).split(':').map(Number);
  return (parts[0] || 0) * 60 + (parts[1] || 0);
}
