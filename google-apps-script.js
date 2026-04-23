// ════════════════════════════════════════════════════════════════════
// Mecka AI — China Inventory · Google Apps Script v2
// Supports: Inventory, Orders, Log
// ════════════════════════════════════════════════════════════════════
//
// SETUP:
// 1. Google Sheet → Extensions → Apps Script
// 2. Paste this file, save
// 3. Deploy → New deployment → Web app
//    Execute as: Me | Who has access: Anyone
// 4. Copy Web App URL → paste into app Settings
//
// Sheet tabs needed (exact names):
//   Inventory | Orders | Log
// ════════════════════════════════════════════════════════════════════

function doGet(e) {
  const action = e && e.parameter && e.parameter.action;
  if (action === 'ping') return json({ status: 'ok', message: 'Mecka v2 connected' });
  if (action === 'read') return json(readAll());
  return json({ status: 'ok' });
}

function doPost(e) {
  try {
    const p = JSON.parse(e.postData.contents);
    if (p.action === 'sync') {
      writeInventory(p.inventory || []);
      writeOrders(p.orders || []);
      writeLog(p.log || []);
      return json({ status: 'ok' });
    }
    return json({ status: 'error', message: 'Unknown action' });
  } catch(err) {
    return json({ status: 'error', message: err.toString() });
  }
}

function readAll() {
  return {
    status: 'ok',
    inventory: readSheet('Inventory'),
    orders: readSheet('Orders'),
    log: readSheet('Log')
  };
}

function readSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(name);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function writeInventory(inventory) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Inventory') || ss.insertSheet('Inventory');
  sheet.clearContents();
  if (!inventory.length) return;
  const headers = ['id','name','cat','qty','threshold'];
  const rows = [headers, ...inventory.map(i => headers.map(h => i[h] !== undefined ? i[h] : ''))];
  sheet.getRange(1,1,rows.length,headers.length).setValues(rows);
  styleHeader(sheet, headers.length);
  // Highlight low/out rows
  inventory.forEach((item, idx) => {
    const row = idx + 2;
    const qty = Number(item.qty);
    const thresh = Number(item.threshold);
    const range = sheet.getRange(row, 1, 1, headers.length);
    range.setBackground(qty <= 0 ? '#fdecea' : qty <= thresh ? '#fef3e2' : '#ffffff');
  });
  sheet.autoResizeColumns(1, headers.length);
}

function writeOrders(orders) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Orders') || ss.insertSheet('Orders');
  sheet.clearContents();
  if (!orders.length) return;
  // Flatten orders — one row per item line
  const rows = [['orderId','person','status','createdAt','fulfilledAt','itemId','itemName','qty','notes']];
  orders.forEach(o => {
    (o.items || []).forEach(l => {
      rows.push([o.id, o.person, o.status, o.createdAt||'', o.fulfilledAt||'', l.id, l.name, l.qty, o.notes||'']);
    });
  });
  sheet.getRange(1,1,rows.length,rows[0].length).setValues(rows);
  styleHeader(sheet, rows[0].length);
  // Color by status
  orders.forEach(o => {
    const lineCount = (o.items || []).length;
    // find row start — simpler to just colour all fulfilled rows green
  });
  // Colour fulfilled rows green, open rows blue
  let rowIdx = 2;
  orders.forEach(o => {
    const len = (o.items || []).length || 1;
    const color = o.status === 'fulfilled' ? '#e8f5ee' : '#e8effc';
    sheet.getRange(rowIdx, 1, len, rows[0].length).setBackground(color);
    rowIdx += len;
  });
  sheet.autoResizeColumns(1, rows[0].length);
}

function writeLog(log) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Log') || ss.insertSheet('Log');
  sheet.clearContents();
  if (!log.length) return;
  const headers = ['time','type','name','qty','note'];
  const rows = [headers, ...log.map(l => headers.map(h => l[h] !== undefined ? l[h] : ''))];
  sheet.getRange(1,1,rows.length,headers.length).setValues(rows);
  styleHeader(sheet, headers.length);
  sheet.autoResizeColumns(1, headers.length);
}

function styleHeader(sheet, cols) {
  const h = sheet.getRange(1,1,1,cols);
  h.setFontWeight('bold');
  h.setBackground('#1a1917');
  h.setFontColor('#ffffff');
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
