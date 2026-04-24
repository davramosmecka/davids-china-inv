// ── Default inventory ─────────────────────────────────────────────────────────
const DEFAULT_INVENTORY = [
  { id: 'multicam-hat',       name: 'Multicam hat',                 cat: 'Hardware',    qty: 0, threshold: 10 },
  { id: 'multicam-hat-wc',    name: 'Multicam hat + WC',            cat: 'Hardware',    qty: 0, threshold: 5  },
  { id: 'cpu-cm5',            name: 'CPU (Radxa CM5)',               cat: 'Hardware',    qty: 0, threshold: 10 },
  { id: 'insta360',           name: 'Insta360 camera',              cat: 'Hardware',    qty: 0, threshold: 20 },
  { id: 'insta360-case',      name: 'Insta360 case',                cat: 'Accessories', qty: 0, threshold: 20 },
  { id: 'insta360-mount',     name: 'Insta360 quick mount',         cat: 'Accessories', qty: 0, threshold: 20 },
  { id: 'wired-wrist-module', name: 'Wired wrist cam module',       cat: 'Hardware',    qty: 0, threshold: 10 },
  { id: 'iphone',             name: 'iPhone',                       cat: 'Hardware',    qty: 0, threshold: 5  },
  { id: 'powerbank',          name: 'Powerbank',                    cat: 'Accessories', qty: 0, threshold: 20 },
  { id: 'short-cc-cable',     name: 'Battery bank short C-C cable', cat: 'Cables',      qty: 0, threshold: 30 },
  { id: 'cc-cable',           name: 'USB C-C cable',                cat: 'Cables',      qty: 0, threshold: 40 },
  { id: 'ca-cable',           name: 'USB C-A cable',                cat: 'Cables',      qty: 0, threshold: 20 },
  { id: 'power-cable-wb',     name: 'Power cable (white & black)',  cat: 'Cables',      qty: 0, threshold: 8  },
  { id: 'charging-brick',     name: 'C cable charging brick',       cat: 'Accessories', qty: 0, threshold: 30 },
  { id: 'sd-256',             name: 'SD card 256GB SanDisk',        cat: 'Storage',     qty: 0, threshold: 40 },
  { id: 'mesh-bag',           name: 'Mesh bag',                     cat: 'Packaging',   qty: 0, threshold: 20 },
  { id: 'multicam-cover',     name: 'Multicam cover',               cat: 'Accessories', qty: 0, threshold: 10 },
  { id: 'headstrap',          name: 'Headstrap set',                cat: 'Accessories', qty: 0, threshold: 8  },
  { id: 'wrist-strap',        name: 'Wrist strap (L&R pair)',       cat: 'Accessories', qty: 0, threshold: 15 },
  { id: 'elastic-band',       name: 'Elastic band',                 cat: 'Accessories', qty: 0, threshold: 20 },
  { id: 'sweatband',          name: 'Sweatband',                    cat: 'Accessories', qty: 0, threshold: 15 },
  { id: 'lens-wipe',          name: 'Lens wipe',                    cat: 'Accessories', qty: 0, threshold: 50 },
  { id: 'guidelines',         name: 'Guidelines handout',           cat: 'Packaging',   qty: 0, threshold: 30 },
  { id: 'usb-hub',            name: 'USB charging hub',             cat: 'Hardware',    qty: 0, threshold: 4  },
  { id: 'ac-cable',           name: 'USB A-C cable',                cat: 'Cables',      qty: 0, threshold: 12 },
];

let KITS = [
  { id: 'multicam-set', name: 'Multicam set', components: [
    {id:'multicam-hat',qty:1},{id:'cpu-cm5',qty:1},{id:'cc-cable',qty:1},{id:'powerbank',qty:1},
    {id:'short-cc-cable',qty:1},{id:'charging-brick',qty:1},{id:'mesh-bag',qty:1},{id:'guidelines',qty:1},
    {id:'sd-256',qty:2},{id:'lens-wipe',qty:2},{id:'multicam-cover',qty:1}]},
  { id: 'multicam-wired', name: 'Multi cam + wrist wired', components: [
    {id:'multicam-hat-wc',qty:1},{id:'cpu-cm5',qty:1},{id:'power-cable-wb',qty:1},{id:'powerbank',qty:1},
    {id:'short-cc-cable',qty:1},{id:'charging-brick',qty:1},{id:'mesh-bag',qty:1},{id:'multicam-cover',qty:1},
    {id:'wired-wrist-module',qty:2},{id:'guidelines',qty:1},{id:'wrist-strap',qty:2},{id:'elastic-band',qty:2}]},
  { id: 'naruto-mono', name: 'Mono + Insta360 (Naruto)', components: [
    {id:'insta360',qty:2},{id:'insta360-case',qty:2},{id:'insta360-mount',qty:2},{id:'headstrap',qty:1},
    {id:'iphone',qty:1},{id:'powerbank',qty:1},{id:'short-cc-cable',qty:1},{id:'charging-brick',qty:1},
    {id:'sweatband',qty:2},{id:'sd-256',qty:2},{id:'guidelines',qty:1},{id:'cc-cable',qty:1},
    {id:'ca-cable',qty:1},{id:'mesh-bag',qty:1}]},
  { id: 'naruto-upgrade', name: 'Naruto upgrade set', components: [
    {id:'insta360',qty:2},{id:'powerbank',qty:1},{id:'cc-cable',qty:1},{id:'ca-cable',qty:1},
    {id:'short-cc-cable',qty:1},{id:'charging-brick',qty:1},{id:'sd-256',qty:2}]},
  { id: 'charging-hub', name: 'Charging hub set', components: [
    {id:'usb-hub',qty:1},{id:'cc-cable',qty:6},{id:'ac-cable',qty:2}]},
];

// Keep a frozen copy for reset
const DEFAULT_KITS = JSON.parse(JSON.stringify(KITS));

// ── State ─────────────────────────────────────────────────────────────────────
let inventory = [];
let orders = [];
let txLog = [];
let people = ['Brian', 'Julia', 'Evan Neff', 'Evan Chen', 'Armita', 'Tyler', 'Peter'];
let nextId = 1000;
let nextOrderId = 1;

function loadState() {
  try {
    const saved = localStorage.getItem('mecka_' + (typeof HUB_ID !== 'undefined' ? HUB_ID : 'default'));
    if (saved) {
      const p = JSON.parse(saved);
      inventory = p.inventory || JSON.parse(JSON.stringify(DEFAULT_INVENTORY));
      orders    = p.orders    || [];
      txLog     = p.log       || [];
      people    = p.people    || people;
      nextId    = p.nextId    || 1000;
      nextOrderId = p.nextOrderId || 1;
      if (p.kits && p.kits.length) KITS = p.kits;
    } else {
      inventory = JSON.parse(JSON.stringify(DEFAULT_INVENTORY));
    }
  } catch(e) {
    inventory = JSON.parse(JSON.stringify(DEFAULT_INVENTORY));
  }
}

let _pushTimer = null;
function saveState() {
  try {
    const hub = typeof HUB_ID !== 'undefined' ? HUB_ID : 'default';
    localStorage.setItem('mecka_' + hub, JSON.stringify({ inventory, orders, log: txLog, people, nextId, nextOrderId, kits: KITS }));
    if (typeof syncReady !== 'undefined' && syncReady) {
      localStorage.setItem('mecka_dirty_' + hub, '1');
      if (typeof pushToSheet === 'function') {
        clearTimeout(_pushTimer);
        _pushTimer = setTimeout(pushToSheet, 500);
      }
    }
  } catch(e) {}
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getItem(id) { return inventory.find(i => i.id === id); }

function statusOf(item) {
  const avail = availableQty(item.id);
  if (item.qty <= 0) return 'out';
  if (avail <= 0) return 'out';
  if (avail <= item.threshold) return 'low';
  return 'ok';
}

// Total units reserved by open orders for a given item id
function committedQty(itemId) {
  return orders
    .filter(o => o.status === 'open')
    .reduce((sum, o) => {
      const line = o.items.find(l => l.id === itemId);
      return sum + (line ? line.qty : 0);
    }, 0);
}

function availableQty(itemId) {
  const item = getItem(itemId);
  if (!item) return 0;
  return Math.max(0, item.qty - committedQty(itemId));
}

function addTx(type, name, qty, note) {
  const now = new Date();
  const who = (typeof currentUser !== 'undefined' && currentUser && currentUser.email) ? currentUser.email : '';
  txLog.unshift({
    time: now.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    type, name, qty, note: note || '', who
  });
  if (txLog.length > 600) txLog = txLog.slice(0, 600);
  saveState();
}

function initials(name) {
  return name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
}

function fmtDate(iso) {
  return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function resetToDefaults() {
  if (!confirm('Reset all quantities to 0 and restore defaults? Orders, log and kit edits will also be cleared.')) return;
  inventory = JSON.parse(JSON.stringify(DEFAULT_INVENTORY));
  orders = []; txLog = [];
  KITS = JSON.parse(JSON.stringify(DEFAULT_KITS));
  saveState();
  renderAll();
}

function exportJSON() {
  const blob = new Blob([JSON.stringify({ inventory, orders, log: txLog, people }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'mecka-inventory-' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
}

function importJSON() { document.getElementById('import-file').click(); }

function handleImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const p = JSON.parse(e.target.result);
      if (p.inventory) {
        inventory = p.inventory;
        if (p.orders) orders = p.orders;
        if (p.log) txLog = p.log;
        if (p.people) people = p.people;
        saveState(); renderAll();
        alert('Imported successfully.');
      } else { alert('Invalid format.'); }
    } catch(err) { alert('Parse error: ' + err.message); }
  };
  reader.readAsText(file);
  event.target.value = '';
}
