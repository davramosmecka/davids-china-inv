// ── Hub sync — pull on load, push on change ───────────────────────────────────
const STORAGE_KEY = 'mecka_sheet_url_' + (typeof HUB_ID !== 'undefined' ? HUB_ID : 'default');

let sheetUrl = '';
let syncInterval = null;
let syncReady = false;

function loadSheetUrl() {
  sheetUrl = localStorage.getItem(STORAGE_KEY) || '';
  if (sheetUrl) {
    const el = document.getElementById('sheet-url');
    if (el) el.value = sheetUrl;
    pullFromSheet();
  } else {
    setSyncStatus('disconnected', 'Not connected');
    syncReady = true;
    renderAll();
  }
}

function saveSheetUrl() {
  const url = (document.getElementById('sheet-url').value || '').trim();
  if (!url) return;
  sheetUrl = url;
  localStorage.setItem(STORAGE_KEY, url);
  testConnection();
}

function clearSheetUrl() {
  sheetUrl = '';
  localStorage.removeItem(STORAGE_KEY);
  const el = document.getElementById('sheet-url');
  if (el) el.value = '';
  setSyncStatus('disconnected', 'Not connected');
  if (syncInterval) clearInterval(syncInterval);
  const r = document.getElementById('conn-result');
  if (r) r.style.display = 'none';
}

// ── PULL: load data from Sheet into app on startup ────────────────────────────
async function pullFromSheet() {
  if (!sheetUrl) return;
  setSyncStatus('syncing', 'Loading data…');
  try {
    const res = await fetch(sheetUrl + '?action=read&t=' + Date.now());
    const json = await res.json();
    if (json.status !== 'ok') throw new Error(json.message || 'Bad response');

    if (json.inventory && json.inventory.length) {
      inventory = json.inventory.map(item => ({
        ...item,
        qty: Number(item.qty) || 0,
        threshold: Number(item.threshold) || 0,
        photo: item.photo || null
      }));
    }
    if (json.orders && json.orders.length) {
      orders = rebuildOrders(json.orders);
    }
    if (json.log && json.log.length) {
      txLog = json.log.map(l => ({ ...l, qty: Number(l.qty) || 0 }));
    }
    if (json.people && json.people.length) {
      people = json.people;
    }
    if (json.kits && json.kits.length) {
      const rebuilt = rebuildKits(json.kits);
      KITS.length = 0;
      rebuilt.forEach(k => KITS.push(k));
    }

    saveState();
    setSyncStatus('connected', 'Synced ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  } catch(e) {
    setSyncStatus('error', 'Load failed — using local cache');
  } finally {
    syncReady = true;
    renderAll();
    startAutoSync();
  }
}

// ── PUSH: send current state to Sheet ────────────────────────────────────────
async function pushToSheet() {
  if (!sheetUrl) return;
  setSyncStatus('syncing', 'Saving…');
  try {
    const res = await fetch(sheetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'sync', inventory, orders, log: txLog.slice(0, 300), people, kits: KITS })
    });
    const json = await res.json();
    if (json.status === 'ok') {
      setSyncStatus('connected', 'Saved ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } else throw new Error(json.message);
  } catch(e) {
    setSyncStatus('error', 'Save failed');
  }
}

// syncNow = manual button: pull fresh data then push any local changes
async function syncNow() {
  if (!sheetUrl) { setSyncStatus('disconnected', 'Not connected'); return; }
  await pullFromSheet();
}

function startAutoSync() {
  if (syncInterval) clearInterval(syncInterval);
  syncInterval = setInterval(pushToSheet, 30000);
}

// ── Rebuild helpers (Sheet stores flat rows) ──────────────────────────────────
function rebuildOrders(rows) {
  const map = {};
  rows.forEach(row => {
    const id = String(row.orderId || '');
    if (!id) return;
    if (!map[id]) {
      map[id] = { id, person: row.person||'', status: row.status||'open',
        createdAt: row.createdAt||new Date().toISOString(), fulfilledAt: row.fulfilledAt||null,
        notes: row.notes||'', items: [] };
    }
    if (row.itemId) map[id].items.push({ id: row.itemId, name: row.itemName||'', qty: Number(row.qty)||0 });
  });
  return Object.values(map);
}

function rebuildKits(rows) {
  const map = {};
  rows.forEach(row => {
    const id = String(row.kitId || '');
    if (!id) return;
    if (!map[id]) map[id] = { id, name: row.kitName||id, components: [] };
    if (row.itemId) map[id].components.push({ id: row.itemId, qty: Number(row.qty)||1 });
  });
  return Object.values(map);
}

// ── Test connection ───────────────────────────────────────────────────────────
async function testConnection() {
  setSyncStatus('syncing', 'Testing…');
  const r = document.getElementById('conn-result');
  if (r) r.style.display = 'none';
  try {
    const res = await fetch(sheetUrl + '?action=ping');
    const json = await res.json();
    if (json.status === 'ok') {
      if (r) { r.textContent = 'Connected! Loading data from Sheet…'; r.className = 'conn-result ok'; r.style.display = 'block'; }
      await pullFromSheet();
    } else throw new Error(json.message || 'Bad response');
  } catch(e) {
    setSyncStatus('error', 'Failed');
    if (r) { r.textContent = 'Could not connect: ' + e.message; r.className = 'conn-result error'; r.style.display = 'block'; }
  }
}

function setSyncStatus(state, label) {
  const dot = document.getElementById('sync-dot');
  const lbl = document.getElementById('sync-label');
  if (!dot || !lbl) return;
  dot.className = 'sync-dot';
  if (state === 'connected') dot.classList.add('connected');
  else if (state === 'syncing') dot.classList.add('syncing');
  else if (state === 'error') dot.classList.add('error');
  lbl.textContent = label;
}
