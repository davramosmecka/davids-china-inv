# Mecka AI — China Production Inventory v2

Stock management, kitting runs, and order tracking with Google Sheets sync.

---

## Deploy to GitHub Pages (~5 min)

1. Go to github.com → **New repository** → name it `mecka-inventory` → Create
2. Upload all files maintaining the folder structure:
   ```
   index.html
   css/style.css
   js/data.js
   js/sync.js
   js/app.js
   ```
3. **Settings → Pages** → Source: main branch, root folder → Save
4. Live at: `https://YOUR_USERNAME.github.io/mecka-inventory/`

---

## Connect Google Sheets

1. Create a Google Sheet with three tabs named exactly: **Inventory**, **Orders**, **Log**
2. **Extensions → Apps Script** → paste `google-apps-script.js` → Save
3. **Deploy → New deployment** → Web app → Execute as: Me → Access: Anyone → Deploy
4. Copy the Web App URL
5. In the app: **Settings → Web App URL** → paste → Save & test

Syncs automatically every 60 seconds.

---

## How orders work

1. **+ New order** — select a person, add items + quantities, place order
2. Stock is **reserved** (shown as "committed" on stock cards) but NOT deducted yet
3. When you're ready to ship: hit **Fulfill** on the order card — stock is deducted and order marked complete
4. **Cancel** releases the reservation back to available stock

### People management
Go to **Settings → People** to add or remove names from the order person dropdown.
Default people loaded: Brian, Julia, Evan Neff, Evan Chen, Armita, Tyler, Peter.

---

## Files

```
mecka-inventory/
├── index.html
├── css/style.css
├── js/
│   ├── data.js              State, inventory items, kit definitions
│   ├── sync.js              Google Sheets sync
│   └── app.js               All UI logic (stock, kitting, orders, log, settings)
├── google-apps-script.js    Paste into Google Apps Script
└── README.md
```

---

v2 — David Ramos / Mecka AI
