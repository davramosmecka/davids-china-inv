// ── Navigation ────────────────────────────────────────────────────────────────
let activeKitId = KITS[0].id;
let orderFilter = 'open';

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.querySelector(`.tab-panel[data-panel="${tab}"]`).classList.add('active');
    if (tab === 'log') renderLog();
    if (tab === 'kitting') renderKitting();
    if (tab === 'settings') renderPeople();
  });
});

// ── Modal helpers ─────────────────────────────────────────────────────────────
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

document.querySelectorAll('.modal-overlay').forEach(el => {
  el.addEventListener('click', e => { if (e.target === el) el.classList.remove('open'); });
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
});

// ── Stock tab ─────────────────────────────────────────────────────────────────
function renderStock() {
  const search = (document.getElementById('search').value || '').toLowerCase();
  const catFilter = document.getElementById('cat-filter').value;
  const statusFilter = document.getElementById('status-filter').value;

  const cats = [...new Set(inventory.map(i => i.cat))].sort();
  const catSel = document.getElementById('cat-filter');
  const prevCat = catSel.value;
  catSel.innerHTML = '<option value="">All categories</option>' +
    cats.map(c => `<option value="${c}" ${c===prevCat?'selected':''}>${c}</option>`).join('');

  const filtered = inventory.filter(i => {
    const s = statusOf(i);
    return (!search || i.name.toLowerCase().includes(search) || i.cat.toLowerCase().includes(search))
      && (!catFilter || i.cat === catFilter)
      && (!statusFilter || s === statusFilter);
  });

  let total = 0, low = 0, out = 0, totalCommitted = 0;
  inventory.forEach(i => {
    total += i.qty;
    totalCommitted += committedQty(i.id);
    const s = statusOf(i);
    if (s === 'low') low++;
    if (s === 'out') out++;
  });
  const openOrders = orders.filter(o => o.status === 'open').length;

  document.getElementById('stats-row').innerHTML = `
    <div class="stat-card"><div class="stat-label">Total units</div><div class="stat-val">${total.toLocaleString()}</div></div>
    <div class="stat-card"><div class="stat-label">SKUs</div><div class="stat-val">${inventory.length}</div></div>
    <div class="stat-card"><div class="stat-label">Committed</div><div class="stat-val blue">${totalCommitted}</div></div>
    <div class="stat-card"><div class="stat-label">Low stock</div><div class="stat-val warn">${low}</div></div>
    <div class="stat-card"><div class="stat-label">Out of stock</div><div class="stat-val danger">${out}</div></div>
  `;

  const alerts = inventory.filter(i => statusOf(i) !== 'ok');
  document.getElementById('alert-container').innerHTML = alerts.length
    ? `<div class="alert-banner"><strong>Reorder needed:</strong> ${alerts.map(i=>`${i.name} (${availableQty(i.id)} avail)`).join(' · ')}</div>` : '';

  const grid = document.getElementById('inv-grid');
  if (!filtered.length) { grid.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:.5rem 0;">No items match.</div>'; return; }

  grid.innerHTML = filtered.map(item => {
    const s = statusOf(item);
    const committed = committedQty(item.id);
    const avail = availableQty(item.id);
    const thumbHtml = item.photo
      ? `<img class="inv-card-thumb" src="${driveUrlToEmbed(item.photo)}" alt="${item.name}" onclick="openLightbox('${item.id}')">`
      : '';
    return `
      <div class="inv-card ${s !== 'ok' ? s : ''}">
        <div class="inv-card-top">
          ${thumbHtml}
          <div class="inv-card-top-inner">
            <div class="inv-card-name">${item.name}</div>
            <div class="inv-card-cat">${item.cat}</div>
          </div>
          <span class="badge ${s}">${s==='ok'?'OK':s==='low'?'Low':'Out'}</span>
        </div>
        <div class="inv-stock">${item.qty}</div>
        ${committed > 0 ? `<div class="inv-committed">${committed} committed to orders</div>` : ''}
        <div class="inv-available" style="color:${avail<=0?'var(--red)':avail<=item.threshold?'var(--amber)':'var(--text2)'};">${avail} available</div>
        <div class="action-row">
          <div class="action-block">
            <div class="action-lbl">Receive</div>
            <div class="action-inputs">
              <input class="action-num" type="number" id="recv-${item.id}" placeholder="qty" min="1"
                onkeydown="if(event.key==='Enter')receiveItem('${item.id}')">
              <button class="abtn receive" onclick="receiveItem('${item.id}')">+ Add</button>
            </div>
          </div>
          <div class="action-block">
            <div class="action-lbl">Remove</div>
            <div class="action-inputs">
              <input class="action-num" type="number" id="use-${item.id}" placeholder="qty" min="1"
                onkeydown="if(event.key==='Enter')useItem('${item.id}')">
              <button class="abtn use" onclick="useItem('${item.id}')">− Use</button>
            </div>
          </div>
        </div>
        <div class="inv-card-footer">
          <span class="thresh-label">Reorder at</span>
          <input class="thresh-input" type="number" value="${item.threshold}" min="0" onchange="setThreshold('${item.id}',this.value)">
          <button class="edit-link" onclick="openEditItem('${item.id}')">edit</button>
          <button class="remove-link" onclick="removeItem('${item.id}')">remove</button>
        </div>
      </div>`;
  }).join('');
}

function receiveItem(id) {
  const input = document.getElementById('recv-' + id);
  const qty = parseInt(input.value);
  if (!qty || qty <= 0) { flashErr(input); return; }
  const item = getItem(id);
  if (!item) return;
  item.qty += qty;
  addTx('in', item.name, qty, 'received');
  input.value = '';
  renderStock(); updateKitCounts();
}

function useItem(id) {
  const input = document.getElementById('use-' + id);
  const qty = parseInt(input.value);
  if (!qty || qty <= 0) { flashErr(input); return; }
  const item = getItem(id);
  if (!item) return;
  if (item.qty < qty) { flashErr(input); return; }
  item.qty -= qty;
  addTx('out', item.name, qty, 'manual removal');
  input.value = '';
  renderStock(); updateKitCounts();
}

function setThreshold(id, val) {
  const item = getItem(id);
  if (item) { item.threshold = Math.max(0, parseInt(val)||0); saveState(); renderStock(); }
}

function removeItem(id) {
  if (!confirm('Remove this item?')) return;
  inventory = inventory.filter(i => i.id !== id);
  saveState(); renderStock(); renderKitting();
}

// ── Add item modal ────────────────────────────────────────────────────────────
function addItem() {
  const name = document.getElementById('new-name').value.trim();
  if (!name) { document.getElementById('new-name').focus(); return; }
  inventory.push({
    id: 'item-' + (nextId++),
    name,
    cat: document.getElementById('new-cat').value.trim() || 'Uncategorized',
    qty: Math.max(0, parseInt(document.getElementById('new-qty').value)||0),
    threshold: Math.max(0, parseInt(document.getElementById('new-thresh').value)||10)
  });
  saveState();
  document.getElementById('new-name').value = '';
  document.getElementById('new-cat').value = '';
  document.getElementById('new-qty').value = '0';
  document.getElementById('new-thresh').value = '10';
  closeModal('add-item-modal');
  renderStock(); renderKitting();
}

// ── Kitting tab ───────────────────────────────────────────────────────────────
function maxKits(kit) {
  let min = Infinity;
  kit.components.forEach(c => {
    const avail = availableQty(c.id);
    min = Math.min(min, Math.floor(avail / c.qty));
  });
  return isFinite(min) ? Math.max(0, min) : 0;
}

function renderKitting() {
  document.getElementById('kit-tab-bar').innerHTML = KITS.map(kit =>
    `<button class="kit-tab-btn ${kit.id===activeKitId?'active':''}"
      onclick="switchKit('${kit.id}')">
      ${kit.name} <span style="font-size:11px;opacity:.65;">(${maxKits(kit)})</span>
    </button>`
  ).join('');

  document.getElementById('kit-panels').innerHTML = KITS.map(kit => {
    const max = maxKits(kit);
    const rows = kit.components.map(c => {
      const item = getItem(c.id);
      const stock = item ? item.qty : 0;
      const avail = availableQty(c.id);
      const committed = committedQty(c.id);
      const cls = avail <= 0 ? 'out' : avail <= (item ? item.threshold : 0) ? 'warn' : '';
      return `<tr>
        <td><strong>${item ? item.name : c.id}</strong></td>
        <td style="color:var(--text3);">${c.qty} per set</td>
        <td class="stock-cell ${cls}">${avail}${committed>0?` <span style="font-size:10px;color:var(--blue);">(${committed} rsv)</span>`:''}
        </td>
        <td>
          <div class="pick-row-inputs">
            <input class="pick-num" type="number" id="pick-${kit.id}-${c.id}" placeholder="qty" min="1"
              onkeydown="if(event.key==='Enter')confirmPick('${kit.id}','${c.id}',-1)">
            <button class="pbtn pull" onclick="confirmPick('${kit.id}','${c.id}',-1)">− Pull</button>
            <button class="pbtn ret"  onclick="confirmPick('${kit.id}','${c.id}',1)">+ Return</button>
          </div>
        </td>
      </tr>`;
    }).join('');

    return `<div class="kit-panel ${kit.id===activeKitId?'active':''}" data-kit="${kit.id}">
      <div class="kit-info-bar">
        <div>
          <div class="kit-info-name">${kit.name}</div>
          <div class="kit-info-sub">Available stock shown (total minus reserved orders)</div>
        </div>
        <span class="badge ${max>0?'ok':'out'}">${max>0?max+' buildable':'cannot build'}</span>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr>
            <th style="width:30%">Component</th>
            <th style="width:13%">Per set</th>
            <th style="width:18%">Available</th>
            <th>Pull / return</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="kit-footer-bar">
          <label>Autofill for</label>
          <input class="af-input" type="number" id="af-${kit.id}" value="1" min="1">
          <label>sets</label>
          <button class="btn-ghost" onclick="autofill('${kit.id}')">Fill quantities</button>
          <button class="btn-ghost" style="margin-left:4px;" onclick="clearPicks('${kit.id}')">Clear all</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function updateKitCounts() {
  document.querySelectorAll('.kit-tab-btn').forEach((btn, i) => {
    const kit = KITS[i];
    if (kit) btn.innerHTML = `${kit.name} <span style="font-size:11px;opacity:.65;">(${maxKits(kit)})</span>`;
  });
}

function switchKit(kitId) {
  activeKitId = kitId;
  document.querySelectorAll('.kit-tab-btn').forEach((b,i) => b.classList.toggle('active', KITS[i] && KITS[i].id === kitId));
  document.querySelectorAll('.kit-panel').forEach(p => p.classList.toggle('active', p.dataset.kit === kitId));
}

function autofill(kitId) {
  const kit = KITS.find(k => k.id === kitId);
  const sets = parseInt(document.getElementById('af-' + kitId).value) || 1;
  kit.components.forEach(c => {
    const el = document.getElementById('pick-' + kitId + '-' + c.id);
    if (el) el.value = c.qty * sets;
  });
}

function clearPicks(kitId) {
  const kit = KITS.find(k => k.id === kitId);
  kit.components.forEach(c => {
    const el = document.getElementById('pick-' + kitId + '-' + c.id);
    if (el) el.value = '';
  });
}

function confirmPick(kitId, itemId, dir) {
  const el = document.getElementById('pick-' + kitId + '-' + itemId);
  const qty = parseInt(el.value);
  if (!qty || qty <= 0) { flashErr(el); return; }
  const item = getItem(itemId);
  if (!item) return;
  if (dir < 0 && item.qty < qty) { flashErr(el); alert(`Only ${item.qty} in stock.`); return; }
  item.qty = Math.max(0, item.qty + dir * qty);
  const kit = KITS.find(k => k.id === kitId);
  addTx(dir > 0 ? 'in' : 'out', item.name, qty, (kit ? kit.name : 'kitting') + (dir > 0 ? ' — return' : ' — pick'));
  el.value = '';
  renderStock(); renderKitting();
}

// ── Orders tab ────────────────────────────────────────────────────────────────
let orderLineCount = 0;

function setOrderFilter(f, el) {
  orderFilter = f;
  document.querySelectorAll('.order-filter-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  renderOrders();
}

function renderOrders() {
  const search = (document.getElementById('order-search').value || '').toLowerCase();
  let filtered = orders.filter(o => {
    const matchFilter = orderFilter === 'all' || o.status === orderFilter;
    const matchSearch = !search || o.person.toLowerCase().includes(search) ||
      o.items.some(l => l.name.toLowerCase().includes(search));
    return matchFilter && matchSearch;
  }).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));

  const openCount = orders.filter(o => o.status === 'open').length;
  const badge = document.getElementById('nav-order-count');
  if (openCount > 0) { badge.textContent = openCount; badge.style.display = ''; }
  else { badge.style.display = 'none'; }

  const container = document.getElementById('orders-list');
  if (!filtered.length) {
    container.innerHTML = `<div class="empty-state">No ${orderFilter === 'all' ? '' : orderFilter} orders yet.</div>`;
    return;
  }

  container.innerHTML = filtered.map(order => {
    const chips = order.items.map(l =>
      `<span class="order-chip">${l.qty}x ${l.name}</span>`
    ).join('');
    const statusClass = order.status === 'open' ? 'order-status-open' : 'order-status-fulfilled';
    const statusLabel = order.status === 'open' ? 'Open' : 'Fulfilled';
    return `
      <div class="order-card">
        <div class="order-card-header" onclick="openOrderDetail('${order.id}')">
          <div class="order-avatar">${initials(order.person)}</div>
          <div>
            <div class="order-person">${order.person}</div>
            <div class="order-meta">Order #${order.id} · ${fmtDate(order.createdAt)}</div>
          </div>
          <span class="badge ${statusClass}" style="margin-left:8px;">${statusLabel}</span>
          <div class="order-actions" onclick="event.stopPropagation()">
            ${order.status === 'open'
              ? `<button class="btn-ghost green" style="font-size:12px;padding:5px 11px;" onclick="fulfillOrder('${order.id}')">Fulfill</button>`
              : ''}
            <button class="btn-ghost danger" style="font-size:12px;padding:5px 11px;" onclick="cancelOrder('${order.id}')">
              ${order.status === 'open' ? 'Cancel' : 'Delete'}
            </button>
          </div>
        </div>
        <div class="order-items-preview">${chips}</div>
        ${order.notes ? `<div class="order-notes-row">${order.notes}</div>` : ''}
      </div>`;
  }).join('');
}

function openNewOrderModal() {
  orderLineCount = 0;
  document.getElementById('order-lines').innerHTML = '';
  document.getElementById('order-notes').value = '';
  document.getElementById('order-stock-warning').style.display = 'none';

  // Populate person dropdown
  const sel = document.getElementById('order-person');
  sel.innerHTML = '<option value="">— select person —</option>' +
    people.map(p => `<option value="${p}">${p}</option>`).join('');

  addOrderLine();
  openModal('new-order-modal');
}

function addOrderLine() {
  orderLineCount++;
  const id = 'ol-' + orderLineCount;
  const options = inventory.map(i =>
    `<option value="${i.id}" data-name="${i.name}">${i.name} (${availableQty(i.id)} avail)</option>`
  ).join('');
  const div = document.createElement('div');
  div.className = 'order-line';
  div.id = id;
  div.innerHTML = `
    <select onchange="checkOrderStock()">${options}</select>
    <input type="number" value="1" min="1" placeholder="qty" onchange="checkOrderStock()">
    <button class="order-line-remove" onclick="removeOrderLine('${id}')">×</button>
  `;
  document.getElementById('order-lines').appendChild(div);
}

function removeOrderLine(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
  checkOrderStock();
}

function getOrderLines() {
  const lines = [];
  document.querySelectorAll('#order-lines .order-line').forEach(row => {
    const sel = row.querySelector('select');
    const input = row.querySelector('input');
    const id = sel.value;
    const qty = parseInt(input.value) || 0;
    const name = sel.options[sel.selectedIndex]?.dataset.name || id;
    if (id && qty > 0) lines.push({ id, name, qty });
  });
  return lines;
}

function checkOrderStock() {
  const lines = getOrderLines();
  const warn = [];
  lines.forEach(l => {
    const avail = availableQty(l.id);
    if (l.qty > avail) warn.push(`${l.name}: need ${l.qty}, only ${avail} available`);
  });
  const el = document.getElementById('order-stock-warning');
  if (warn.length) {
    el.textContent = 'Stock warning: ' + warn.join(' · ');
    el.style.display = 'block';
  } else {
    el.style.display = 'none';
  }
}

function submitOrder() {
  const person = document.getElementById('order-person').value;
  if (!person) { alert('Please select a person.'); return; }
  const items = getOrderLines();
  if (!items.length) { alert('Add at least one item.'); return; }
  const notes = document.getElementById('order-notes').value.trim();

  // Check stock
  const shortfalls = [];
  items.forEach(l => {
    const avail = availableQty(l.id);
    if (l.qty > avail) shortfalls.push(`${l.name}: need ${l.qty}, have ${avail}`);
  });
  if (shortfalls.length) {
    if (!confirm('Some items exceed available stock:\n' + shortfalls.join('\n') + '\n\nPlace order anyway and reserve what you have?')) return;
  }

  const order = {
    id: String(nextOrderId++),
    person,
    items,
    notes,
    status: 'open',
    createdAt: new Date().toISOString(),
    fulfilledAt: null
  };
  orders.push(order);

  // Log reservation
  items.forEach(l => {
    addTx('reserve', l.name, l.qty, `Reserved — order #${order.id} for ${person}`);
  });

  saveState();
  closeModal('new-order-modal');
  renderOrders();
  renderStock();
  updateKitCounts();
}

function fulfillOrder(orderId) {
  const order = orders.find(o => o.id === orderId);
  if (!order || order.status !== 'open') return;
  if (!confirm(`Fulfill order #${orderId} for ${order.person}?\n\nThis will deduct stock and mark the order complete.`)) return;

  // Deduct stock
  const failed = [];
  order.items.forEach(l => {
    const item = getItem(l.id);
    if (!item) { failed.push(l.name + ' (not found)'); return; }
    if (item.qty < l.qty) {
      failed.push(`${l.name}: need ${l.qty}, have ${item.qty}`);
    } else {
      item.qty -= l.qty;
      addTx('out', item.name, l.qty, `Fulfilled — order #${order.id} for ${order.person}`);
    }
  });

  if (failed.length) {
    alert('Could not fully fulfill:\n' + failed.join('\n'));
  }

  order.status = 'fulfilled';
  order.fulfilledAt = new Date().toISOString();
  saveState();
  renderOrders();
  renderStock();
  updateKitCounts();
}

function cancelOrder(orderId) {
  const order = orders.find(o => o.id === orderId);
  if (!order) return;
  const label = order.status === 'open' ? 'Cancel' : 'Delete';
  if (!confirm(`${label} order #${orderId} for ${order.person}?`)) return;
  if (order.status === 'open') {
    order.items.forEach(l => addTx('in', l.name, l.qty, `Reservation released — order #${order.id} cancelled`));
  }
  orders = orders.filter(o => o.id !== orderId);
  saveState();
  renderOrders();
  renderStock();
  updateKitCounts();
}

function openOrderDetail(orderId) {
  const order = orders.find(o => o.id === orderId);
  if (!order) return;
  document.getElementById('detail-title').textContent = `Order #${order.id} — ${order.person}`;
  const rows = order.items.map(l => {
    const item = getItem(l.id);
    return `<tr>
      <td>${l.name}</td>
      <td>${l.qty}</td>
      <td>${item ? item.qty : '—'}</td>
    </tr>`;
  }).join('');
  document.getElementById('detail-body').innerHTML = `
    <div style="display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap;">
      <div><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px;">Person</div><strong>${order.person}</strong></div>
      <div><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px;">Status</div><span class="badge ${order.status==='open'?'order-status-open':'order-status-fulfilled'}">${order.status}</span></div>
      <div><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px;">Placed</div>${fmtDate(order.createdAt)}</div>
      ${order.fulfilledAt ? `<div><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px;">Fulfilled</div>${fmtDate(order.fulfilledAt)}</div>` : ''}
    </div>
    ${order.notes ? `<div style="padding:9px 12px;background:var(--surface2);border-radius:var(--radius-sm);font-size:13px;color:var(--text2);margin-bottom:16px;">${order.notes}</div>` : ''}
    <table class="detail-table">
      <thead><tr><th>Item</th><th>Ordered qty</th><th>Current stock</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
  document.getElementById('detail-footer').innerHTML = `
    ${order.status==='open'
      ? `<button class="btn-primary" onclick="closeModal('order-detail-modal');fulfillOrder('${order.id}')">Fulfill order</button>`
      : ''}
    <button class="btn-ghost" onclick="closeModal('order-detail-modal')">Close</button>
  `;
  openModal('order-detail-modal');
}

// ── Settings — People ─────────────────────────────────────────────────────────
function renderPeople() {
  document.getElementById('people-list').innerHTML = people.map((p, i) =>
    `<span class="person-tag">${p} <button onclick="removePerson(${i})">×</button></span>`
  ).join('');
}

function addPerson() {
  const input = document.getElementById('new-person');
  const name = input.value.trim();
  if (!name || people.includes(name)) { input.focus(); return; }
  people.push(name);
  input.value = '';
  saveState();
  renderPeople();
}

function removePerson(i) {
  people.splice(i, 1);
  saveState();
  renderPeople();
}

// ── Log tab ───────────────────────────────────────────────────────────────────
function renderLog() {
  const tbody = document.getElementById('log-body');
  if (!txLog.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="color:var(--text3);padding:1rem 13px;">No transactions yet.</td></tr>';
    return;
  }
  tbody.innerHTML = txLog.map(l => {
    let cls = 'log-out', label = 'OUT';
    if (l.type === 'in') { cls = 'log-in'; label = 'IN'; }
    else if (l.type === 'reserve') { cls = 'log-reserve'; label = 'RESERVE'; }
    else if (l.type === 'fulfill') { cls = 'log-fulfill'; label = 'FULFILL'; }
    return `<tr>
      <td style="color:var(--text3);">${l.time}</td>
      <td class="${cls}">${label}</td>
      <td>${l.name}</td>
      <td>${l.qty}</td>
      <td style="color:var(--text3);">${l.note}</td>
    </tr>`;
  }).join('');
}

function clearLog() {
  if (!confirm('Clear the entire log?')) return;
  txLog = []; saveState(); renderLog();
}

// ── Edit item ─────────────────────────────────────────────────────────────────
function openEditItem(id) {
  const item = getItem(id);
  if (!item) return;
  document.getElementById('edit-item-id').value = id;
  document.getElementById('edit-item-name').value = item.name;
  document.getElementById('edit-item-cat').value = item.cat;
  document.getElementById('edit-item-thresh').value = item.threshold;
  const urlInput = document.getElementById('edit-item-photo-url');
  const preview = document.getElementById('edit-item-preview');
  const noPhoto = document.getElementById('edit-item-no-photo');
  const removeBtn = document.getElementById('remove-photo-btn');
  if (item.photo) {
    urlInput.value = item.photo;
    preview.src = driveUrlToEmbed(item.photo);
    preview.style.display = 'block';
    noPhoto.style.display = 'none';
    removeBtn.style.display = '';
  } else {
    urlInput.value = '';
    preview.src = '';
    preview.style.display = 'none';
    noPhoto.style.display = '';
    removeBtn.style.display = 'none';
  }
  openModal('edit-item-modal');
}

// Convert any Google Drive share link to a direct image embed URL
function driveUrlToEmbed(url) {
  if (!url) return '';
  // Already a direct embed
  if (url.includes('drive.google.com/thumbnail') || url.includes('drive.google.com/uc')) return url;
  // Extract file ID from share URL formats:
  // https://drive.google.com/file/d/FILE_ID/view
  // https://drive.google.com/open?id=FILE_ID
  let fileId = null;
  const matchFile = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  const matchOpen = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (matchFile) fileId = matchFile[1];
  else if (matchOpen) fileId = matchOpen[1];
  if (fileId) return `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
  // Not a Drive URL — return as-is (could be a direct image URL)
  return url;
}

function previewDriveUrl(url) {
  const preview = document.getElementById('edit-item-preview');
  const noPhoto = document.getElementById('edit-item-no-photo');
  const removeBtn = document.getElementById('remove-photo-btn');
  const embed = driveUrlToEmbed(url.trim());
  if (embed) {
    preview.src = embed;
    preview.style.display = 'block';
    noPhoto.style.display = 'none';
    removeBtn.style.display = '';
  } else {
    preview.src = '';
    preview.style.display = 'none';
    noPhoto.style.display = '';
    removeBtn.style.display = 'none';
  }
}

function removePhoto() {
  document.getElementById('edit-item-photo-url').value = '';
  const preview = document.getElementById('edit-item-preview');
  const noPhoto = document.getElementById('edit-item-no-photo');
  const removeBtn = document.getElementById('remove-photo-btn');
  preview.src = '';
  preview.style.display = 'none';
  noPhoto.style.display = '';
  removeBtn.style.display = 'none';
}

function saveEditItem() {
  const id = document.getElementById('edit-item-id').value;
  const item = getItem(id);
  if (!item) return;
  const name = document.getElementById('edit-item-name').value.trim();
  const cat = document.getElementById('edit-item-cat').value.trim();
  if (!name) { document.getElementById('edit-item-name').focus(); return; }
  item.name = name;
  item.cat = cat || 'Uncategorized';
  item.threshold = Math.max(0, parseInt(document.getElementById('edit-item-thresh').value) || 0);
  // Save the original Drive URL (not the embed URL) so it can be re-converted later
  const urlInput = document.getElementById('edit-item-photo-url');
  item.photo = urlInput.value.trim() || null;
  saveState();
  pushToSheet();
  closeModal('edit-item-modal');
  renderStock();
  renderKitting();
}

function removeItemFromModal() {
  const id = document.getElementById('edit-item-id').value;
  if (!confirm('Remove this item from inventory?')) return;
  inventory = inventory.filter(i => i.id !== id);
  saveState();
  closeModal('edit-item-modal');
  renderStock();
  renderKitting();
}

// ── Lightbox ──────────────────────────────────────────────────────────────────
function openLightbox(itemId) {
  const item = getItem(itemId);
  if (!item || !item.photo) return;
  document.getElementById('lightbox-img').src = driveUrlToEmbed(item.photo);
  document.getElementById('lightbox').classList.add('open');
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open');
}

// ── Kit editor ────────────────────────────────────────────────────────────────
function openKitEditor(kitId) {
  const kit = KITS.find(k => k.id === kitId);
  if (!kit) return;
  document.getElementById('kit-editor-id').value = kit.id;
  document.getElementById('kit-editor-title').textContent = 'Edit kit — ' + kit.name;
  document.getElementById('kit-editor-name').value = kit.name;
  const linesDiv = document.getElementById('kit-editor-lines');
  linesDiv.innerHTML = '';
  kit.components.forEach(c => addKitEditorLine(c.id, c.qty));
  openModal('kit-editor-modal');
}

function openNewKitModal() {
  const newId = 'kit-' + Date.now();
  document.getElementById('kit-editor-id').value = newId;
  document.getElementById('kit-editor-title').textContent = 'New kit';
  document.getElementById('kit-editor-name').value = '';
  document.getElementById('kit-editor-lines').innerHTML = '';
  addKitEditorLine();
  openModal('kit-editor-modal');
}

function addKitEditorLine(selectedId, qty) {
  const options = inventory.map(i =>
    `<option value="${i.id}" ${i.id === selectedId ? 'selected' : ''}>${i.name}</option>`
  ).join('');
  const lineId = 'kel-' + Date.now() + '-' + Math.random().toString(36).slice(2,6);
  const div = document.createElement('div');
  div.className = 'order-line';
  div.id = lineId;
  div.innerHTML = `
    <select style="flex:1;padding:7px 9px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface);color:var(--text);font-size:13px;">${options}</select>
    <input type="number" value="${qty || 1}" min="1" style="width:72px;padding:7px 8px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface);color:var(--text);font-size:13px;text-align:center;">
    <button class="order-line-remove" onclick="document.getElementById('${lineId}').remove()">×</button>
  `;
  document.getElementById('kit-editor-lines').appendChild(div);
}

function saveKit() {
  const kitId = document.getElementById('kit-editor-id').value;
  const name = document.getElementById('kit-editor-name').value.trim();
  if (!name) { document.getElementById('kit-editor-name').focus(); return; }

  const components = [];
  document.querySelectorAll('#kit-editor-lines .order-line').forEach(row => {
    const sel = row.querySelector('select');
    const input = row.querySelector('input');
    const id = sel.value;
    const qty = parseInt(input.value) || 1;
    if (id) components.push({ id, qty });
  });
  if (!components.length) { alert('Add at least one component.'); return; }

  const existing = KITS.find(k => k.id === kitId);
  if (existing) {
    existing.name = name;
    existing.components = components;
  } else {
    KITS.push({ id: kitId, name, components });
    activeKitId = kitId;
  }

  saveState();
  closeModal('kit-editor-modal');
  renderKitting();
}

function deleteKit() {
  const kitId = document.getElementById('kit-editor-id').value;
  const kit = KITS.find(k => k.id === kitId);
  if (!kit) return;
  if (!confirm(`Delete kit "${kit.name}"? This cannot be undone.`)) return;
  const idx = KITS.indexOf(kit);
  KITS.splice(idx, 1);
  if (KITS.length > 0) activeKitId = KITS[0].id;
  saveState();
  closeModal('kit-editor-modal');
  renderKitting();
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function flashErr(el) {
  el.classList.add('error');
  setTimeout(() => el.classList.remove('error'), 900);
}

function renderAll() {
  renderStock();
  renderKitting();
  renderOrders();
  renderLog();
  renderPeople();
}

// ── Init ──────────────────────────────────────────────────────────────────────
loadState();
loadSheetUrl();
// Note: renderAll() is called by sync.js after data loads from Sheet.
// If no Sheet is connected, sync.js calls renderAll() immediately.
