// ════════════════════════════════════════════════════════════════════
// David's China Inv — Apps Script (auth-gated)
// ════════════════════════════════════════════════════════════════════
// Allowlist lives in a sheet named "Access" with column A header "email"
// Add a new row in that sheet to grant access — no redeploy needed.
//
// Setup:
// 1. Paste this whole file into Extensions → Apps Script
// 2. Save. Deploy → Manage deployments → pencil → Version: New version → Deploy
// 3. Create an "Access" tab with header "email" and one row per allowed email
// ════════════════════════════════════════════════════════════════════

const CLIENT_ID = '659988920387-5pn2hcd55sf4qsag2ra52qj58qdmm7tb.apps.googleusercontent.com';

function doGet(e) {
  const action = e && e.parameter && e.parameter.action;
  if (action === 'ping') return json({ status: 'ok', message: 'Connected' });
  return json({ status: 'ok' });
}

function doPost(e) {
  try {
    const p = JSON.parse(e.postData.contents);

    if (p.action === 'authorize') {
      const user = verifyIdToken(p.idToken);
      if (!user) return json({ status: 'error', message: 'Invalid token' });
      return json({ status: 'ok', allowed: isAllowed(user.email), email: user.email, name: user.name });
    }

    // Every other action requires a valid, allowlisted user
    const user = verifyIdToken(p.idToken);
    if (!user) return json({ status: 'error', message: 'Invalid or expired token' });
    if (!isAllowed(user.email)) return json({ status: 'error', message: 'Not authorized: ' + user.email });

    if (p.action === 'read') return json(readAll());
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

// ── Auth helpers ──────────────────────────────────────────────────────────────
function verifyIdToken(idToken) {
  if (!idToken) return null;
  try {
    const res = UrlFetchApp.fetch(
      'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken),
      { muteHttpExceptions: true }
    );
    if (res.getResponseCode() !== 200) return null;
    const info = JSON.parse(res.getContentText());
    if (info.aud !== CLIENT_ID) return null;
    if (info.email_verified !== 'true' && info.email_verified !== true) return null;
    return { email: String(info.email || '').toLowerCase(), name: info.name || '' };
  } catch(e) { return null; }
}

function isAllowed(email) {
  if (!email) return false;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Access');
  if (!sheet) return false;
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return false;
  const needle = String(email).trim().toLowerCase();
  return data.slice(1).some(row => String(row[0] || '').trim().toLowerCase() === needle);
}

// ── Readers ───────────────────────────────────────────────────────────────────
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

// ── Writers ───────────────────────────────────────────────────────────────────
function writeInventory(inventory) {
  const sheet = getOrCreate('Inventory');
  sheet.clearContents();
  if (!inventory.length) return;
  const headers = ['id','name','cat','qty','threshold','photo'];
  const rows = [headers, ...inventory.map(i => headers.map(h => {
    const val = i[h];
    if (val === undefined || val === null) return '';
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
  const headers = ['time','type','name','qty','who','note'];
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

// ── Utilities ─────────────────────────────────────────────────────────────────
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
