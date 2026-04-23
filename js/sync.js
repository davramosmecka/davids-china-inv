let sheetUrl = '';
let syncInterval = null;

function loadSheetUrl() {
  sheetUrl = localStorage.getItem('mecka_sheet_url') || '';
  if (sheetUrl) {
    document.getElementById('sheet-url').value = sheetUrl;
    setSyncStatus('connected', 'Connected');
    startAutoSync();
  }
}

function saveSheetUrl() {
  const url = document.getElementById('sheet-url').value.trim();
  if (!url) return;
  sheetUrl = url;
  localStorage.setItem('mecka_sheet_url', url);
  testConnection();
}

function clearSheetUrl() {
  sheetUrl = '';
  localStorage.removeItem('mecka_sheet_url');
  document.getElementById('sheet-url').value = '';
  setSyncStatus('disconnected', 'Not connected');
  if (syncInterval) clearInterval(syncInterval);
  const r = document.getElementById('conn-result');
  r.style.display = 'none';
}

async function testConnection() {
  setSyncStatus('syncing', 'Testing…');
  const r = document.getElementById('conn-result');
  r.style.display = 'none';
  try {
    const res = await fetch(sheetUrl + '?action=ping');
    const json = await res.json();
    if (json.status === 'ok') {
      setSyncStatus('connected', 'Connected');
      r.textContent = 'Connection successful.';
      r.className = 'conn-result ok';
      r.style.display = 'block';
      startAutoSync();
    } else throw new Error(json.message || 'Bad response');
  } catch(e) {
    setSyncStatus('error', 'Failed');
    r.textContent = 'Could not connect: ' + e.message;
    r.className = 'conn-result error';
    r.style.display = 'block';
  }
}

function startAutoSync() {
  if (syncInterval) clearInterval(syncInterval);
  syncInterval = setInterval(syncNow, 60000);
}

async function syncNow() {
  if (!sheetUrl) { setSyncStatus('disconnected', 'Not connected'); return; }
  setSyncStatus('syncing', 'Syncing…');
  try {
    const res = await fetch(sheetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'sync', inventory, orders, log: txLog.slice(0, 200) })
    });
    const json = await res.json();
    if (json.status === 'ok') {
      setSyncStatus('connected', 'Synced ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } else throw new Error(json.message);
  } catch(e) { setSyncStatus('error', 'Sync failed'); }
}

function setSyncStatus(state, label) {
  const dot = document.getElementById('sync-dot');
  const lbl = document.getElementById('sync-label');
  dot.className = 'sync-dot';
  if (state === 'connected') dot.classList.add('connected');
  else if (state === 'syncing') dot.classList.add('syncing');
  else if (state === 'error') dot.classList.add('error');
  lbl.textContent = label;
}
