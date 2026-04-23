// ════════════════════════════════════════════════════════════════════
// Mecka AI — Inventory Apps Script v3
// Supports: read (pull on load) + sync (push on change)
// ════════════════════════════════════════════════════════════════════
//
// SETUP — same for every hub, each hub gets its own Sheet:
// 1. Create a Google Sheet (tabs are created automatically on first sync)
// 2. Extensions → Apps Script → paste this entire file → Save
// 3. Deploy → New deployment → Web app
//    Execute as: Me  |  Who has access: Anyone
// 4. Copy the Web App URL → paste into that hub's Settings page
// ════════════════════════════════════════════════════════════════════

function doGet(e) {
  const action = e && e.parameter && e.parameter.action;
  if (action === 'ping') return json({ status: 'ok', message: 'Mecka connected' });
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
      writePeople(p.people || []);
      writeKits(p.kits || []);
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
    orders:    readSheet('Orders'),
    log:       readSheet('Log'),
    people:    readPeople(),
    kits:      readSheet('Kits')
  };
}

function readSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(name);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0].map(h => String(h).trim());
  return data.slice(1)
    .filter(row => row.some(cell => cell !== '' && cell !== null))
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => { if (h) obj[h] = row[i] !== undefined ? String(row[i]) : ''; });
      return obj;
    });
}

function readPeople() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('People');
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  return data.slice(1).map(row => String(row[0])).filter(Boolean);
}

function writeInventory(inventory) {
  const sheet = getOrCreate('Inventory');
  sheet.clearContents();
  if (!inventory.length) return;
  const headers = ['id','name','cat','qty','threshold','photo'];
  const rows = [headers, ...inventory.map(i => headers.map(h => {
    const val = i[h];
    if (val === undefined || val === null) return '';
    // photo is now a Drive URL (short string) — safe to store directly
    return String(val);
  }))];
  sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
  styleHeader(sheet, headers.length);
  inventory.forEach((item, idx) => {
    const qty = Number(item.qty) || 0;
    const thresh = Number(item.threshold) || 0;
    sheet.getRange(idx + 2, 1, 1, headers.length)
      .setBackground(qty <= 0 ? '#fdecea' : qty <= thresh ? '#fef3e2' : '#ffffff');
  });
  sheet.autoResizeColumns(1, headers.length);
}

function writeOrders(orders) {
  const sheet = getOrCreate('Orders');
  sheet.clearContents();
  if (!orders.length) return;
  const headers = ['orderId','person','status','createdAt','fulfilledAt','itemId','itemName','qty','notes'];
  const rows = [headers];
  orders.forEach(o => {
    const items = o.items || [];
    if (items.length) {
      items.forEach(l => rows.push([o.id, o.person, o.status, o.createdAt||'', o.fulfilledAt||'', l.id, l.name, l.qty, o.notes||'']));
    } else {
      rows.push([o.id, o.person, o.status, o.createdAt||'', o.fulfilledAt||'', '', '', 0, o.notes||'']);
    }
  });
  sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
  styleHeader(sheet, headers.length);
  let r = 2;
  orders.forEach(o => {
    const len = Math.max((o.items||[]).length, 1);
    sheet.getRange(r, 1, len, headers.length).setBackground(o.status === 'fulfilled' ? '#e8f5ee' : '#e8effc');
    r += len;
  });
  sheet.autoResizeColumns(1, headers.length);
}

function writeLog(log) {
  const sheet = getOrCreate('Log');
  sheet.clearContents();
  if (!log.length) return;
  const headers = ['time','type','name','qty','note'];
  const rows = [headers, ...log.map(l => headers.map(h => l[h] !== undefined ? l[h] : ''))];
  sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
  styleHeader(sheet, headers.length);
  sheet.autoResizeColumns(1, headers.length);
}

function writePeople(people) {
  const sheet = getOrCreate('People');
  sheet.clearContents();
  if (!people.length) return;
  const rows = [['name'], ...people.map(p => [p])];
  sheet.getRange(1, 1, rows.length, 1).setValues(rows);
  styleHeader(sheet, 1);
}

function writeKits(kits) {
  const sheet = getOrCreate('Kits');
  sheet.clearContents();
  if (!kits.length) return;
  const rows = [['kitId','kitName','itemId','qty']];
  kits.forEach(kit => (kit.components||[]).forEach(c => rows.push([kit.id, kit.name, c.id, c.qty])));
  sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  styleHeader(sheet, rows[0].length);
  sheet.autoResizeColumns(1, rows[0].length);
}

function getOrCreate(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function styleHeader(sheet, cols) {
  const h = sheet.getRange(1, 1, 1, cols);
  h.setFontWeight('bold');
  h.setBackground('#1a1917');
  h.setFontColor('#ffffff');
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
