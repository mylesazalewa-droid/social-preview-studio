const { app, BrowserWindow, ipcMain, dialog, nativeImage, Menu, safeStorage, net, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const APP_NAME = 'Social Preview Studio';
app.setName(APP_NAME);

// NOTE: Chrome's built-in on-device AI (LanguageModel / Gemini Nano) is NOT usable in
// Electron — the API exists but only echoes input, because the model ships via Google
// Chrome's proprietary component updater. Enabling its feature flags here just risks a
// crash in the (absent) optimization-guide service, so we don't. The app's AI back-end
// is the user's free Google Gemini key, proxied through the main process below.

let mainWindow;

if (process.platform === 'darwin') {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'build', 'icon.png'));
  if (!icon.isEmpty()) app.dock.setIcon(icon);
}

function buildMenu() {
  const template = [
    {
      label: APP_NAME,
      submenu: [
        { role: 'about', label: `About ${APP_NAME}` },
        { type: 'separator' },
        { role: 'hide', label: `Hide ${APP_NAME}` },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit', label: `Quit ${APP_NAME}` },
      ],
    },
    { label: 'Edit', role: 'editMenu' },
    { label: 'View', role: 'viewMenu' },
    { label: 'Window', role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

const boundsFile = path.join(app.getPath('userData'), 'window-bounds.json');
function readBounds() {
  try { return JSON.parse(fs.readFileSync(boundsFile, 'utf8')); } catch (e) { return null; }
}
function createWindow() {
  const saved = readBounds();
  const hasPos = saved && Number.isFinite(saved.x) && Number.isFinite(saved.y);
  mainWindow = new BrowserWindow({
    width: (saved && saved.width) || 1440,
    height: (saved && saved.height) || 936,
    ...(hasPos ? { x: saved.x, y: saved.y } : {}),
    center: !hasPos,
    minWidth: 1040,
    minHeight: 660,
    backgroundColor: '#00000000',
    vibrancy: 'under-window',
    visualEffectState: 'active',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 18 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  const persist = () => {
    try { fs.writeFileSync(boundsFile, JSON.stringify(mainWindow.getBounds())); } catch (e) {}
  };
  let t;
  mainWindow.on('resize', () => { clearTimeout(t); t = setTimeout(persist, 400); });
  mainWindow.on('move', () => { clearTimeout(t); t = setTimeout(persist, 400); });
  mainWindow.on('close', persist);
}

app.whenReady().then(() => {
  buildMenu();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// --- Export helpers -------------------------------------------------

// Save a single data-URL (png) to a chosen folder, given a filename.
ipcMain.handle('save-pngs', async (_evt, files) => {
  // files: [{ name: 'instagram-feed.png', dataUrl: 'data:image/png;base64,...' }]
  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose a folder to export PNGs into',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (res.canceled || !res.filePaths.length) return { ok: false, canceled: true };

  const dir = res.filePaths[0];
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const outDir = path.join(dir, `social-previews-${stamp}`);
  fs.mkdirSync(outDir, { recursive: true });

  const written = [];
  for (const f of files) {
    const b64 = f.dataUrl.replace(/^data:image\/\w+;base64,/, '');
    const p = path.join(outDir, f.name);
    fs.writeFileSync(p, Buffer.from(b64, 'base64'));
    written.push(p);
  }
  return { ok: true, dir: outDir, count: written.length };
});

// Save one binary blob (combined board png or pdf) via Save dialog.
ipcMain.handle('save-file', async (_evt, { defaultName, dataUrl, filters }) => {
  const res = await dialog.showSaveDialog(mainWindow, {
    title: 'Export',
    defaultPath: defaultName,
    filters: filters || [{ name: 'All Files', extensions: ['*'] }],
  });
  if (res.canceled || !res.filePath) return { ok: false, canceled: true };

  const b64 = dataUrl.replace(/^data:[^;]+;base64,/, '');
  fs.writeFileSync(res.filePath, Buffer.from(b64, 'base64'));
  return { ok: true, path: res.filePath };
});

// Save a UTF-8 text file (the shareable HTML review page) via Save dialog.
ipcMain.handle('save-text', async (_evt, { defaultName, text, filters }) => {
  const res = await dialog.showSaveDialog(mainWindow, {
    title: 'Export',
    defaultPath: defaultName,
    filters: filters || [{ name: 'HTML', extensions: ['html'] }],
  });
  if (res.canceled || !res.filePath) return { ok: false, canceled: true };
  fs.writeFileSync(res.filePath, text, 'utf8');
  return { ok: true, path: res.filePath };
});

// Save a whole folder of files (images + text) — the "Ready pack" export.
ipcMain.handle('save-bundle', async (_evt, { folderName, files }) => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose where to put the ready pack folder',
    buttonLabel: 'Save here',
    defaultPath: app.getPath('downloads'),
    properties: ['openDirectory', 'createDirectory'],
  });
  if (res.canceled || !res.filePaths.length) return { ok: false, canceled: true };

  const safeFolder = String(folderName || 'ready-pack').replace(/[^a-zA-Z0-9._-]/g, '-');
  // Never merge into an existing pack — pick a fresh name (" 2", " 3", …).
  let root = path.join(res.filePaths[0], safeFolder);
  for (let n = 2; fs.existsSync(root); n++) root = path.join(res.filePaths[0], `${safeFolder} ${n}`);
  fs.mkdirSync(root, { recursive: true });

  let count = 0;
  for (const f of files || []) {
    const rel = String(f.name || '').split('/').filter(Boolean);
    if (!rel.length || rel.some((s) => s === '..' || s === '.')) continue;
    const clean = rel.map((s) => s.replace(/[^a-zA-Z0-9._ -]/g, '_')).join(path.sep);
    const dest = path.join(root, clean);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (f.dataUrl) {
      const b64 = f.dataUrl.replace(/^data:[^;]+;base64,/, '');
      fs.writeFileSync(dest, Buffer.from(b64, 'base64'));
    } else {
      fs.writeFileSync(dest, f.text || '', 'utf8');
    }
    count++;
  }
  return { ok: true, dir: root, count };
});

// Read a UTF-8 text file the user picks (for "Restore backup").
ipcMain.handle('open-text', async (_evt, { filters }) => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose a backup file',
    properties: ['openFile'],
    filters: filters || [{ name: 'JSON', extensions: ['json'] }],
  });
  if (res.canceled || !res.filePaths.length) return { ok: false, canceled: true };
  try {
    return { ok: true, text: fs.readFileSync(res.filePaths[0], 'utf8'), path: res.filePaths[0] };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

// Open an external link in the user's browser. Only a small allow-list of URLs
// the app itself offers — never an arbitrary URL from page content.
const OPEN_LINKS = {
  'gemini-key': 'https://aistudio.google.com/app/apikey',
};
ipcMain.handle('open-link', async (_evt, { name }) => {
  const url = OPEN_LINKS[name];
  if (!url) return { ok: false };
  await shell.openExternal(url);
  return { ok: true };
});

// Open a URL the app itself generated (e.g. a review link from our own
// backend). Restricted to http/https so this can't be used to open arbitrary
// file:// or other schemes from page content.
ipcMain.handle('open-url', async (_evt, { url }) => {
  try {
    const u = new URL(String(url || ''));
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return { ok: false };
    await shell.openExternal(u.toString());
    return { ok: true };
  } catch (e) { return { ok: false }; }
});

// --- Review link (hosted, no Claude in the loop) ---------------------
// A small Vercel backend stores the post + comments; the app posts a
// payload, gets back a shareable /r/<id> link, and polls for comments.
const REVIEW_API = 'https://project-e9asj.vercel.app';

ipcMain.handle('publish-post', async (_evt, payload) => {
  try {
    const r = await net.fetch(`${REVIEW_API}/api/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.ok) return { ok: false, error: data.error || `HTTP ${r.status}` };
    return { ok: true, id: data.id, url: data.url };
  } catch (e) {
    return { ok: false, error: 'Could not reach the review service — check your connection.' };
  }
});

ipcMain.handle('fetch-comments', async (_evt, { id }) => {
  try {
    const r = await net.fetch(`${REVIEW_API}/api/post?id=${encodeURIComponent(id || '')}`);
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.ok) return { ok: false, error: data.error || `HTTP ${r.status}` };
    return { ok: true, post: data.post, comments: data.comments };
  } catch (e) {
    return { ok: false, error: 'Could not reach the review service — check your connection.' };
  }
});

// --- AI: encrypted key storage + Gemini proxy -----------------------
// The API key is stored encrypted in userData (never in localStorage, never in
// the renderer). All network calls are made here in the main process, so the
// renderer's strict CSP is untouched and the key is never exposed to page code.
const keyFile = path.join(app.getPath('userData'), 'ai-key.bin');

function readKey() {
  try {
    if (!fs.existsSync(keyFile)) return '';
    const buf = fs.readFileSync(keyFile);
    if (safeStorage.isEncryptionAvailable()) return safeStorage.decryptString(buf);
    return buf.toString('utf8'); // fallback (rare: no OS keychain)
  } catch (e) { return ''; }
}

ipcMain.handle('ai-key-set', async (_evt, { key }) => {
  const k = String(key || '').trim();
  try {
    if (!k) { if (fs.existsSync(keyFile)) fs.unlinkSync(keyFile); return { ok: true, hasKey: false }; }
    const data = safeStorage.isEncryptionAvailable()
      ? safeStorage.encryptString(k) : Buffer.from(k, 'utf8');
    fs.writeFileSync(keyFile, data);
    return { ok: true, hasKey: true };
  } catch (e) { return { ok: false, error: String(e) }; }
});

ipcMain.handle('ai-key-status', async () => ({ hasKey: !!readKey() }));

ipcMain.handle('ai-key-clear', async () => {
  try { if (fs.existsSync(keyFile)) fs.unlinkSync(keyFile); } catch (e) {}
  return { ok: true };
});

// Test a key without storing it — used by the "Connect" flow.
ipcMain.handle('ai-key-test', async (_evt, { key }) => {
  const k = String(key || '').trim();
  if (!k) return { ok: false, error: 'No key given' };
  try {
    const r = await net.fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(k)}`
    );
    if (r.ok) return { ok: true };
    const body = await r.text();
    return { ok: false, error: `Key rejected (${r.status})`, detail: body.slice(0, 300) };
  } catch (e) { return { ok: false, error: 'Could not reach Google — check your connection' }; }
});

// One Gemini generateContent call. `parts` is the Gemini content-parts array
// (text and/or { inlineData: { mimeType, data } } for images). Returns plain text.
// Model names change over time, so we try a chain and cache the one that works.
const GEMINI_MODELS = [
  'gemini-flash-latest',   // Google's rolling alias — should always exist
  'gemini-3.6-flash', 'gemini-3-flash', 'gemini-2.5-flash', 'gemini-2.0-flash',
];
let _geminiModel = null; // the one we've confirmed works with this key

async function callGemini(key, mdl, payload) {
  const r = await net.fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${mdl}:generateContent?key=${encodeURIComponent(key)}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
  );
  const data = await r.json().catch(() => ({}));
  return { status: r.status, ok: r.ok, data };
}
const isModelGone = (status, msg) =>
  status === 404 || /no longer available|not found|not supported|update your code|is not found for API/i.test(msg || '');

ipcMain.handle('ai-gemini', async (_evt, { model, parts, system, json, temperature }) => {
  const key = readKey();
  if (!key) return { ok: false, error: 'no-key' };

  const payload = {
    contents: [{ role: 'user', parts: Array.isArray(parts) ? parts : [{ text: String(parts || '') }] }],
    generationConfig: {
      temperature: typeof temperature === 'number' ? temperature : 0.7,
      ...(json ? { responseMimeType: 'application/json' } : {}),
    },
  };
  if (system) payload.systemInstruction = { parts: [{ text: String(system) }] };

  // try the known-good model first, then the chain
  const tryOrder = [model, _geminiModel, ...GEMINI_MODELS].filter((m, i, a) => m && a.indexOf(m) === i);
  let lastErr = 'The AI request failed.';
  try {
    for (const mdl of tryOrder) {
      const { status, ok, data } = await callGemini(key, mdl, payload);
      if (ok) {
        _geminiModel = mdl;
        const cand = data.candidates && data.candidates[0];
        const text = cand && cand.content && cand.content.parts
          ? cand.content.parts.map((p) => p.text || '').join('') : '';
        if (!text) {
          const why = cand && cand.finishReason;
          return { ok: false, error: why === 'SAFETY' ? 'The model declined this request.' : 'Empty response' };
        }
        return { ok: true, text, model: mdl };
      }
      lastErr = (data && data.error && data.error.message) || `HTTP ${status}`;
      if (!isModelGone(status, lastErr)) return { ok: false, error: lastErr }; // real error — stop
      // else: model retired, try the next one
    }
    return { ok: false, error: lastErr };
  } catch (e) {
    return { ok: false, error: 'Could not reach Google — check your connection' };
  }
});
