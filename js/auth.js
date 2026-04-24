// ── Google Sign-In + allowlist enforcement ───────────────────────────────────
const GOOGLE_CLIENT_ID = '659988920387-5pn2hcd55sf4qsag2ra52qj58qdmm7tb.apps.googleusercontent.com';

let currentUser = null; // { email, name, idToken, tokenExpires }

function parseJwtPayload(idToken) {
  try {
    const payload = idToken.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch(e) { return null; }
}

async function onGoogleCredential(response) {
  const idToken = response.credential;
  const payload = parseJwtPayload(idToken);
  if (!payload) { showAuthError('Invalid sign-in token.'); return; }

  const pre = {
    email: (payload.email || '').toLowerCase(),
    name: payload.name || '',
    idToken,
    tokenExpires: (payload.exp || 0) * 1000
  };

  showAuthStatus('Checking access for ' + pre.email + '…');
  try {
    const url = typeof HARDCODED_SHEET_URL !== 'undefined' ? HARDCODED_SHEET_URL : '';
    if (!url) { showAuthError('App not configured.'); return; }
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'authorize', idToken })
    });
    const json = await res.json();
    if (json.status === 'ok' && json.allowed) {
      currentUser = pre;
      sessionStorage.setItem('dci_user', JSON.stringify(pre));
      hideAuthScreen();
      onAuthSuccess();
    } else {
      showAuthError('Access denied for ' + pre.email + '. Ask David to add your email.');
      if (typeof google !== 'undefined' && google.accounts) google.accounts.id.disableAutoSelect();
    }
  } catch(e) {
    showAuthError('Could not verify: ' + e.message);
  }
}

function showAuthScreen() {
  const o = document.getElementById('auth-overlay');
  const app = document.getElementById('app');
  if (o) o.style.display = 'flex';
  if (app) app.style.display = 'none';
}

function hideAuthScreen() {
  const o = document.getElementById('auth-overlay');
  const app = document.getElementById('app');
  if (o) o.style.display = 'none';
  if (app) app.style.display = 'flex';
}

function showAuthError(msg) {
  const e = document.getElementById('auth-error');
  const s = document.getElementById('auth-status');
  if (e) e.textContent = msg;
  if (s) s.textContent = '';
}

function showAuthStatus(msg) {
  const e = document.getElementById('auth-error');
  const s = document.getElementById('auth-status');
  if (e) e.textContent = '';
  if (s) s.textContent = msg;
}

function signOut() {
  currentUser = null;
  sessionStorage.removeItem('dci_user');
  if (typeof google !== 'undefined' && google.accounts) google.accounts.id.disableAutoSelect();
  location.reload();
}

function onAuthSuccess() {
  const el = document.getElementById('user-email');
  if (el) el.textContent = currentUser.email;
  if (typeof loadState === 'function') loadState();
  if (typeof loadSheetUrl === 'function') loadSheetUrl();
}

function initAuth() {
  const cached = sessionStorage.getItem('dci_user');
  if (cached) {
    try {
      const u = JSON.parse(cached);
      if (u && u.tokenExpires && u.tokenExpires > Date.now() + 30000) {
        currentUser = u;
        hideAuthScreen();
        onAuthSuccess();
        return;
      }
    } catch(e) {}
    sessionStorage.removeItem('dci_user');
  }

  showAuthScreen();
  if (typeof google === 'undefined' || !google.accounts) {
    showAuthError('Google sign-in failed to load. Check network and refresh.');
    return;
  }
  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: onGoogleCredential,
    auto_select: false
  });
  google.accounts.id.renderButton(
    document.getElementById('google-signin-btn'),
    { theme: 'outline', size: 'large', width: 260 }
  );
}

// GIS calls this once the library is ready
window.onGoogleLibraryLoad = initAuth;

// Fallback: if the library loaded before this script was parsed, init now
window.addEventListener('DOMContentLoaded', () => {
  if (typeof google !== 'undefined' && google.accounts && !currentUser) initAuth();
});
