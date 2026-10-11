/* Social Preview Studio — renderer */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };
  const raf = () => new Promise((r) => requestAnimationFrame(() => r()));
  const ICONS = window.ICONS;
  const PLATFORMS = window.PLATFORMS;
  const RATIO_CSS = {
    '1:1': '1 / 1',
    '4:5': '4 / 5',
    '9:16': '9 / 16',
    '16:9': '16 / 9',
    '1.91:1': '1.91 / 1',
  };

  const uid = (p) => (p || 'x') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const todayISO = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  };

  const state = {
    slides: [], // [{ src, type:'image'|'video', focal:{x,y}, poster?, alt? }]
    slideOverride: {}, // { [pid]: [ ...slides ] } — format-specific images per placement
    active: 0,
    fit: 'cover',
    pad: '#000000',
    caption: '',
    captionOverride: {}, // { [pid]: string } — per-platform caption text
    captionTarget: 'master', // which caption the editor is editing
    hashtags: '',      // appended to the caption per platform
    firstComment: '',  // shown as the "first comment" on IG / LinkedIn
    safe: false,
    appTheme: 'dark',      // 'dark' | 'light' — the app's own chrome
    previewTheme: 'light', // 'light' | 'dark' — the mock UI chrome in previews
    device: 'mobile',      // 'mobile' | 'desktop' — app chrome vs web chrome
    deviceFrame: true,     // focus mode: draw the preview inside a phone / computer mock
    feedContext: false,    // focus mode: show a faded feed above / below
    view: 'focus', // 'focus' | 'board' | 'calendar'
    calView: 'month', // 'month' | 'week' | 'list'
    calFilter: 'all', // brand id | 'all'
    calSearch: '',
    focusPid: null, // placement shown in focus mode
    posts: [],
    trash: [],
    recent: [],       // recent image data URLs
    editingId: null,
    pendingTitle: '', // custom project name set before the post has been saved yet
    calMonth: (() => { const d = new Date(); d.setDate(1); return d; })(),
    expanded: new Set(), // platform ids whose caption is expanded via "more"
    enabled: new Set(PLATFORMS.map((p) => p.id)),
    ratio: Object.fromEntries(PLATFORMS.map((p) => [p.id, p.defaultRatio])),
    // brand kits — flat name/handle/avatar/link/feedbackEmail mirror the current brand
    brands: [{ id: 'b1', name: 'Your Brand', handle: '@yourbrand', avatar: null, link: '', feedbackEmail: '' }],
    brandId: 'b1',
    name: 'Your Brand', handle: '@yourbrand', avatar: null, link: '', feedbackEmail: '',
    hashtagSets: [], // [{ id, label, tags }]
    templates: [], // [{ id, name, createdAt, snap }] — reusable post setups (no photo)
    sidebarW: 300,
    undo: [], redo: [],
    compareItems: [], // Compare tool: [{ id, img }] — any number of candidate images
    comparePlatform: 'ig-feed', // which platform mock previews them
    compareCaption: '', compareHashtags: '', // independent of the main post's caption/hashtags
    // Auto Clip tool: never saved to a post — a video lives on disk and is
    // only ever referenced by path (see main.js's video-* handlers).
    autoClip: {
      path: '', name: '', duration: 0,
      status: 'idle', // 'idle' | 'extracting' | 'analyzing' | 'ready' | 'rendering'
      segments: [], // [{ id, start, end, transcript, why, score, selected, thumb }]
    },
  };
  let dragFrom = null;

  /* ---------- brand kits ---------- */
  function currentBrand() {
    return state.brands.find((b) => b.id === state.brandId) || state.brands[0];
  }
  function applyBrand() {
    const b = currentBrand();
    if (!b) return;
    state.name = b.name || 'Your Brand';
    state.handle = b.handle || '@yourbrand';
    state.avatar = b.avatar || null;
    state.link = b.link || '';
    state.feedbackEmail = b.feedbackEmail || '';
  }
  function updateBrandField(k, v) {
    const b = currentBrand();
    if (b) b[k] = v;
    if (k === 'name') state.name = v || 'Your Brand';
    else if (k === 'handle') state.handle = v || '@yourbrand';
    else state[k] = v;
  }

  const enabledList = () => PLATFORMS.filter((p) => state.enabled.has(p.id));
  function focusPlatform() {
    const list = enabledList();
    if (!list.length) return null;
    let p = list.find((x) => x.id === state.focusPid);
    if (!p) { p = list[0]; state.focusPid = p.id; }
    return p;
  }

  /* ---------- persistence ---------- */
  const SETTINGS_KEY = 'sps.settings.v1';
  const POSTS_KEY = 'sps.posts.v1';
  const TRASH_KEY = 'sps.trash.v1';
  const RECENT_KEY = 'sps.recent.v1';
  const TEMPLATES_KEY = 'sps.templates.v1';

  function settingsBlob() {
    return {
      fit: state.fit, pad: state.pad, safe: state.safe,
      appTheme: state.appTheme,
      previewTheme: state.previewTheme, feedContext: state.feedContext,
      device: state.device, deviceFrame: state.deviceFrame,
      enabled: [...state.enabled], ratio: state.ratio,
      caption: state.caption, captionOverride: state.captionOverride,
      hashtags: state.hashtags, firstComment: state.firstComment,
      brands: state.brands, brandId: state.brandId,
      hashtagSets: state.hashtagSets, sidebarW: state.sidebarW,
    };
  }
  function saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settingsBlob())); }
    catch (e) { /* private mode / quota */ }
  }
  function loadSettings() {
    let s;
    try { s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null'); } catch (e) { s = null; }
    if (!s) return;
    if (s.fit === 'cover' || s.fit === 'contain') state.fit = s.fit;
    if (typeof s.pad === 'string') state.pad = s.pad;
    if (typeof s.safe === 'boolean') state.safe = s.safe;
    if (s.appTheme === 'light' || s.appTheme === 'dark') state.appTheme = s.appTheme;
    if (s.previewTheme === 'light' || s.previewTheme === 'dark') state.previewTheme = s.previewTheme;
    if (s.device === 'mobile' || s.device === 'desktop') state.device = s.device;
    if (typeof s.deviceFrame === 'boolean') state.deviceFrame = s.deviceFrame;
    if (typeof s.feedContext === 'boolean') state.feedContext = s.feedContext;
    if (typeof s.caption === 'string') state.caption = s.caption;
    if (typeof s.hashtags === 'string') state.hashtags = s.hashtags;
    if (typeof s.firstComment === 'string') state.firstComment = s.firstComment;
    if (typeof s.sidebarW === 'number') state.sidebarW = Math.min(460, Math.max(260, s.sidebarW));
    if (s.captionOverride && typeof s.captionOverride === 'object') {
      for (const [k, v] of Object.entries(s.captionOverride)) {
        if (typeof v === 'string' && PLATFORMS.some((p) => p.id === k)) state.captionOverride[k] = v;
      }
    }
    if (Array.isArray(s.enabled)) {
      const en = s.enabled.filter((id) => PLATFORMS.some((p) => p.id === id));
      if (en.length) state.enabled = new Set(en);
    }
    if (s.ratio && typeof s.ratio === 'object') {
      PLATFORMS.forEach((p) => {
        if (p.ratios.includes(s.ratio[p.id])) state.ratio[p.id] = s.ratio[p.id];
      });
    }
    if (Array.isArray(s.hashtagSets)) state.hashtagSets = s.hashtagSets.filter((x) => x && x.id);
    // brands (with migration from the old flat fields)
    if (Array.isArray(s.brands) && s.brands.length) {
      state.brands = s.brands.filter((b) => b && b.id);
      state.brandId = state.brands.some((b) => b.id === s.brandId) ? s.brandId : state.brands[0].id;
    } else {
      state.brands = [{
        id: 'b1',
        name: typeof s.name === 'string' ? s.name : 'Your Brand',
        handle: typeof s.handle === 'string' ? s.handle : '@yourbrand',
        avatar: typeof s.avatar === 'string' ? s.avatar : null,
        link: typeof s.link === 'string' ? s.link : '',
        feedbackEmail: typeof s.feedbackEmail === 'string' ? s.feedbackEmail : '',
      }];
      state.brandId = 'b1';
    }
    applyBrand();
  }
  function loadPosts() {
    try {
      const a = JSON.parse(localStorage.getItem(POSTS_KEY) || '[]');
      if (Array.isArray(a)) state.posts = a;
    } catch (e) { state.posts = []; }
    try {
      const t = JSON.parse(localStorage.getItem(TRASH_KEY) || '[]');
      if (Array.isArray(t)) state.trash = t;
    } catch (e) { state.trash = []; }
    try {
      const r = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      if (Array.isArray(r)) state.recent = r;
    } catch (e) { state.recent = []; }
    try {
      const tpl = JSON.parse(localStorage.getItem(TEMPLATES_KEY) || '[]');
      if (Array.isArray(tpl)) state.templates = tpl.filter((x) => x && x.id && x.snap);
    } catch (e) { state.templates = []; }
  }
  function persistPosts() {
    try { localStorage.setItem(POSTS_KEY, JSON.stringify(state.posts)); } catch (e) { toast('Storage full — could not save'); }
    try { localStorage.setItem(TRASH_KEY, JSON.stringify(state.trash.slice(-40))); } catch (e) {}
  }
  function persistTemplates() {
    try { localStorage.setItem(TEMPLATES_KEY, JSON.stringify(state.templates)); }
    catch (e) { toast('Storage full — could not save template'); }
  }
  function persistRecent() {
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(state.recent.slice(0, 14))); } catch (e) {}
  }
  function pushRecent(src) {
    if (!src || src.startsWith('data:video')) return;
    state.recent = [src, ...state.recent.filter((x) => x !== src)].slice(0, 14);
    persistRecent();
  }

  /* ---------- backup / restore ---------- */
  async function exportBackup() {
    const blob = {
      _app: 'social-preview-studio', _v: 1, at: new Date().toISOString(),
      settings: settingsBlob(), posts: state.posts, trash: state.trash, recent: state.recent,
      templates: state.templates,
    };
    const json = JSON.stringify(blob);
    const dataUrl = 'data:application/json;base64,' + btoa(unescape(encodeURIComponent(json)));
    const r = await window.api.saveFile({
      defaultName: `social-preview-studio-backup-${todayISO()}.json`,
      dataUrl, filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (r.ok) toast('Backup saved → ' + r.path);
  }
  async function importBackup() {
    const r = await window.api.openText({ filters: [{ name: 'JSON', extensions: ['json'] }] });
    if (r.canceled) return;
    if (!r.ok) return toast('Could not read that file');
    let blob;
    try { blob = JSON.parse(r.text); } catch (e) { return toast('That is not a valid backup file'); }
    if (blob._app !== 'social-preview-studio') return toast('That is not a Social Preview Studio backup');
    try {
      if (blob.settings) localStorage.setItem(SETTINGS_KEY, JSON.stringify(blob.settings));
      if (Array.isArray(blob.posts)) localStorage.setItem(POSTS_KEY, JSON.stringify(blob.posts));
      if (Array.isArray(blob.trash)) localStorage.setItem(TRASH_KEY, JSON.stringify(blob.trash));
      if (Array.isArray(blob.recent)) localStorage.setItem(RECENT_KEY, JSON.stringify(blob.recent));
      if (Array.isArray(blob.templates)) localStorage.setItem(TEMPLATES_KEY, JSON.stringify(blob.templates));
    } catch (e) { return toast('Restore failed — storage error'); }
    toast('Backup restored — reloading…');
    setTimeout(() => location.reload(), 700);
  }

  /* ---------- slide helpers ---------- */
  function activeIndex() {
    const n = state.slides.length;
    if (n === 0) return -1;
    if (state.active >= n) state.active = n - 1;
    if (state.active < 0) state.active = 0;
    return state.active;
  }

  // Downscale very large images on import — keeps previews sharp and exports fast.
  // 2560px longest edge covers every placement's production size (max 1920) with
  // headroom, so the Ready pack stays crisp.
  function normalizeImage(dataUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 2560;
        const long = Math.max(img.width, img.height);
        if (long <= MAX && dataUrl.length < 2600000) return resolve(dataUrl);
        const s = MAX / long;
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * s);
        c.height = Math.round(img.height * s);
        const ctx = c.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, c.width, c.height);
        try { resolve(c.toDataURL('image/jpeg', 0.92)); }
        catch (e) { resolve(dataUrl); }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  function addFiles(fileList) {
    const imgs = [...fileList].filter((f) => f.type && f.type.startsWith('image/'));
    if (!imgs.length) return;
    const cap = 30;
    const room = Math.max(0, cap - state.slides.length);
    const take = imgs.slice(0, room);
    if (!take.length) return toast(`Limit is ${cap} images`);
    const slots = new Array(take.length).fill(null);
    let pending = take.length;
    take.forEach((f, i) => {
      const fr = new FileReader();
      fr.onload = async () => {
        slots[i] = await normalizeImage(fr.result);
        if (--pending === 0) {
          slots.forEach((src) => state.slides.push({ src, focal: { x: 50, y: 50 }, alt: '' }));
          state.active = state.slides.length - slots.length;
          render();
        }
      };
      fr.readAsDataURL(f);
    });
  }

  function removeSlide(i) {
    state.slides.splice(i, 1);
    if (state.active > i) state.active--;
    render();
  }

  // Read files into a placement's format-specific image set.
  function addFmtFiles(pid, fileList) {
    const imgs = [...fileList].filter((f) => f.type && f.type.startsWith('image/'));
    if (!imgs.length) return;
    const p = PLATFORMS.find((x) => x.id === pid);
    const maxN = (p && p.slides && p.slides !== 'single') ? (p.maxSlides || 10) : 1;
    const take = imgs.slice(0, maxN);
    const slots = new Array(take.length).fill(null);
    let pending = take.length;
    take.forEach((f, i) => {
      const fr = new FileReader();
      fr.onload = async () => {
        slots[i] = await normalizeImage(fr.result);
        if (--pending === 0) {
          state.slideOverride[pid] = slots.map((src) => ({ src, focal: { x: 50, y: 50 }, alt: '' }));
          render();
          toast(`Custom image set for ${platformName(p)}`);
        }
      };
      fr.readAsDataURL(f);
    });
  }

  function moveSlide(from, to) {
    if (from == null || from === to) return;
    const [s] = state.slides.splice(from, 1);
    state.slides.splice(to, 0, s);
    state.active = to;
    render();
  }

  /* ---------- generic helpers ---------- */
  function toast(msg, ms = 2800, action, actionLabel) {
    const t = $('#toast');
    t.innerHTML = '';
    t.appendChild(document.createTextNode(msg));
    if (action) {
      const b = el('button', 'toast-act', actionLabel || 'Undo');
      b.addEventListener('click', () => { t.classList.remove('show'); action(); });
      t.appendChild(b);
    }
    requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), ms);
  }

  function overlay(on, text) {
    const o = $('#overlay');
    if (text) $('#overlayText').textContent = text;
    o.classList.toggle('show', !!on);
  }

  function truncate(text, rule) {
    if (!rule || !rule.truncateAt || text.length <= rule.truncateAt)
      return { shown: text, cut: false };
    let s = text.slice(0, rule.truncateAt);
    s = s.replace(/\s+\S*$/, '');
    return { shown: s, cut: true };
  }

  // Effective caption text for a platform: its override if set, else the master,
  // with the shared hashtag block appended (platforms that don't do hashtags skip it).
  const HASHTAG_OK = new Set(['ig-feed', 'ig-story', 'ig-reel', 'tiktok', 'li-feed', 'fb-feed']);
  function capBase(pid) {
    const o = (state.captionOverride[pid] || '').trim();
    return o ? state.captionOverride[pid] : state.caption;
  }
  function capFor(pid) {
    let t = capBase(pid);
    const tags = state.hashtags.trim();
    if (tags && HASHTAG_OK.has(pid)) t = (t.trim() ? t.trim() + '\n\n' : '') + tags;
    return t;
  }
  function hasOverride(pid) {
    return !!(state.captionOverride[pid] && state.captionOverride[pid].trim());
  }
  // The text currently loaded in the editor (for the char count + cut-off meter).
  function editedCaption() {
    if (state.captionTarget === 'master') {
      const tags = state.hashtags.trim();
      return state.caption + (tags ? '\n\n' + tags : '');
    }
    return capFor(state.captionTarget);
  }

  // caption rules for the current device view (web columns show more than the app)
  function capRule(p) {
    return (state.device === 'desktop' && p.captionDesktop) ? p.captionDesktop : (p.caption || {});
  }

  function captionHtml(p) {
    const rule = capRule(p);
    const text = capFor(p.id).trim();
    if (!text) return '<span class="muted">No caption yet</span>';
    const br = (s) => escapeHtml(s).replace(/\n/g, '<br>');
    const { shown, cut } = truncate(text, rule);
    if (!cut) return br(text);
    if (state.expanded.has(p.id)) {
      return br(text) + ' <span class="more" role="button">show less</span>';
    }
    return br(shown) + `<span class="more" role="button"> … ${escapeHtml(rule.moreLabel || 'more')}</span>`;
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  /* ---------- media ---------- */
  function slideImg(slide) {
    const img = el('img');
    img.src = slide.src;
    img.alt = slide.alt || '';
    if (state.fit === 'contain') {
      img.style.objectFit = 'contain';
    } else {
      img.style.objectFit = 'cover';
      img.style.objectPosition = `${slide.focal.x}% ${slide.focal.y}%`;
    }
    return img;
  }

  function mediaNode(ratio, idx) {
    const wrap = el('div', 'media');
    wrap.style.aspectRatio = RATIO_CSS[ratio] || '1 / 1';
    const i = idx == null ? activeIndex() : idx;
    const s = state.slides[i];
    if (!s) {
      wrap.classList.add('media-empty');
      return wrap;
    }
    if (state.fit === 'contain') wrap.style.background = state.pad;
    wrap.appendChild(slideImg(s));
    return wrap;
  }

  // media + carousel count badge, for "swipe" platforms
  function swipeMedia(ratio) {
    const holder = el('div', 'swipe');
    const idx = activeIndex();
    holder.appendChild(mediaNode(ratio, idx));
    const n = state.slides.length;
    if (n > 1) holder.appendChild(el('span', 'swipe-count', `${idx + 1}/${n}`));
    return holder;
  }

  function carouselDots() {
    const n = state.slides.length;
    if (n < 2) return null;
    const idx = activeIndex();
    const d = el('div', 'dots');
    for (let i = 0; i < Math.min(n, 12); i++) {
      const dot = el('span', 'dot' + (i === idx ? ' on' : ''));
      dot.addEventListener('click', () => { state.active = i; render(); });
      d.appendChild(dot);
    }
    return d;
  }

  // X-style 2–4 image mosaic
  function mosaicNode(ratio) {
    const n = Math.min(state.slides.length, 4);
    if (n <= 1) return mediaNode(ratio);
    const g = el('div', 'mosaic m-' + n);
    for (let i = 0; i < n; i++) {
      const cell = el('div', 'm-cell');
      cell.appendChild(slideImg(state.slides[i]));
      g.appendChild(cell);
    }
    return g;
  }

  // Facebook-style collage (1 big + grid, "+N" on overflow)
  function collageNode(ratio) {
    const total = state.slides.length;
    if (total <= 1) return mediaNode(ratio);
    const n = Math.min(total, 4);
    const g = el('div', 'collage c-' + n);
    for (let i = 0; i < n; i++) {
      const cell = el('div', 'm-cell');
      cell.appendChild(slideImg(state.slides[i]));
      if (i === n - 1 && total > n) cell.appendChild(el('div', 'c-more', '+' + (total - n)));
      g.appendChild(cell);
    }
    return g;
  }

  // Safe-area guide: where each platform's own UI actually sits over the image.
  // Values are % of the media frame, tuned to each app's real layout.
  const SAFE_ZONES = {
    'ig-story': [
      { top: '0', left: '0', right: '0', height: '9%', label: 'name' },
      { bottom: '0', left: '0', right: '0', height: '8%', label: 'reply bar' },
    ],
    'ig-reel': [
      { top: '0', left: '0', right: '0', height: '7%', label: 'top' },
      { top: '50%', right: '0', width: '15%', bottom: '11%', label: 'buttons' },
      { bottom: '0', left: '0', right: '16%', height: '21%', label: 'caption' },
    ],
    tiktok: [
      { top: '0', left: '30%', right: '30%', height: '6%', label: 'tabs' },
      { top: '42%', right: '0', width: '16%', bottom: '9%', label: 'buttons' },
      { bottom: '0', left: '0', right: '17%', height: '20%', label: 'caption' },
    ],
    'yt-shorts': [
      { top: '0', right: '0', width: '16%', height: '7%', label: 'top' },
      { top: '46%', right: '0', width: '15%', bottom: '15%', label: 'buttons' },
      { bottom: '0', left: '0', right: '16%', height: '16%', label: 'title' },
    ],
    'yt-thumb': [
      { bottom: '5%', right: '3%', width: '12%', height: '10%', label: 'duration' },
    ],
  };
  const SAFE_FALLBACK = {
    fullbleed: [
      { top: '0', left: '0', right: '0', height: '9%', label: 'name' },
      { top: '46%', right: '0', width: '15%', bottom: '11%', label: 'buttons' },
      { bottom: '0', left: '0', right: '16%', height: '20%', label: 'caption' },
    ],
  };
  function safeOverlay(p) {
    if (!state.safe) return null;
    const zones = SAFE_ZONES[p.id] || SAFE_FALLBACK[p.kind];
    if (!zones) return null;
    const s = el('div', 'safe');
    zones.forEach((z) => {
      const d = el('div', 'safe-zone');
      ['top', 'left', 'right', 'bottom', 'width', 'height'].forEach((k) => {
        if (z[k] != null) d.style[k] = z[k];
      });
      d.appendChild(el('span', 'safe-label', z.label));
      s.appendChild(d);
    });
    s.appendChild(el('div', 'safe-inset'));
    return s;
  }

  function avatarNode(size) {
    const a = el('div', 'avatar');
    a.style.width = a.style.height = size + 'px';
    if (state.avatar) {
      const img = el('img');
      img.src = state.avatar;
      a.appendChild(img);
    } else {
      a.textContent = (state.name.trim()[0] || 'B').toUpperCase();
    }
    return a;
  }

  function actionRow(icons) {
    const r = el('div', 'actions');
    icons.forEach((k) => {
      const b = el('span', 'act');
      b.innerHTML = ICONS[k] || '';
      r.appendChild(b);
    });
    return r;
  }

  /* ---------- per-placement images ---------- */
  // The images a placement should render: its own format-specific set if it has
  // one, otherwise the master set.
  function slidesFor(pid) {
    const ov = state.slideOverride[pid];
    return (ov && ov.length) ? ov : state.slides;
  }
  function hasImageOverride(pid) {
    return !!(state.slideOverride[pid] && state.slideOverride[pid].length);
  }

  /* ---------- card builders ---------- */
  function buildCard(p) {
    // render this card against its format-specific images, if any
    const ov = state.slideOverride[p.id];
    const swap = ov && ov.length;
    const savedSlides = state.slides;
    const savedActive = state.active;
    if (swap) {
      state.slides = ov;
      state.active = Math.min(state.active, ov.length - 1);
    }
    try {
      return buildCardInner(p);
    } finally {
      if (swap) { state.slides = savedSlides; state.active = savedActive; }
    }
  }

  function buildCardInner(p) {
    const card = el('div', 'card');
    card.dataset.id = p.id;

    const label = el('div', 'card-label');
    const pill = el('span', 'pill');
    pill.style.background = p.accent;
    pill.textContent = `${p.name} · ${p.placement}`;
    label.appendChild(pill);

    if (p.ratios.length > 1) {
      const seg = el('div', 'seg');
      p.ratios.forEach((r) => {
        const b = el('button', r === state.ratio[p.id] ? 'on' : null, r);
        b.addEventListener('click', () => {
          state.ratio[p.id] = r;
          render();
        });
        seg.appendChild(b);
      });
      label.appendChild(seg);
    }

    if (p.slides && p.slides !== 'single' && state.slides.length > 1) {
      const tag = el('span', 'carousel-tag');
      const shown = p.slides === 'mosaic' || p.slides === 'collage'
        ? Math.min(state.slides.length, p.maxSlides || 4)
        : state.slides.length;
      tag.textContent = p.slides === 'swipe' ? `carousel ×${shown}` : `${shown}-up`;
      label.appendChild(tag);
    }

    if (hasImageOverride(p.id)) {
      const t = el('span', 'carousel-tag cap-custom');
      t.textContent = 'custom image';
      t.title = 'This placement has its own format-specific image(s)';
      label.appendChild(t);
    }

    if (hasOverride(p.id)) {
      const t = el('span', 'carousel-tag cap-custom');
      t.textContent = 'custom description';
      t.title = 'This placement has its own description — click to edit';
      t.addEventListener('click', () => { setCaptionTarget(p.id); });
      label.appendChild(t);
    }

    const limitRule = capRule(p);
    if (limitRule.hardLimit || limitRule.recommended) {
      const n = capFor(p.id).trim().length;
      const cap = limitRule.hardLimit || limitRule.recommended;
      const c = el('span', 'mini-count');
      c.textContent = `${n}/${cap}`;
      if (limitRule.hardLimit && n > limitRule.hardLimit) c.classList.add('over');
      else if (limitRule.recommended && n > limitRule.recommended) c.classList.add('warn');
      label.appendChild(c);
    }

    const capture = el('div', 'capture kind-' + p.kind);
    capture.dataset.platform = p.id;

    if (p.kind === 'feed') buildFeed(capture, p);
    else if (p.kind === 'fullbleed') buildFullbleed(capture, p);
    else if (p.kind === 'thumbnail') buildThumb(capture, p);

    card.appendChild(label);
    card.appendChild(capture);
    return card;
  }

  function header(p, opts = {}) {
    const h = el('div', 'p-head');
    h.appendChild(avatarNode(opts.avatar || 34));
    const meta = el('div', 'p-meta');
    const line1 = el('div', 'p-name');
    line1.textContent = state.name;
    if (opts.verified) line1.insertAdjacentHTML('beforeend', `<span class="vf">${ICONS.verified}</span>`);
    const line2 = el('div', 'p-sub');
    line2.textContent = opts.sub != null ? opts.sub : state.handle;
    meta.appendChild(line1);
    if (!opts.hideSub) meta.appendChild(line2);
    h.appendChild(meta);
    if (!opts.noDots) h.insertAdjacentHTML('beforeend', `<span class="p-dots">${ICONS.dots}</span>`);
    return h;
  }

  function buildFeed(root, p) {
    const ratio = state.ratio[p.id];

    if (p.id === 'x') {
      root.appendChild(header(p, { sub: `${state.handle} · 2h`, verified: true }));
      const body = el('div', 'x-body');
      if (capFor(p.id).trim())
        body.appendChild(el('div', 'p-caption', captionHtml(p)));
      body.appendChild(mosaicNode(ratio));
      if (state.link.trim() && state.slides.length < 2) body.appendChild(linkCard(p));
      root.appendChild(body);
      root.appendChild(actionRow(['comment', 'retweet', 'heart', 'bookmark', 'send']));
      return;
    }

    // Facebook / LinkedIn
    if (p.id === 'fb-feed' || p.id === 'li-feed') {
      root.appendChild(header(p, { sub: p.id === 'li-feed' ? 'Company · Promoted' : 'Sponsored' }));
      if (capFor(p.id).trim())
        root.appendChild(el('div', 'p-caption pad', captionHtml(p)));
      if (p.id === 'fb-feed') {
        root.appendChild(collageNode(ratio));
      } else {
        root.appendChild(swipeMedia(ratio));
        const d = carouselDots();
        if (d) root.appendChild(d);
      }
      if (state.link.trim() && state.slides.length < 2) root.appendChild(linkBar(p));
      root.appendChild(actionRow(p.id === 'li-feed'
        ? ['thumbsUp', 'comment', 'retweet', 'send']
        : ['thumbsUp', 'comment', 'share']));
      const fc1 = firstCommentNode(p);
      if (fc1) root.appendChild(fc1);
      return;
    }

    // Instagram feed
    root.appendChild(header(p, { sub: 'Sponsored' }));
    root.appendChild(swipeMedia(ratio));
    const dots = carouselDots();
    if (dots) root.appendChild(dots);
    const acts = actionRow(['heart', 'comment', 'send']);
    acts.classList.add('ig-acts');
    acts.insertAdjacentHTML('beforeend', `<span class="act push">${ICONS.bookmark}</span>`);
    root.appendChild(acts);
    root.appendChild(el('div', 'ig-likes', '1,248 likes'));
    const cap = el('div', 'p-caption pad');
    cap.innerHTML = `<b>${escapeHtml(state.handle.replace(/^@/, ''))}</b> ` + captionHtml(p);
    root.appendChild(cap);
    const fc = firstCommentNode(p);
    if (fc) root.appendChild(fc);
  }

  function firstCommentNode(p) {
    const t = state.firstComment.trim();
    if (!t || !(p.id === 'ig-feed' || p.id === 'li-feed')) return null;
    const d = el('div', 'first-comment');
    d.innerHTML = `<b>${escapeHtml(state.handle.replace(/^@/, ''))}</b> ` +
      escapeHtml(t).replace(/\n/g, '<br>');
    return d;
  }

  function linkCard(p) {
    const c = el('div', 'link-card');
    c.innerHTML = `<div class="lc-img">${ICONS.globe}</div>
      <div class="lc-meta"><div class="lc-host">${escapeHtml(cleanHost(state.link))}</div>
      <div class="lc-title">${escapeHtml(capFor(p.id).trim().split('\n')[0] || 'Link preview')}</div></div>`;
    return c;
  }
  function linkBar(p) {
    const c = el('div', 'link-bar');
    c.innerHTML = `<div class="lb-host">${escapeHtml(cleanHost(state.link))}</div>
      <div class="lb-title">${escapeHtml(capFor(p.id).trim().split('\n')[0] || 'Link preview title')}</div>
      <div class="lb-btn">Learn more</div>`;
    return c;
  }
  function cleanHost(u) {
    return u.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toUpperCase();
  }

  function buildFullbleed(root, p) {
    root.appendChild(mediaNode('9:16'));
    root.appendChild(el('div', 'fb-scrim'));

    const swipe = p.slides === 'swipe' && state.slides.length > 1;
    if (swipe) {
      root.appendChild(el('span', 'swipe-count fb-count', `${activeIndex() + 1}/${state.slides.length}`));
    }

    const top = el('div', 'fb-top');
    if (p.id === 'ig-story') {
      const bars = state.slides.length > 1
        ? state.slides.map((_, i) => `<i${i <= activeIndex() ? ' class="on"' : ''}></i>`).join('')
        : '<i class="on"></i><i></i><i></i>';
      top.appendChild(el('div', 'story-bar', bars));
    }
    const acct = el('div', 'fb-acct');
    acct.appendChild(avatarNode(26));
    acct.appendChild(el('span', 'fb-acct-name', state.name));
    if (p.id !== 'ig-story') acct.appendChild(el('span', 'fb-follow', 'Follow'));
    top.appendChild(acct);
    root.appendChild(top);

    if (p.id !== 'ig-story') {
      const rail = el('div', 'fb-rail');
      const set = p.id === 'tiktok'
        ? ['heartFill', 'comment', 'bookmark', 'send']
        : p.id === 'yt-shorts'
        ? ['thumbsUp', 'comment', 'send', 'music']
        : ['heart', 'comment', 'send', 'dots'];
      set.forEach((k) => rail.appendChild(el('div', 'rail-item', ICONS[k])));
      if (p.id === 'tiktok') rail.appendChild(el('div', 'rail-disc', ICONS.music));
      root.appendChild(rail);
    }

    const bottom = el('div', 'fb-bottom');
    if (p.id === 'ig-story') {
      if (capFor(p.id).trim()) {
        const sticker = el('div', 'story-sticker');
        sticker.textContent = capFor(p.id).trim();
        root.appendChild(sticker);
      }
    } else {
      const nm = el('div', 'fb-handle', p.id === 'yt-shorts' ? state.name : state.handle);
      bottom.appendChild(nm);
      bottom.appendChild(el('div', 'fb-caption', captionHtml(p)));
      if (swipe) {
        const d = carouselDots();
        d.classList.add('fb-dots');
        bottom.appendChild(d);
      } else if (p.id === 'tiktok' || p.id === 'ig-reel') {
        bottom.appendChild(el('div', 'fb-music', `${ICONS.music}<span>original audio</span>`));
      }
      root.appendChild(bottom);
    }

    const guide = safeOverlay(p);
    if (guide) root.appendChild(guide);
  }

  function buildThumb(root, p) {
    const media = mediaNode('16:9');
    media.appendChild(el('span', 'yt-dur', '10:24'));
    const cap = capFor(p.id).trim();
    if (cap) {
      const ov = el('div', 'yt-title-ov');
      ov.textContent = cap.split('\n')[0].slice(0, 48);
      media.appendChild(ov);
    }
    const guide = safeOverlay(p);
    if (guide) media.appendChild(guide);
    root.appendChild(media);

    const row = el('div', 'yt-row');
    row.appendChild(avatarNode(34));
    const meta = el('div', 'yt-meta');
    const t = el('div', 'yt-title');
    t.textContent = cap || 'Your video title goes here';
    meta.appendChild(t);
    meta.appendChild(el('div', 'yt-sub', `${state.name} · 24K views · 2 days ago`));
    row.appendChild(meta);
    root.appendChild(row);
  }

  /* ---------- render ---------- */
  function render() {
    const list = enabledList();
    const has = state.slides.length > 0;
    const ready = has && list.length > 0;
    const compose = state.view === 'focus' || state.view === 'board';

    document.body.dataset.pv = state.previewTheme;
    document.body.dataset.device = state.device;
    document.body.classList.toggle('feed-context', state.feedContext && compose);
    const fico = $('#frameIco');
    if (fico) fico.innerHTML = state.device === 'desktop' ? ICONS.devMonitor : ICONS.devPhone;

    // The Compare tool takes over the whole stage (it's not a platform preview)
    // while its flyout is the one open, regardless of the Focus/Board tab.
    const compareActive = compose && activeFlyout === 'compare';
    $('#focusView').hidden = state.view !== 'focus' || compareActive;
    $('#boardView').hidden = state.view !== 'board' || compareActive;
    $('#compareStage').hidden = !compareActive;
    if (compareActive) renderCompareStage();
    $('#calendarView').hidden = state.view !== 'calendar';
    $('#reviewsView').hidden = state.view !== 'reviews';
    $('#autoClipView').hidden = state.view !== 'autoclip';
    $('#sideTools').hidden = !compose;
    if (!compose) closeFlyout();
    $('#viewSwitch').hidden = !compose;
    $('#btnStartOver').hidden = !compose;
    $('#btnStartOver').disabled = !has && !state.caption.trim() && !state.hashtags.trim() && !state.firstComment.trim();
    $('#pvToggles').hidden = !compose || !has;
    $('#calNav').hidden = state.view !== 'calendar';

    [...$('#viewSwitch').children].forEach((b) =>
      b.classList.toggle('on', b.dataset.view === state.view));
    [...$('#sideNav').children].forEach((b) => {
      const active = b.dataset.nav === 'calendar' ? state.view === 'calendar'
        : b.dataset.nav === 'board' ? state.view === 'board'
        : b.dataset.nav === 'reviews' ? state.view === 'reviews'
        : b.dataset.nav === 'autoclip' ? state.view === 'autoclip'
        : state.view === 'focus';
      b.classList.toggle('on', active);
    });
    $('#tbTitle').textContent = state.view === 'calendar' ? 'Calendar'
      : state.view === 'reviews' ? 'Reviews'
      : state.view === 'autoclip' ? 'Auto Clip'
      : state.editingId ? (postById(state.editingId)?.title || 'Compose')
      : (state.pendingTitle || 'Compose');

    if (state.view === 'calendar') renderCalendar();
    else if (state.view === 'reviews') renderReviews();
    else if (state.view === 'autoclip') renderAutoClip();
    else if (state.view === 'board') renderBoard(list, has);
    else renderFocus(list, has);

    $('#btnPublishReview').disabled = !ready || !compose;
    const editingPost = state.editingId && postById(state.editingId);
    $('#btnPublishReview').lastChild.textContent = (editingPost && editingPost.reviewId) ? 'Update review' : 'In review';
    $('#btnExport').disabled = !ready || !compose;
    $('#btnSave').disabled = !has || !compose;

    syncCaptionEditor();
    renderStrip();
    renderFmtImages();
    syncFocus();
    renderCutoffs();
    renderCapHealth();
    syncAccountCard();
    renderTemplates();
    saveSettings();
  }

  /* ---------- format-specific images panel ---------- */
  let fmtTargetPid = null;
  function renderFmtImages() {
    const panel = $('#fmtImagesPanel');
    const box = $('#fmtImageList');
    if (!panel || !box) return;
    const list = enabledList();
    panel.hidden = !state.slides.length;
    if (panel.hidden) panel.dataset.wasHidden = '1';
    else if (panel.dataset.wasHidden) { panel.open = true; delete panel.dataset.wasHidden; }
    box.innerHTML = '';
    list.forEach((p) => {
      const ov = state.slideOverride[p.id] || [];
      const row = el('div', 'fmt-row' + (ov.length ? ' has' : ''));
      const thumbSrc = ov[0] ? ov[0].src : (state.slides[0] ? state.slides[0].src : '');
      row.innerHTML =
        `<span class="fmt-thumb"${thumbSrc ? ` style="background-image:url(${thumbSrc})"` : ''}></span>` +
        `<span class="fmt-meta"><b>${escapeHtml(platformName(p))}</b>` +
        `<small>${state.ratio[p.id]}${ov.length ? ` · ${ov.length} custom image${ov.length === 1 ? '' : 's'}` : ' · using master'}</small></span>`;
      const up = el('button', 'btn btn-sm', ov.length ? 'Replace' : 'Upload…');
      up.addEventListener('click', () => { fmtTargetPid = p.id; $('#fmtFileInput').click(); });
      row.appendChild(up);
      if (ov.length) {
        const x = el('button', 'fmt-clear', '&times;');
        x.title = 'Remove custom image — use the master';
        x.addEventListener('click', () => {
          delete state.slideOverride[p.id];
          render();
          toast(`${platformName(p)} back to the master image`);
        });
        row.appendChild(x);
      }
      box.appendChild(row);
    });
  }

  function syncAccountCard() {
    $('#sideName').textContent = state.name;
    $('#sideHandle').textContent = state.handle;
    const av = $('#sideAvatar');
    if (state.avatar) {
      av.textContent = '';
      av.style.backgroundImage = `url(${state.avatar})`;
      av.classList.add('has-img');
    } else {
      av.style.backgroundImage = '';
      av.classList.remove('has-img');
      av.textContent = (state.name.trim()[0] || 'B').toUpperCase();
    }
  }

  // Groups placements by platform (Instagram, TikTok, …) preserving PLATFORMS
  // order, so the board reads as one row per platform instead of placements
  // from different platforms wrapping together arbitrarily by card width.
  function groupByPlatform(list) {
    const order = [];
    const byName = {};
    list.forEach((p) => {
      if (!byName[p.name]) { byName[p.name] = []; order.push(p.name); }
      byName[p.name].push(p);
    });
    return order.map((name) => ({ name, items: byName[name] }));
  }
  function boardGroupRow(name, count) {
    const group = el('div', 'board-group');
    const label = el('div', 'board-group-label');
    label.innerHTML = `${escapeHtml(name)}<span class="bg-count">${count}</span>`;
    group.appendChild(label);
    const row = el('div', 'board-group-row');
    group.appendChild(row);
    return { group, row };
  }

  function renderBoard(list, has) {
    const board = $('#board');
    board.innerHTML = '';
    $('#emptyState').hidden = has;
    groupByPlatform(list).forEach(({ name, items }) => {
      const { group, row } = boardGroupRow(name, items.length);
      items.forEach((p) => {
        const card = buildCard(p);
        if (state.captionTarget === p.id) card.classList.add('selected');
        card.addEventListener('click', (e) => {
          if (e.target.closest('button, select, input, a, .more, .seg, .dots, .cap-custom, .carousel-tag')) return;
          state.focusPid = p.id;
          setCaptionTarget(p.id); // switches the caption editor to this placement + focuses it
        });
        row.appendChild(wrapFeedContext(card, p));
      });
      board.appendChild(group);
    });
  }

  /* ---------- focus mode ---------- */
  let lastFocusIdx = 0;
  function renderFocus(list, has) {
    const empty = $('#focusEmpty');
    const area = $('.focus-area');
    const bar = $('.switcher-wrap');
    const tb = $('.focus-controls');
    empty.hidden = has;
    area.hidden = !has;
    bar.hidden = !has;
    tb.hidden = !has;
    if (!has) { $('#switcher').innerHTML = ''; $('#focusPreview').innerHTML = ''; return; }

    const p = focusPlatform();
    const curIdx = list.findIndex((x) => x.id === p.id);

    // switcher
    const sw = $('#switcher');
    sw.innerHTML = '';
    list.forEach((pl) => {
      const b = el('button', 'sw-btn' + (pl.id === p.id ? ' on' : ''));
      b.style.setProperty('--pa', pl.accent);
      b.title = platformName(pl) + (hasOverride(pl.id) ? ' — custom description' : '');
      b.innerHTML = `<span class="sw-ico">${ICONS[pl.icon] || ICONS.globe}</span>` +
        `<span class="sw-lbl">${escapeHtml(pl.short || pl.name)}</span>` +
        (hasOverride(pl.id) ? '<span class="sw-dot"></span>' : '');
      b.addEventListener('click', () => setFocus(pl.id));
      sw.appendChild(b);
    });

    // preview with directional swap
    const holder = $('#focusPreview');
    const dir = curIdx === lastFocusIdx ? 0 : (curIdx > lastFocusIdx ? 1 : -1);
    lastFocusIdx = curIdx;
    const card = buildCard(p);
    card.classList.add('focus-card');
    if (state.captionTarget === p.id) card.classList.add('selected');
    if (dir !== 0) card.classList.add(dir > 0 ? 'swap-right' : 'swap-left');
    // click the preview to edit this placement's description (same as Board)
    card.addEventListener('click', (e) => {
      if (e.target.closest('button, select, input, a, .more, .seg, .dots')) return;
      setCaptionTarget(p.id);
    });
    holder.innerHTML = '';
    holder.appendChild(deviceFrame(wrapFeedContext(card, p), p));

    // controls bar: name + size (aspect) control + carousel note
    const meta = $('#focusMeta');
    meta.innerHTML = '';
    meta.appendChild(el('span', 'fm-name', platformName(p)));

    const size = el('span', 'fm-size');
    size.appendChild(el('span', 'fm-lbl', 'Size'));
    if (p.ratios.length > 1) {
      const seg = el('div', 'seg');
      p.ratios.forEach((r) => {
        const b = el('button', r === state.ratio[p.id] ? 'on' : null, r);
        b.addEventListener('click', () => { state.ratio[p.id] = r; render(); });
        seg.appendChild(b);
      });
      size.appendChild(seg);
    } else {
      size.appendChild(el('span', 'fm-ratio', state.ratio[p.id]));
    }
    meta.appendChild(size);

    const nImg = slidesFor(p.id).length;
    if (nImg > 1 && p.slides && p.slides !== 'single') {
      meta.appendChild(el('span', 'fm-dim', p.slides === 'swipe'
        ? `carousel · ${nImg}` : `${Math.min(nImg, p.maxSlides || 4)}-up`));
    }
    if (hasImageOverride(p.id)) meta.appendChild(el('span', 'fm-dim', '· custom image'));

    // per-placement "customize description" control
    const custom = hasOverride(p.id);
    const cbtn = el('button', 'fm-custom' + (custom ? ' on' : ''),
      custom ? 'Custom description' : '+ Customize description');
    cbtn.title = custom
      ? `${platformName(p)} has its own description — click to edit`
      : `Give ${platformName(p)} its own description`;
    cbtn.addEventListener('click', () => setCaptionTarget(p.id));
    meta.appendChild(cbtn);
    if (custom) {
      const reset = el('button', 'fm-custom-reset', 'reset');
      reset.addEventListener('click', () => {
        delete state.captionOverride[p.id];
        if (state.captionTarget === p.id) state.captionTarget = 'master';
        render();
      });
      meta.appendChild(reset);
    }
  }

  // Show the preview inside a phone or a browser window so you can picture it
  // the way it's actually seen. Focus mode only; never in exports.
  const WEB_DOMAIN = {
    'ig-feed': 'instagram.com', 'ig-story': 'instagram.com', 'ig-reel': 'instagram.com',
    tiktok: 'tiktok.com', 'yt-shorts': 'youtube.com', 'yt-thumb': 'youtube.com',
    x: 'x.com', 'fb-feed': 'facebook.com', 'li-feed': 'linkedin.com',
  };
  function deviceFrame(node, p) {
    if (!state.deviceFrame) return node;
    if (state.device === 'desktop') {
      // a MacBook — silver lid with the macOS menu bar + notch, a browser window,
      // and a foreshortened keyboard deck below
      const mac = el('div', 'device-macbook device-' + p.kind);
      const lid = el('div', 'mb-lid');
      const bezel = el('div', 'mb-bezel');
      bezel.innerHTML =
        '<div class="mb-menubar"><span class="mb-apple"></span><span class="mb-mi"></span>' +
        '<span class="mb-mi"></span><span class="mb-notch"></span><span class="mb-clock"></span></div>';
      const win = el('div', 'db-win');
      win.innerHTML =
        '<div class="db-bar"><span class="db-dot r"></span><span class="db-dot y"></span>' +
        '<span class="db-dot g"></span><span class="db-url">' +
        escapeHtml(WEB_DOMAIN[p.id] || 'web') + '</span></div>';
      const body = el('div', 'db-body');
      body.appendChild(node);
      win.appendChild(body);
      bezel.appendChild(win);
      lid.appendChild(bezel);
      mac.appendChild(lid);
      mac.appendChild(el('div', 'mb-foot'));
      return mac;
    }
    const w = el('div', 'device-phone device-' + p.kind);
    w.innerHTML = '<span class="dp-notch"></span><span class="dp-bar"></span>';
    const scr = el('div', 'dp-screen');
    scr.appendChild(node);
    w.insertBefore(scr, w.querySelector('.dp-bar'));
    return w;
  }

  // Wrap a preview card in faded "other posts" so you can judge it mid-scroll.
  // Applies to feed placements and YouTube thumbnails (which live in a results list).
  function wrapFeedContext(card, p) {
    if (!state.feedContext || !(p.kind === 'feed' || p.kind === 'thumbnail')) return card;
    if (document.body.classList.contains('exporting')) return card; // never in exports
    const scroll = el('div', 'feed-scroll' + (p.kind === 'thumbnail' ? ' yt' : ''));
    const n = p.kind === 'thumbnail' ? 2 : 1;
    for (let i = 0; i < n; i++) scroll.appendChild(feedSkeleton(true, p.kind));
    scroll.appendChild(card);
    for (let i = 0; i < n; i++) scroll.appendChild(feedSkeleton(false, p.kind));
    return scroll;
  }

  // A generic, dataless "other post" so you can judge the preview mid-scroll.
  function feedSkeleton(above, kind) {
    const pos = above ? ' above' : ' below';
    if (kind === 'thumbnail') {
      // YouTube search / suggestions row: thumbnail left, title + meta right
      const s = el('div', 'yt-skel' + pos);
      s.innerHTML =
        `<div class="yks-thumb"></div>` +
        `<div class="yks-meta"><i class="l1"></i><i class="l2"></i><i class="l3"></i></div>`;
      return s;
    }
    const s = el('div', 'feed-skel' + pos);
    s.innerHTML =
      `<div class="fk-head"><span class="fk-av"></span><span class="fk-lines"><i></i><i></i></span></div>` +
      `<div class="fk-media"></div>` +
      `<div class="fk-acts"><i></i><i></i><i></i></div>` +
      `<div class="fk-cap"><i></i><i></i></div>`;
    return s;
  }

  function setFocus(pid) {
    state.focusPid = pid;
    if (state.view !== 'focus') state.view = 'focus';
    render();
  }
  function cycleFocus(step) {
    const list = enabledList();
    if (list.length < 2) return;
    const i = list.findIndex((x) => x.id === focusPlatform().id);
    setFocus(list[(i + step + list.length) % list.length].id);
  }
  function setView(v) {
    state.view = v;
    render();
  }

  /* ---------- caption target editor ---------- */
  function platformName(p) {
    return `${p.name}${p.placement === 'Feed' ? '' : ' · ' + p.placement}`;
  }
  function setCaptionTarget(target) {
    state.captionTarget = target;
    openFlyout('caption');
    render();
    $('#caption').focus();
  }

  /* ---------- sidebar flyout panels ---------- */
  let activeFlyout = null;
  function closeFlyout() {
    if (!activeFlyout) return;
    const fly = document.getElementById('fly-' + activeFlyout);
    if (fly) fly.hidden = true;
    const b = document.querySelector('.tool-btn[data-panel="' + activeFlyout + '"]');
    if (b) b.classList.remove('active');
    activeFlyout = null;
    document.body.classList.remove('flyout-open');
  }
  function openFlyout(name) {
    if (activeFlyout === name) return;
    closeFlyout();
    const fly = document.getElementById('fly-' + name);
    if (!fly) return;
    fly.hidden = false;
    const b = document.querySelector('.tool-btn[data-panel="' + name + '"]');
    if (b) b.classList.add('active');
    activeFlyout = name;
    document.body.classList.add('flyout-open');
    if (name === 'compare') renderCompare();
  }
  function initToolPanels() {
    $('#sideTools').addEventListener('click', (e) => {
      const b = e.target.closest('.tool-btn');
      if (!b) return;
      const name = b.dataset.panel;
      if (activeFlyout === name) closeFlyout();
      else openFlyout(name);
      render();
    });
    document.querySelectorAll('.fly-close').forEach((c) =>
      c.addEventListener('click', () => { closeFlyout(); render(); }));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && activeFlyout) { closeFlyout(); render(); }
    });
  }
  function syncCaptionEditor() {
    const sel = $('#captionTarget');
    const cur = state.captionTarget;
    sel.innerHTML =
      `<option value="master">✎ Master — all placements</option>` +
      PLATFORMS.filter((p) => state.enabled.has(p.id))
        .map((p) => `<option value="${p.id}">${escapeHtml(platformName(p))}${hasOverride(p.id) ? ' •' : ''}</option>`)
        .join('');
    if (cur !== 'master' && !state.enabled.has(cur)) state.captionTarget = 'master';
    sel.value = state.captionTarget;

    const ta = $('#caption');
    const editingMaster = state.captionTarget === 'master';
    const val = editingMaster ? state.caption : (state.captionOverride[state.captionTarget] || '');
    if (document.activeElement !== ta) ta.value = val;
    ta.placeholder = editingMaster
      ? 'Write the caption / description the team will review…'
      : 'Custom description for this placement — leave blank to use the master';

    const shownLen = editedCaption().length;
    $('#charCount').textContent = `${shownLen} character${shownLen === 1 ? '' : 's'}`;
    const reset = $('#capReset');
    reset.hidden = editingMaster || !hasOverride(state.captionTarget);
  }

  /* ---------- caption cut-off meter ---------- */
  function renderCutoffs() {
    const box = $('#cutoffs');
    const len = editedCaption().trim().length;
    const rows = PLATFORMS
      .filter((p) => state.enabled.has(p.id))
      .map((p) => {
        const c = capRule(p);
        const limit = c.truncateAt || c.hardLimit || c.recommended;
        if (!limit) return null;
        const hard = !!c.hardLimit && !c.truncateAt;
        return { name: `${p.name}${p.placement === 'Feed' ? '' : ' ' + p.placement}`, limit, hard };
      })
      .filter(Boolean)
      .sort((a, b) => a.limit - b.limit);

    const det = $('#cutoffDetails');
    if (!len || !rows.length) { det.hidden = true; box.innerHTML = ''; return; }
    det.hidden = false;
    box.innerHTML = '';
    rows.forEach((r) => {
      const over = len > r.limit;
      const cls = over ? (r.hard ? 'over' : 'warn') : 'ok';
      const pct = Math.min(100, Math.round((len / r.limit) * 100));
      const status = over
        ? (r.hard ? `over by ${len - r.limit}` : `cut · ${r.limit}`)
        : `${r.limit}`;
      const row = el('div', 'cut-row ' + cls);
      row.innerHTML =
        `<span class="cut-name">${escapeHtml(r.name)}</span>` +
        `<span class="cut-bar"><i style="width:${pct}%"></i></span>` +
        `<span class="cut-val">${status}</span>`;
      box.appendChild(row);
    });
  }

  /* ---------- slide strip ---------- */
  function renderStrip() {
    const strip = $('#slideStrip');
    strip.hidden = state.slides.length === 0;
    strip.innerHTML = '';
    const idx = activeIndex();
    state.slides.forEach((s, i) => {
      const t = el('div', 'slide-thumb' + (i === idx ? ' active' : ''));
      t.draggable = true;
      const img = el('img');
      img.src = s.src;
      t.appendChild(img);
      t.appendChild(el('span', 'st-num', i + 1));
      if (!(s.alt || '').trim()) { const d = el('span', 'st-noalt'); d.title = 'No alt text'; t.appendChild(d); }
      const x = el('button', 'st-x', '&times;');
      x.title = 'Remove';
      x.addEventListener('click', (e) => { e.stopPropagation(); removeSlide(i); });
      t.appendChild(x);
      t.addEventListener('click', () => { state.active = i; render(); });
      t.addEventListener('dragstart', () => { dragFrom = i; t.classList.add('dragging'); });
      t.addEventListener('dragend', () => t.classList.remove('dragging'));
      t.addEventListener('dragover', (e) => e.preventDefault());
      t.addEventListener('drop', (e) => { e.preventDefault(); moveSlide(dragFrom, i); dragFrom = null; });
      strip.appendChild(t);
    });
    const add = el('button', 'slide-add', ICONS.plus);
    add.title = 'Add images';
    add.addEventListener('click', () => $('#fileInput').click());
    strip.appendChild(add);
    syncAlt();
  }

  function syncAlt() {
    const field = $('#altField');
    const ta = $('#altText');
    const idx = activeIndex();
    if (idx < 0) { field.hidden = true; return; }
    field.hidden = false;
    $('#altSlideNum').textContent = String(idx + 1);
    if (document.activeElement !== ta) ta.value = state.slides[idx].alt || '';
    const all = $('#altWriteAll');
    if (all) all.hidden = state.slides.length < 2;
  }

  /* ---------- crop-focus control ---------- */
  function syncFocus() {
    const wrap = $('#cropDetails');
    const idx = activeIndex();
    if (idx < 0) { wrap.hidden = true; wrap.open = false; wrap.dataset.wasHidden = '1'; return; }
    if (wrap.dataset.wasHidden) { wrap.open = true; delete wrap.dataset.wasHidden; }
    wrap.hidden = false;
    const s = state.slides[idx];
    const img = $('#focusImg');
    if (img.src !== s.src) img.src = s.src;
    $('#focusHint').textContent = state.slides.length > 1
      ? `Slide ${idx + 1} of ${state.slides.length} — drag to set its crop focus`
      : 'Drag the point to set the crop focus';
    const dot = $('#focusDot');
    dot.style.left = s.focal.x + '%';
    dot.style.top = s.focal.y + '%';
    $('#focusStage').classList.toggle('disabled', state.fit === 'contain');
  }

  function initFocus() {
    const stage = $('#focusStage');
    let drag = false;
    const move = (e) => {
      const idx = activeIndex();
      if (idx < 0) return;
      const r = stage.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
      state.slides[idx].focal = { x: Math.round(x * 100), y: Math.round(y * 100) };
      $('#focusDot').style.left = state.slides[idx].focal.x + '%';
      $('#focusDot').style.top = state.slides[idx].focal.y + '%';
      renderPreviewOnly();
    };
    stage.addEventListener('mousedown', (e) => { drag = true; move(e); });
    window.addEventListener('mousemove', (e) => drag && move(e));
    window.addEventListener('mouseup', () => (drag = false));

    $('#fitMode').addEventListener('change', (e) => {
      state.fit = e.target.value;
      render();
    });
    $('#padColor').addEventListener('input', (e) => {
      state.pad = e.target.value;
      renderPreviewOnly();
    });
  }

  // Fill the board grid — used by exports (which force the board visible offscreen).
  function renderBoardOnly() {
    const board = $('#board');
    board.innerHTML = '';
    groupByPlatform(enabledList()).forEach(({ name, items }) => {
      const { group, row } = boardGroupRow(name, items.length);
      items.forEach((p) => row.appendChild(buildCard(p)));
      board.appendChild(group);
    });
  }

  // Lightweight re-render of just the visible preview(s), for crop-drag / colour.
  function renderPreviewOnly() {
    if (state.view === 'board') { renderBoardOnly(); return; }
    const p = focusPlatform();
    if (!p) return;
    const holder = $('#focusPreview');
    holder.innerHTML = '';
    const c = buildCard(p);
    c.classList.add('focus-card');
    holder.appendChild(deviceFrame(wrapFeedContext(c, p), p));
  }

  /* ---------- sidebar wiring ---------- */
  function initToggles() {
    const wrap = $('#platformToggles');
    PLATFORMS.forEach((p) => {
      const row = el('label', 'toggle');
      row.innerHTML = `<input type="checkbox"${state.enabled.has(p.id) ? ' checked' : ''}>
        <span class="tg-dot" style="background:${p.accent}"></span>
        <span>${p.name} · ${p.placement}</span>`;
      row.querySelector('input').addEventListener('change', (e) => {
        if (e.target.checked) state.enabled.add(p.id);
        else state.enabled.delete(p.id);
        render();
      });
      wrap.appendChild(row);
    });

    const safe = $('#safeToggle');
    safe.setAttribute('aria-pressed', String(state.safe));
    safe.addEventListener('click', () => {
      state.safe = !state.safe;
      safe.setAttribute('aria-pressed', String(state.safe));
      render();
    });
  }

  function applySettingsToUI() {
    applyBrand();
    $('#acctName').value = state.name;
    $('#acctHandle').value = state.handle;
    $('#fitMode').value = state.fit;
    $('#padColor').value = state.pad;
    $('#linkUrl').value = state.link;
    $('#feedbackEmail').value = state.feedbackEmail;
    $('#caption').value = state.captionTarget === 'master'
      ? state.caption : (state.captionOverride[state.captionTarget] || '');
    $('#hashtags').value = state.hashtags;
    $('#firstComment').value = state.firstComment;
    renderBrandPicker();
    renderHashSetPicker();
    [...$('#platformToggles').querySelectorAll('input')].forEach((inp, i) => {
      inp.checked = state.enabled.has(PLATFORMS[i].id);
    });
    $('#safeToggle').setAttribute('aria-pressed', String(state.safe));
    const fc = $('#feedContextToggle');
    if (fc) fc.setAttribute('aria-pressed', String(state.feedContext));
    [...$('#pvTheme').children].forEach((b) => b.classList.toggle('on', b.dataset.pv === state.previewTheme));
    [...$('#deviceSwitch').children].forEach((b) => b.classList.toggle('on', b.dataset.dv === state.device));
    $('#frameToggle').setAttribute('aria-pressed', String(state.deviceFrame));
    const fico = $('#frameIco');
    if (fico) fico.innerHTML = state.device === 'desktop' ? ICONS.devMonitor : ICONS.devPhone;
  }

  function applyAppTheme() {
    const light = state.appTheme === 'light';
    document.body.dataset.theme = light ? 'light' : 'dark';
    const btn = $('#themeToggle');
    if (btn) {
      const ico = btn.querySelector('.tt-ico');
      if (ico) ico.innerHTML = light ? ICONS.sun : ICONS.moon;
      btn.title = light ? 'Switch to dark appearance' : 'Switch to light appearance';
    }
  }
  function toggleAppTheme() {
    state.appTheme = state.appTheme === 'light' ? 'dark' : 'light';
    document.body.classList.add('theme-switching');
    applyAppTheme();
    // drop the guard after the style has been applied for a frame
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.body.classList.remove('theme-switching');
    }));
    saveSettings();
  }

  function renderBrandPicker() {
    const sel = $('#brandPicker');
    if (!sel) return;
    sel.innerHTML = state.brands
      .map((b) => `<option value="${b.id}">${escapeHtml(b.name || 'Untitled brand')}</option>`)
      .join('');
    sel.value = state.brandId;
    $('#brandDel').disabled = state.brands.length < 2;
  }
  function renderHashSetPicker() {
    const box = $('#hashSets');
    if (!box) return;
    box.innerHTML = '';
    if (!state.hashtagSets.length) {
      box.appendChild(el('p', 'field-note', 'No presets yet — type some hashtags above, then “Save as preset”.'));
      return;
    }
    state.hashtagSets.forEach((s) => {
      const active = state.hashtags.trim() === (s.tags || '').trim();
      const row = el('div', 'hash-set-row' + (active ? ' active' : ''));
      row.innerHTML =
        `<span class="hs-body"><b>${escapeHtml(s.label)}</b><small>${escapeHtml(s.tags)}</small></span>` +
        `<button class="hs-apply btn btn-sm" title="Use this preset">${active ? 'In use' : 'Apply'}</button>` +
        `<button class="hs-del" title="Delete preset">${ICONS.plus}</button>`;
      row.querySelector('.hs-apply').addEventListener('click', () => {
        state.hashtags = s.tags;
        $('#hashtags').value = s.tags;
        render();
        toast(`Applied “${s.label}”`);
      });
      row.querySelector('.hs-body').addEventListener('click', () => {
        state.hashtags = s.tags; $('#hashtags').value = s.tags; render();
      });
      row.querySelector('.hs-del').addEventListener('click', () => {
        state.hashtagSets = state.hashtagSets.filter((x) => x.id !== s.id);
        saveSettings();
        renderHashSetPicker();
        toast(`Deleted “${s.label}”`, 4000, () => {
          state.hashtagSets.push(s); saveSettings(); renderHashSetPicker();
        }, 'Undo');
      });
      box.appendChild(row);
    });
  }

  function initDropzone() {
    const dz = $('#dropzone');
    const input = $('#fileInput');
    dz.addEventListener('click', () => input.click());
    input.addEventListener('change', () => { addFiles(input.files); input.value = ''; });
    $('#fmtFileInput').addEventListener('change', (e) => {
      if (fmtTargetPid) addFmtFiles(fmtTargetPid, e.target.files);
      e.target.value = ''; fmtTargetPid = null;
    });
    ['dragover', 'dragenter'].forEach((ev) =>
      dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach((ev) =>
      dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('drag'); }));
    dz.addEventListener('drop', (e) => addFiles(e.dataTransfer.files));

    const stage = $('.stage');
    stage.addEventListener('dragover', (e) => e.preventDefault());
    stage.addEventListener('drop', (e) => {
      e.preventDefault();
      if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
    });
  }

  /* ---------- compare tool: any number of candidate images ---------- */
  const COMPARE_MAX = 6;
  let pendingCompareId = null;
  function compareLabel(i) { return 'Option ' + String.fromCharCode(65 + i); }
  function ensureCompareMinSlots() {
    while (state.compareItems.length < 2) state.compareItems.push({ id: uid('cmp'), img: null });
  }
  function loadCompareFile(itemId, file) {
    if (!file || !file.type || !file.type.startsWith('image/')) return;
    const fr = new FileReader();
    fr.onload = async () => {
      const item = state.compareItems.find((x) => x.id === itemId);
      if (!item) return;
      item.img = await normalizeImage(fr.result);
      renderCompare();
    };
    fr.readAsDataURL(file);
  }

  // Renders each candidate through the SAME mock builder Focus/Board use —
  // buildCardInner(platform) — by swapping state.slides (and the caption/
  // hashtags fields it reads) to this candidate's own values, so a Compare
  // caption never touches the real post's caption. Bypasses buildCard()'s own
  // per-placement override swap since we're already fully controlling state here.
  function renderCompareStage() {
    const wrap = $('#compareStage');
    wrap.innerHTML = '';
    const filled = state.compareItems
      .map((item, i) => ({ item, i }))
      .filter(({ item }) => item.img);
    if (!filled.length) {
      wrap.appendChild(el('p', 'compare-stage-empty', 'Upload images in the Compare panel to preview them here.'));
      return;
    }
    const platform = PLATFORMS.find((p) => p.id === state.comparePlatform) || PLATFORMS[0];
    const saved = {
      slides: state.slides, active: state.active, caption: state.caption,
      hashtags: state.hashtags, captionOverride: state.captionOverride, firstComment: state.firstComment,
    };
    state.caption = state.compareCaption;
    state.hashtags = state.compareHashtags;
    state.captionOverride = {};
    state.firstComment = '';
    filled.forEach(({ item, i }) => {
      const col = el('div', 'compare-stage-col');
      col.appendChild(el('div', 'compare-stage-label', compareLabel(i)));
      state.slides = [{ src: item.img, type: 'image', focal: { x: 50, y: 50 }, alt: '' }];
      state.active = 0;
      col.appendChild(buildCardInner(platform));
      wrap.appendChild(col);
    });
    Object.assign(state, saved);
  }

  function renderCompare() {
    ensureCompareMinSlots();
    if (document.activeElement !== $('#compareCaption')) $('#compareCaption').value = state.compareCaption;
    if (document.activeElement !== $('#compareHashtags')) $('#compareHashtags').value = state.compareHashtags;
    const list = $('#compareList');
    list.innerHTML = '';
    state.compareItems.forEach((item, i) => {
      const slot = el('div', 'compare-slot');
      if (item.img) {
        const preview = el('div', 'compare-preview');
        const img = el('img'); img.src = item.img; img.alt = compareLabel(i);
        preview.appendChild(img);
        preview.appendChild(el('span', 'compare-label-badge', String.fromCharCode(65 + i)));
        const rm = el('button', 'compare-remove', '✕');
        rm.type = 'button'; rm.title = 'Remove ' + compareLabel(i);
        rm.addEventListener('click', () => {
          if (state.compareItems.length <= 2) item.img = null;
          else state.compareItems.splice(i, 1);
          renderCompare();
        });
        preview.appendChild(rm);
        slot.appendChild(preview);
      } else {
        const drop = el('div', 'compare-drop');
        drop.innerHTML = `<span class="dz-ico">${ICONS.upload}</span><p class="dz-title">${compareLabel(i)}</p><p class="dz-sub">click or drop</p>`;
        drop.addEventListener('click', () => { pendingCompareId = item.id; $('#compareFileInput').click(); });
        ['dragover', 'dragenter'].forEach((ev) =>
          drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('drag'); }));
        ['dragleave', 'drop'].forEach((ev) =>
          drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('drag'); }));
        drop.addEventListener('drop', (e) => loadCompareFile(item.id, e.dataTransfer.files[0]));
        slot.appendChild(drop);
      }
      list.appendChild(slot);
    });
    $('#compareAddBtn').hidden = state.compareItems.length >= COMPARE_MAX;
    const filledCount = state.compareItems.filter((it) => it.img).length;
    $('#compareSendReview').disabled = filledCount < 2;
    $('#compareExportPng').disabled = filledCount < 1;
    $('#compareExportPdf').disabled = filledCount < 1;
    renderCompareStage();
  }

  function initCompare() {
    const sel = $('#comparePlatformSelect');
    sel.innerHTML = PLATFORMS.map((p) => `<option value="${p.id}">${escapeHtml(platformName(p))}</option>`).join('');
    sel.value = state.comparePlatform;
    sel.addEventListener('change', (e) => {
      state.comparePlatform = e.target.value;
      renderCompareStage();
    });
    $('#compareCaption').addEventListener('input', (e) => {
      state.compareCaption = e.target.value;
      renderCompareStage();
    });
    $('#compareHashtags').addEventListener('input', (e) => {
      state.compareHashtags = e.target.value;
      renderCompareStage();
    });
    $('#compareFileInput').addEventListener('change', (e) => {
      if (pendingCompareId) loadCompareFile(pendingCompareId, e.target.files[0]);
      e.target.value = ''; pendingCompareId = null;
    });
    $('#compareAddBtn').addEventListener('click', () => {
      if (state.compareItems.length >= COMPARE_MAX) return;
      state.compareItems.push({ id: uid('cmp'), img: null });
      renderCompare();
    });
    $('#compareExportPng').addEventListener('click', () => {
      exportComparePng().catch((err) => toast('Error: ' + err.message));
    });
    $('#compareExportPdf').addEventListener('click', () => {
      exportComparePdf().catch((err) => toast('Error: ' + err.message));
    });
    $('#compareSendReview').addEventListener('click', () => {
      publishCompareReview().catch((err) => toast('Error: ' + err.message));
    });
  }

  // Compresses a data URL for network upload only — the in-app copy (used for
  // the live mock preview) keeps normalizeImage's higher-quality version, so
  // this only shrinks what actually goes over the wire to the review backend.
  function compressForUpload(dataUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1600;
        const long = Math.max(img.width, img.height);
        const s = long > MAX ? MAX / long : 1;
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * s);
        c.height = Math.round(img.height * s);
        const ctx = c.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, c.width, c.height);
        try { resolve(c.toDataURL('image/jpeg', 0.78)); }
        catch (e) { resolve(dataUrl); }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  // 'png' is used for the lossless Save-PNG button; 'jpeg' (smaller, lossy) is
  // used for the PDF — a PDF here is meant to be emailed or printed, and a
  // pixelRatio-2 PNG of several mock cards balloons to tens of MB, too big to
  // mail — so the PDF path trades a little quality for a file worth sending.
  async function compareStageImage(format) {
    // NOT rebuilt here on purpose: every action that changes what the stage
    // shows (image add/remove, caption/hashtags edit, platform switch) already
    // calls renderCompareStage(), so the stage is already current by the time
    // an (enabled) export button can be clicked. Rebuilding right before the
    // capture raced html-to-image — freshly-inserted <img> nodes weren't
    // painted yet even after a decode() + single rAF, producing a capture
    // with only the text labels and no card content.
    const stage = $('#compareStage');
    await Promise.all([...stage.querySelectorAll('img')].map((im) =>
      (im.decode ? im.decode().catch(() => {}) : Promise.resolve())));
    const capture = format === 'jpeg'
      ? window.htmlToImage.toJpeg(stage, { pixelRatio: 1.5, quality: 0.9, backgroundColor: '#0b0b0c', style: { padding: '28px' } })
      : window.htmlToImage.toPng(stage, { pixelRatio: 2, backgroundColor: '#0b0b0c', style: { padding: '28px' } });
    return await withTimeout(capture, 60000, 'comparison render');
  }

  async function exportComparePng() {
    let url;
    overlay(true, 'Rendering comparison…');
    try { url = await compareStageImage('png'); } finally { overlay(false); }
    const r = await window.api.saveFile({
      defaultName: 'image-comparison.png',
      dataUrl: url,
      filters: [{ name: 'PNG', extensions: ['png'] }],
    });
    if (r.ok) toast('Saved → ' + r.path);
  }

  async function exportComparePdf() {
    let url;
    overlay(true, 'Building PDF…');
    try { url = await compareStageImage('jpeg'); } finally { overlay(false); }
    const img = new Image();
    await new Promise((res) => { img.onload = res; img.src = url; });
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: img.width >= img.height ? 'landscape' : 'portrait',
      unit: 'pt',
      format: [img.width / 2, img.height / 2],
    });
    pdf.addImage(url, 'JPEG', 0, 0, img.width / 2, img.height / 2);
    const out = pdf.output('datauristring');
    const r = await window.api.saveFile({
      defaultName: 'image-comparison.pdf',
      dataUrl: out,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (r.ok) toast('PDF saved → ' + r.path);
  }

  function initInputs() {
    $('#caption').addEventListener('input', (e) => {
      const v = e.target.value;
      if (state.captionTarget === 'master') {
        state.caption = v;
      } else if (v.trim()) {
        state.captionOverride[state.captionTarget] = v;
      } else {
        delete state.captionOverride[state.captionTarget];
      }
      render();
    });
    const onAlt = (e) => {
      const idx = activeIndex();
      if (idx < 0) return;
      const was = !!(state.slides[idx].alt || '').trim();
      state.slides[idx].alt = e.target.value;
      if (was !== !!e.target.value.trim()) renderStrip(); // toggle the "no alt" dot
    };
    $('#altText').addEventListener('input', onAlt);
    $('#altText').addEventListener('change', onAlt);
    $('#captionTarget').addEventListener('change', (e) => setCaptionTarget(e.target.value));
    $('#capReset').addEventListener('click', () => {
      delete state.captionOverride[state.captionTarget];
      render();
      $('#caption').focus();
    });
    $('#linkUrl').addEventListener('input', (e) => { updateBrandField('link', e.target.value); render(); });
    $('#feedbackEmail').addEventListener('input', (e) => { updateBrandField('feedbackEmail', e.target.value.trim()); saveSettings(); });
    $('#acctName').addEventListener('input', (e) => { updateBrandField('name', e.target.value); render(); });
    $('#acctHandle').addEventListener('input', (e) => { updateBrandField('handle', e.target.value); render(); });
    const av = $('#avatarInput');
    $('#avatarZone').addEventListener('click', () => av.click());
    av.addEventListener('change', () => {
      const f = av.files[0];
      if (!f || !f.type.startsWith('image/')) return;
      const fr = new FileReader();
      fr.onload = async () => { updateBrandField('avatar', await normalizeImage(fr.result)); render(); };
      fr.readAsDataURL(f);
    });

    // hashtags + first comment
    $('#hashtags').addEventListener('input', (e) => { state.hashtags = e.target.value; render(); renderHashSetPicker(); });
    $('#firstComment').addEventListener('input', (e) => { state.firstComment = e.target.value; render(); });
    $('#hashSave').addEventListener('click', () => {
      const btn = $('#hashSave');
      if (btn.dataset.editing) return;
      const tags = state.hashtags.trim();
      if (!tags) return toast('Type some hashtags first');
      btn.dataset.editing = '1';
      const row = el('div', 'hash-name');
      const inp = el('input');
      inp.type = 'text';
      inp.placeholder = 'Preset name…';
      inp.value = tags.split(/\s+/).slice(0, 2).join(' ').replace(/#/g, '') || 'Preset';
      const ok = el('button', 'btn btn-sm', 'Save');
      const no = el('button', 'btn btn-sm', 'Cancel');
      row.append(inp, ok, no);
      btn.replaceWith(row);
      inp.focus(); inp.select();
      const done = (save) => {
        if (save) {
          const label = inp.value.trim() || 'Preset';
          state.hashtagSets.push({ id: uid('h'), label, tags });
          saveSettings();
          toast(`Saved preset “${label}”`);
        }
        row.replaceWith(btn);
        delete btn.dataset.editing;
        renderHashSetPicker();
      };
      ok.addEventListener('click', () => done(true));
      no.addEventListener('click', () => done(false));
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); done(true); }
        if (e.key === 'Escape') { e.preventDefault(); done(false); }
      });
    });

    // clear every caption (master + per-placement)
    $('#capClearAll').addEventListener('click', () => {
      const hadMaster = state.caption;
      const hadOver = { ...state.captionOverride };
      if (!hadMaster.trim() && !Object.keys(hadOver).length) return toast('No captions to clear');
      state.caption = '';
      state.captionOverride = {};
      state.captionTarget = 'master';
      render();
      toast('Cleared all captions', 5000, () => {
        state.caption = hadMaster;
        state.captionOverride = hadOver;
        render();
      }, 'Undo');
    });

    // brand kit controls
    $('#brandPicker').addEventListener('change', (e) => {
      state.brandId = e.target.value;
      applyBrand();
      applySettingsToUI();
      render();
    });
    $('#brandNew').addEventListener('click', () => {
      const b = { id: uid('b'), name: 'New brand', handle: '@brand', avatar: null, link: '', feedbackEmail: '' };
      state.brands.push(b); state.brandId = b.id;
      applyBrand(); applySettingsToUI(); render();
      $('#acctName').focus(); $('#acctName').select();
    });
    $('#brandDup').addEventListener('click', () => {
      const cur = currentBrand();
      const b = { ...cur, id: uid('b'), name: (cur.name || 'Brand') + ' (copy)' };
      state.brands.push(b); state.brandId = b.id;
      applyBrand(); applySettingsToUI(); render();
    });
    $('#brandDel').addEventListener('click', () => {
      if (state.brands.length < 2) return;
      const cur = currentBrand();
      state.brands = state.brands.filter((b) => b.id !== cur.id);
      state.brandId = state.brands[0].id;
      applyBrand(); applySettingsToUI(); render();
      toast(`Deleted brand “${cur.name}”`);
    });

    $('#btnBackup').addEventListener('click', () => exportBackup().catch((e) => toast('Error: ' + e.message)));
    $('#btnRestore').addEventListener('click', () => importBackup().catch((e) => toast('Error: ' + e.message)));

    $('#tplSave').addEventListener('click', () => saveAsTemplate($('#tplName').value));
    $('#tplName').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); saveAsTemplate($('#tplName').value); }
    });
  }

  /* ---------- export ---------- */
  const withTimeout = (promise, ms, what) => Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error((what || 'render') + ' timed out')), ms)),
  ]);

  async function snapshot(node, opts) {
    if (!node) throw new Error('nothing to capture');
    // warm up: make sure every <img> in the node has decoded first
    await Promise.all([...node.querySelectorAll('img')].map((im) =>
      (im.decode ? im.decode().catch(() => {}) : Promise.resolve())));
    // no cacheBust — all images are fresh data: URIs; cacheBust can corrupt those.
    if (opts && opts.hi) {
      // Sharper JPEG for the review page's "view full size" zoom, so small
      // baked-in text is legible — still compressed to keep the combined
      // upload under the backend's request-size limit.
      return withTimeout(
        window.htmlToImage.toJpeg(node, { pixelRatio: 2, quality: 0.92, backgroundColor: '#ffffff' }),
        45000, 'capture');
    }
    if (opts && opts.light) {
      // Compressed JPEGs for the hosted review link — a "hi" companion image
      // is uploaded alongside each card for the zoom button, so this only
      // needs to be sharp enough to read at its displayed thumbnail size,
      // not full detail. 1.25x was too soft for the small caption/hashtag
      // text baked into the image; 1.75x keeps it legible without meaningfully
      // growing the upload past what the "hi" image already costs.
      return withTimeout(
        window.htmlToImage.toJpeg(node, { pixelRatio: 1.75, quality: 0.85, backgroundColor: '#ffffff' }),
        45000, 'capture');
    }
    return withTimeout(
      window.htmlToImage.toPng(node, { pixelRatio: 2, backgroundColor: '#ffffff' }),
      45000, 'capture');
  }

  function captureFor(id) {
    return document.querySelector(`#board .card[data-id="${id}"] .capture`);
  }

  async function exportPngs() {
    const list = PLATFORMS.filter((p) => state.enabled.has(p.id));
    if (!list.length || !state.slides.length) return;
    const savedActive = state.active;
    const nSlides = state.slides.length;
    const files = [];
    const failed = [];
    overlay(true, 'Rendering previews…');
    document.body.classList.add('exporting');
    const wasSafe = state.safe;
    if (wasSafe) state.safe = false;
    const shot = async (id, name, label) => {
      overlay(true, label);
      renderBoardOnly();
      await raf();
      try {
        files.push({ name, dataUrl: await snapshot(captureFor(id)) });
      } catch (e) {
        failed.push(name);
      }
    };
    try {
      for (const p of list) {
        if (p.slides === 'swipe' && nSlides > 1) {
          for (let i = 0; i < nSlides; i++) {
            state.active = i;
            await shot(p.id, `${p.id}-${i + 1}.png`, `${p.name} ${p.placement} — slide ${i + 1}/${nSlides}…`);
          }
        } else {
          state.active = savedActive;
          await shot(p.id, `${p.id}.png`, `${p.name} ${p.placement}…`);
        }
      }
    } finally {
      if (wasSafe) state.safe = true;
      document.body.classList.remove('exporting');
      state.active = savedActive;
      render();
      overlay(false);
    }
    if (!files.length) return toast('Export failed — nothing could be rendered');
    const r = await window.api.savePngs(files);
    if (r.canceled) return toast('Export cancelled');
    if (r.ok) {
      toast(failed.length
        ? `Saved ${r.count} PNGs → ${r.dir}  (${failed.length} failed: ${failed.join(', ')})`
        : `Saved ${r.count} PNG${r.count === 1 ? '' : 's'} → ${r.dir}`);
    }
  }

  // Capturing the whole multi-card #board in one htmlToImage pass hangs
  // indefinitely on real boards (several placements × full-resolution
  // photos) — html-to-image never resolves or rejects, even past its own
  // timeout, so the export just spins forever. Each card is captured
  // individually instead, via the same snapshot() path per-card exports and
  // review links already rely on, then composited onto one canvas here.
  async function boardImage() {
    document.body.classList.add('exporting');
    const wasSafe = state.safe;
    if (wasSafe) state.safe = false;
    renderBoardOnly();
    await raf();
    try {
      const groups = groupByPlatform(enabledList());
      const SCALE = 2; // matches snapshot()'s default pixelRatio
      const PAD = 28 * SCALE;
      const GAP = 30 * SCALE;
      const LABEL_H = 34 * SCALE;

      const rows = groups.map(({ name, items }) => {
        const cards = items.map((p) => {
          const node = captureFor(p.id);
          if (!node) return null;
          const rect = node.getBoundingClientRect();
          return { p, node, w: Math.round(rect.width * SCALE), h: Math.round(rect.height * SCALE) };
        }).filter(Boolean);
        const rowW = cards.reduce((s, c) => s + c.w, 0) + GAP * Math.max(0, cards.length - 1);
        const rowH = cards.reduce((m, c) => Math.max(m, c.h), 0);
        return { name, count: items.length, cards, rowW, rowH };
      }).filter((r) => r.cards.length);
      if (!rows.length) throw new Error('Nothing to export — add an image first');

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, PAD * 2 + Math.max(...rows.map((r) => r.rowW)));
      canvas.height = Math.max(1, PAD * 2 + rows.reduce((s, r) => s + LABEL_H + r.rowH, 0) + GAP * Math.max(0, rows.length - 1));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#0b0b0c';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ececed';
      ctx.textBaseline = 'top';
      ctx.font = `650 ${13 * SCALE}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

      let y = PAD;
      for (const row of rows) {
        overlay(true, `Rendering ${row.name}…`);
        ctx.fillText(`${row.name}   ${row.count}`, PAD, y + (LABEL_H - 13 * SCALE) / 2);
        y += LABEL_H;
        let x = PAD;
        for (const card of row.cards) {
          // hi (JPEG) rather than the PNG default — smaller per-card
          // payloads add up fast once several placements are captured back
          // to back for one board image.
          const url = await withTimeout(snapshot(card.node, { hi: true }), 45000, `${row.name} card render`);
          await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
              ctx.drawImage(img, x, y, card.w, card.h);
              img.onload = img.onerror = null;
              img.src = '';
              resolve();
            };
            img.onerror = () => { img.onload = img.onerror = null; reject(new Error('Could not render a placement image')); };
            img.src = url;
          });
          x += card.w + GAP;
        }
        y += row.rowH + GAP;
      }
      return canvas.toDataURL('image/png');
    } finally {
      if (wasSafe) state.safe = true;
      document.body.classList.remove('exporting');
      renderBoardOnly();
    }
  }

  async function exportBoardPng() {
    let url;
    overlay(true, 'Rendering board…');
    try { url = await boardImage(); } finally { overlay(false); }
    const r = await window.api.saveFile({
      defaultName: 'social-preview-board.png',
      dataUrl: url,
      filters: [{ name: 'PNG', extensions: ['png'] }],
    });
    if (r.ok) toast('Board saved → ' + r.path);
  }

  async function exportBoardPdf() {
    let url;
    overlay(true, 'Building PDF…');
    try { url = await boardImage(); } finally { overlay(false); }
    const img = new Image();
    await new Promise((res) => { img.onload = res; img.src = url; });
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: img.width >= img.height ? 'landscape' : 'portrait',
      unit: 'pt',
      format: [img.width / 2, img.height / 2],
    });
    // exportComparePdf() (below) already learned this lesson: jsPDF's PNG
    // path decodes and re-processes raw pixel data, while its JPEG path just
    // embeds the already-compressed bytes — cheaper for a multi-megabyte
    // board image, so it's re-encoded as JPEG here before handing it to jsPDF.
    const jpegCanvas = document.createElement('canvas');
    jpegCanvas.width = img.width;
    jpegCanvas.height = img.height;
    const jctx = jpegCanvas.getContext('2d');
    jctx.fillStyle = '#0b0b0c';
    jctx.fillRect(0, 0, jpegCanvas.width, jpegCanvas.height);
    jctx.drawImage(img, 0, 0);
    const jpegUrl = jpegCanvas.toDataURL('image/jpeg', 0.9);
    pdf.addImage(jpegUrl, 'JPEG', 0, 0, img.width / 2, img.height / 2);
    const out = pdf.output('datauristring');
    const r = await window.api.saveFile({
      defaultName: 'social-preview-board.pdf',
      dataUrl: out,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (r.ok) toast('PDF saved → ' + r.path);
  }

  /* ---------- ready pack (production assets + copy, per platform) ---------- */
  function slugify(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'post';
  }

  // Crop the source image to an exact production size, honouring the focal point.
  // Releases the canvas backing store before resolving — a ready pack builds a
  // dozen+ large canvases in a tight loop and the packaged (sandboxed) renderer
  // will crash on the accumulated GPU memory if they're left for the GC.
  function cropToSpec(slide, w, h) {
    return new Promise((resolve) => {
      const img = new Image();
      const done = (out) => {
        img.onload = img.onerror = null;
        img.src = '';
        resolve(out);
      };
      img.onload = () => {
        let c = document.createElement('canvas');
        let out = '';
        try {
          c.width = w; c.height = h;
          const ctx = c.getContext('2d');
          ctx.imageSmoothingQuality = 'high';
          const f = slide.focal || { x: 50, y: 50 };
          if (state.fit === 'contain') {
            ctx.fillStyle = state.pad || '#000';
            ctx.fillRect(0, 0, w, h);
            const s = Math.min(w / img.width, h / img.height);
            const dw = img.width * s, dh = img.height * s;
            ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
          } else {
            const s = Math.max(w / img.width, h / img.height);
            const dw = img.width * s, dh = img.height * s;
            ctx.drawImage(img, (w - dw) * (f.x / 100), (h - dh) * (f.y / 100), dw, dh);
          }
          out = c.toDataURL('image/jpeg', 0.95);
        } catch (e) {
          out = '';
        }
        // free the backing store immediately
        c.width = 0; c.height = 0; c = null;
        done(out);
      };
      img.onerror = () => done('');
      img.src = slide.type === 'video' ? (slide.poster || slide.src) : slide.src;
    });
  }

  async function exportReadyPack() {
    if (!enabledList().length || !state.slides.length) return;
    const dflt = (state.editingId && (postById(state.editingId) || {}).title)
      || state.caption.trim().split('\n')[0].slice(0, 60) || '';
    $('#packTitle').value = dflt;
    $('#packWrap').hidden = false;
    $('#packTitle').focus();
    $('#packTitle').select();
  }

  async function runPackExport(packTitle) {
    const list = PLATFORMS.filter((p) => state.enabled.has(p.id));
    if (!list.length || !state.slides.length) return;
    overlay(true, 'Building ready pack…');
    const files = [];
    const guide = [];
    const title = (packTitle || '').trim() || 'ready pack';
    guide.push(
      'READY PACK — ' + title,
      state.name + '  ' + state.handle,
      new Date().toLocaleString(),
      list.length + ' placement' + (list.length === 1 ? '' : 's') + '  ·  post in this order:',
      '',
      list.map((p, i) => `  ${i + 1}. ${p.name} · ${p.placement}`).join('\n'),
      '', '',
    );
    const tags = state.hashtags.trim();
    const fc = state.firstComment.trim();
    try {
      for (const p of list) {
        const dir = slugify(p.name + '-' + p.placement);
        const ratioKey = state.ratio[p.id];
        const specSet = p.spec || {};
        const dims = specSet[ratioKey] || specSet[Object.keys(specSet)[0]] || [1080, 1080];
        const [w, h] = dims;
        const src = slidesFor(p.id);
        const multi = p.slides && p.slides !== 'single' && src.length > 1;
        const nSlides = multi ? Math.min(src.length, p.maxSlides || 10) : 1;
        const useSlides = multi ? src.slice(0, nSlides) : [src[Math.min(state.active, src.length - 1)] || src[0]];
        const customImg = hasImageOverride(p.id);

        for (let i = 0; i < useSlides.length; i++) {
          overlay(true, `${p.name} ${p.placement} — image ${i + 1}…`);
          const durl = await cropToSpec(useSlides[i], w, h);
          if (durl) {
            const nm = useSlides.length > 1
              ? `${dir}/${String(i + 1).padStart(2, '0')}-${w}x${h}.jpg`
              : `${dir}/${w}x${h}.jpg`;
            files.push({ name: nm, dataUrl: durl });
          }
          // let the compositor reclaim canvas memory between big crops
          await new Promise((r) => setTimeout(r, 16));
        }

        const isTitle = !!capRule(p).isTitle;
        const body = capBase(p.id).trim();
        files.push({ name: `${dir}/${isTitle ? 'title' : 'caption'}.txt`, text: body || '(none)' });
        if (tags && HASHTAG_OK.has(p.id)) files.push({ name: `${dir}/hashtags.txt`, text: tags });
        if (fc && (p.id === 'ig-feed' || p.id === 'li-feed')) files.push({ name: `${dir}/first-comment.txt`, text: fc });
        const alts = useSlides.map((s, i) => `Image ${i + 1}: ${(s.alt || '').trim() || '(no alt text — add one)'}`).join('\n');
        files.push({ name: `${dir}/alt-text.txt`, text: alts });

        guide.push(
          '════════════════════════════════════════',
          `${p.name} · ${p.placement}`,
          `image size: ${w}×${h}${useSlides.length > 1 ? `   ·   ${useSlides.length} images` : ''}${customImg ? '   ·   format-specific graphic' : ''}`,
          '',
          (isTitle ? 'TITLE:' : 'CAPTION:'),
          body || '(none)',
          '',
        );
        if (tags && HASHTAG_OK.has(p.id)) guide.push('HASHTAGS:', tags, '');
        if (fc && (p.id === 'ig-feed' || p.id === 'li-feed')) guide.push('FIRST COMMENT:', fc, '');
        guide.push('ALT TEXT:', alts, '', '');
      }
      files.unshift({ name: '00-POSTING-GUIDE.txt', text: guide.join('\n') });
    } finally {
      overlay(false);
    }
    const r = await window.api.saveBundle({ folderName: `${slugify(title)}-ready-pack`, files });
    if (r.canceled) return toast('Export cancelled');
    if (r.ok) toast(`Ready pack “${title}” saved — ${r.count} files → ${r.dir}`, 7000);
  }

  /* ---------- send to scheduler (CSV for Buffer/Later/… + an .ics calendar) ---------- */
  function schedCaption(snap, pid) {
    const ov = (snap.captionOverride && snap.captionOverride[pid] || '').trim();
    let t = ov ? snap.captionOverride[pid] : (snap.caption || '');
    const tags = (snap.hashtags || '').trim();
    if (tags && HASHTAG_OK.has(pid)) t = (t.trim() ? t.trim() + '\n\n' : '') + tags;
    return t.trim();
  }
  const csvCell = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const icsEsc = (v) => String(v == null ? '' : v).replace(/\\/g, '\\\\').replace(/[,;]/g, (m) => '\\' + m).replace(/\r?\n/g, '\\n');
  const icsDate = (iso) => (iso || todayISO()).replace(/-/g, '');
  const icsDatePlus1 = (iso) => {
    const d = new Date((iso || todayISO()) + 'T00:00');
    d.setDate(d.getDate() + 1);
    return icsDate(d.toISOString().slice(0, 10));
  };

  async function exportScheduler() {
    const posts = [...state.posts].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    if (!posts.length) return toast('No saved posts yet — save a post to the calendar first');

    // the post open in the composer may have edits that were never saved — export
    // what the user currently sees for it, not the stale saved snapshot
    const liveSnap = state.editingId ? snapshotState() : null;
    const snapFor = (p) => (liveSnap && p.id === state.editingId) ? liveSnap : (p.snapshot || {});

    const rows = [['Date', 'Time', 'Channel', 'Title', 'Caption', 'First comment', 'Link', 'Status', 'Live URL']];
    let rowCount = 0;
    for (const p of posts) {
      const snap = snapFor(p);
      const pids = (Array.isArray(snap.enabled) && snap.enabled.length)
        ? snap.enabled : PLATFORMS.map((x) => x.id);
      const link = snap.link || '';
      for (const pid of pids) {
        const pl = PLATFORMS.find((x) => x.id === pid);
        if (!pl) continue;
        rows.push([
          p.date || '', '09:00',
          `${pl.name}${pl.placement ? ' · ' + pl.placement : ''}`,
          p.title || 'Untitled',
          schedCaption(snap, pid),
          (pid === 'ig-feed' || pid === 'li-feed') ? (snap.firstComment || '') : '',
          link, p.status || 'draft', p.liveUrl || '',
        ]);
        rowCount++;
      }
    }
    const csv = rows.map((r) => r.map(csvCell).join(',')).join('\r\n');

    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Social Preview Studio//Content Calendar//EN', 'CALSCALE:GREGORIAN',
    ];
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    for (const p of posts) {
      const snap = snapFor(p);
      const pids = (Array.isArray(snap.enabled) && snap.enabled.length) ? snap.enabled : [];
      const chList = pids.map((id) => (PLATFORMS.find((x) => x.id === id) || {}).name).filter(Boolean);
      const uniq = [...new Set(chList)];
      const first = (snap.caption || '').trim().split('\n')[0].slice(0, 220);
      ics.push(
        'BEGIN:VEVENT',
        `UID:${p.id}@social-preview-studio`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${icsDate(p.date)}`,
        `DTEND;VALUE=DATE:${icsDatePlus1(p.date)}`,
        `SUMMARY:${icsEsc('📣 ' + (p.title || 'Untitled') + (uniq.length ? ' — ' + uniq.join(', ') : ''))}`,
        `DESCRIPTION:${icsEsc((first ? first + '\n\n' : '') + 'Status: ' + (p.status || 'draft') + (p.liveUrl ? '\nLive: ' + p.liveUrl : ''))}`,
        'END:VEVENT',
      );
    }
    ics.push('END:VCALENDAR');

    const readme = [
      'CONTENT CALENDAR EXPORT', '=======================', '',
      new Date().toLocaleString(),
      `${posts.length} post${posts.length === 1 ? '' : 's'}  ·  ${rowCount} scheduled row${rowCount === 1 ? '' : 's'}`,
      '',
      'content-calendar.csv',
      '  One row per post per channel: Date, Time (defaults to 09:00 — adjust in your',
      '  scheduler), Channel, Title, Caption (hashtags already appended for IG/TikTok/',
      '  LinkedIn/Facebook), First comment, Link, Status, Live URL.',
      '  Import into Buffer, Later, Publer, Metricool, Hootsuite, etc. as a bulk CSV —',
      '  map the columns in their importer. Images are in the Ready pack, not here.',
      '',
      'content-calendar.ics',
      '  Double-click to add every post to Apple Calendar / Google Calendar / Outlook',
      '  as an all-day event on its date. Re-importing updates the same events.',
    ].join('\n');

    const r = await window.api.saveBundle({
      folderName: `content-calendar-${todayISO()}`,
      files: [
        { name: 'content-calendar.csv', text: csv },
        { name: 'content-calendar.ics', text: ics.join('\r\n') },
        { name: 'README.txt', text: readme },
      ],
    });
    if (r.canceled) return toast('Export cancelled');
    if (r.ok) toast(`Calendar exported — ${rowCount} rows + .ics → ${r.dir}`, 7000);
  }

  /* ---------- shareable review file ---------- */
  // Shared by the local .html export and the "publish package" — renders every
  // enabled placement to a PNG and collects the caption/alt/carousel info for it.
  async function buildReviewCards(opts) {
    const light = !!(opts && opts.light);
    const list = PLATFORMS.filter((p) => state.enabled.has(p.id));
    if (!list.length || !state.slides.length) return null;
    overlay(true, 'Rendering placements…');
    document.body.classList.add('exporting');
    // The "Safe areas" guide (name/caption/button zone labels) is an
    // editing aid only — never bake it into what a reviewer sees.
    const wasSafe = state.safe;
    if (wasSafe) state.safe = false;
    const savedActive = state.active;
    const nSlides = state.slides.length;
    const cards = [];
    try {
      for (const p of list) {
        const src = slidesFor(p.id);
        const n = src.length;
        let caro = hasImageOverride(p.id) ? 'format-specific image' : '';
        if (p.slides && p.slides !== 'single' && n > 1) {
          caro = p.slides === 'swipe'
            ? `carousel · ${n} slides`
            : `${Math.min(n, p.maxSlides || 4)} of ${n} images shown`;
        }

        // Reviewers used to only ever see whichever slide happened to be
        // active when publishing, with no way to flip through the rest of
        // the carousel — capture every slide (capped, to keep the upload
        // bounded) so the review page can offer a real slider.
        const isCarousel = p.slides === 'swipe' && nSlides > 1 && !hasImageOverride(p.id);
        let url, hi, imgs;
        if (isCarousel) {
          const cap = Math.min(nSlides, 8);
          imgs = [];
          for (let i = 0; i < cap; i++) {
            state.active = i;
            overlay(true, `${p.name} ${p.placement} — slide ${i + 1}/${cap}…`);
            renderBoardOnly();
            await raf();
            imgs.push(await snapshot(captureFor(p.id), { light }));
          }
          const shownIdx = Math.min(savedActive, cap - 1);
          url = imgs[shownIdx];
          hi = '';
          if (light) {
            state.active = shownIdx;
            renderBoardOnly();
            await raf();
            try { hi = await snapshot(captureFor(p.id), { hi: true }); }
            catch (e) { hi = ''; }
          }
        } else {
          state.active = savedActive;
          overlay(true, `${p.name} ${p.placement}…`);
          renderBoardOnly();
          await raf();
          url = await snapshot(captureFor(p.id), { light });
          hi = '';
          if (light) {
            try { hi = await snapshot(captureFor(p.id), { hi: true }); }
            catch (e) { hi = ''; } // zoom just falls back to the regular image
          }
        }

        const shownSlide = src[Math.min(savedActive, n - 1)] || src[0];
        cards.push({
          name: `${p.name} · ${p.placement}`, platform: p.id, accent: p.accent, img: url, hi, caro,
          imgs: imgs && imgs.length > 1 ? imgs : undefined,
          customCap: hasOverride(p.id) ? capFor(p.id) : '',
          alt: (shownSlide && shownSlide.alt || '').trim(),
        });
      }
    } finally {
      state.active = savedActive;
      if (wasSafe) state.safe = true;
      document.body.classList.remove('exporting');
      render();
      overlay(false);
    }
    return cards;
  }

  /* ---------- publish for review (hosted link, no export/import round-trip) ---------- */
  async function publishForReview() {
    const cards = await buildReviewCards({ light: true });
    if (!cards) return;

    // A review link is only trackable (notifications, day-panel thread) if
    // it's attached to a saved post — auto-save one first if the user
    // published straight from an unsaved composer (same shape as doSave()'s
    // "new post" branch, just without popping the title/date modal).
    if (!state.editingId || !postById(state.editingId)) {
      const thumb = await makeThumb();
      const id = uid('p');
      const title = state.pendingTitle.trim()
        || state.caption.trim().split('\n')[0].slice(0, 60) || 'Untitled post';
      state.posts.push({
        id, title, date: targetDate || todayISO(), thumb, status: 'draft', liveUrl: '',
        updatedAt: Date.now(), createdAt: Date.now(), snapshot: snapshotState(),
      });
      state.editingId = id;
      state.pendingTitle = '';
      targetDate = null;
      persistPosts();
    }

    const post = postById(state.editingId);
    const title = post.title;
    // The "view full size" zoom rides along as extra bytes per card — drop it
    // for this publish (falls back to the regular preview) rather than risk
    // tripping the backend's request-size limit on a post with many images.
    const hiTotal = cards.reduce((sum, c) => sum + (c.hi ? c.hi.length : 0), 0);
    const includeHi = hiTotal > 0 && hiTotal < 2500000;
    const payload = {
      // Reusing the same reviewId updates that post's record in place on the
      // backend (same URL, comments untouched) instead of minting a new link
      // — re-publishing a post already in review no longer orphans its thread
      // behind a stale link every time a small change is made.
      id: post.reviewId || undefined,
      title, date: post.date || todayISO(),
      brand: { name: state.name, handle: state.handle },
      caption: state.caption.trim(),
      hashtags: state.hashtags.trim(),
      firstComment: state.firstComment.trim(),
      cards: cards.map((c) => ({
        name: c.name, platform: c.platform || '', accent: c.accent || '', img: c.img,
        hi: includeHi ? (c.hi || '') : '', imgs: c.imgs || [], caro: c.caro || '',
        customCaption: c.customCap || '', alt: c.alt || '',
      })),
    };
    overlay(true, post.reviewId ? 'Updating…' : 'Publishing…');
    let r;
    try { r = await window.api.publishPost(payload); }
    finally { overlay(false); }
    if (!r || !r.ok) return toast('Could not publish: ' + ((r && r.error) || 'unknown error'), 6000);

    const wasUpdate = !!r.updated;
    post.reviewId = r.id; post.reviewUrl = r.url;
    if (!wasUpdate) { post.reviewSeen = 0; post.reviewComments = []; post.reviewNotified = 0; }
    post.updatedAt = Date.now();
    // Re-publishing an already-saved post (the normal "Update review" case)
    // only touched review-link bookkeeping here — the calendar thumbnail and
    // saved snapshot kept showing whatever images the post had when it was
    // first saved, even after swapping in new ones and republishing.
    post.thumb = await makeThumb();
    post.snapshot = snapshotState();
    persistPosts();
    renderCalendar();
    updateReviewBadge();
    render(); // refreshes the publish button's label ("Update review" once reviewId is set)
    try { await navigator.clipboard.writeText(r.url); } catch (e) {}
    toast(
      wasUpdate
        ? 'Review updated — same link, comments untouched: ' + r.url
        : 'Link copied — paste it anywhere: ' + r.url,
      9000, () => window.api.openUrl(r.url), 'Open');
  }

  /* ---------- compare tool: publish N candidate images for review ---------- */
  // Reuses the same hosted review link as a normal post — each candidate is
  // just its own card, so reviewers get the existing per-card approve /
  // needs-work / comment UI for free, no backend changes needed.
  async function publishCompareReview() {
    const filled = state.compareItems
      .map((item, i) => ({ item, i }))
      .filter(({ item }) => item.img);
    if (filled.length < 2) return;
    const title = 'Image comparison — ' + new Date().toLocaleDateString();
    overlay(true, 'Publishing…');
    let r;
    try {
      // Full-quality candidates can easily add up to several MB combined,
      // which the review backend's request-size limit rejects (HTTP 413) —
      // shrink each one for the network payload only, same as the regular
      // publish-for-review flow already does for its own mockup captures.
      const cardImgs = await Promise.all(filled.map(({ item }) => compressForUpload(item.img)));
      const payload = {
        title, date: todayISO(),
        brand: { name: state.name, handle: state.handle },
        caption: state.compareCaption.trim(), hashtags: state.compareHashtags.trim(), firstComment: '',
        cards: filled.map(({ i }, idx) => ({ name: compareLabel(i), img: cardImgs[idx] })),
      };
      r = await window.api.publishPost(payload);
    } finally { overlay(false); }
    if (!r || !r.ok) return toast('Could not publish: ' + ((r && r.error) || 'unknown error'), 6000);

    state.posts.push({
      id: uid('cmp'), title, date: todayISO(), thumb: filled[0].item.img, status: 'draft', liveUrl: '',
      updatedAt: Date.now(), createdAt: Date.now(), snapshot: null, isComparison: true,
      reviewId: r.id, reviewUrl: r.url, reviewSeen: 0, reviewComments: [], reviewNotified: 0,
    });
    persistPosts();
    updateReviewBadge();
    try { await navigator.clipboard.writeText(r.url); } catch (e) {}
    toast('Link copied — paste it anywhere: ' + r.url, 9000, () => window.api.openUrl(r.url), 'Open');
  }
  /* ================= saved posts + calendar ================= */
  let targetDate = null; // date pre-selected for the next save (from "new post this day")
  const postById = (id) => state.posts.find((p) => p.id === id);

  function snapSlides(arr) {
    return (arr || []).map((s) => ({ src: s.src, type: s.type || 'image', focal: { ...s.focal }, poster: s.poster || '', alt: s.alt || '' }));
  }
  function snapshotState() {
    const so = {};
    for (const [k, v] of Object.entries(state.slideOverride)) if (v && v.length) so[k] = snapSlides(v);
    return {
      slides: snapSlides(state.slides),
      slideOverride: so,
      active: state.active, fit: state.fit, pad: state.pad,
      caption: state.caption, captionOverride: { ...state.captionOverride },
      hashtags: state.hashtags, firstComment: state.firstComment,
      brandId: state.brandId, name: state.name, handle: state.handle, avatar: state.avatar, link: state.link,
      enabled: [...state.enabled], ratio: { ...state.ratio },
    };
  }
  function applySnapshot(s) {
    s = s || {};
    const readSlides = (arr) => (arr || []).map((x) => ({
      src: x.src, type: x.type === 'video' ? 'video' : 'image',
      focal: x.focal || { x: 50, y: 50 }, poster: x.poster || '', alt: x.alt || '',
    }));
    state.slides = readSlides(s.slides);
    state.slideOverride = {};
    if (s.slideOverride && typeof s.slideOverride === 'object') {
      for (const [k, v] of Object.entries(s.slideOverride)) {
        if (Array.isArray(v) && v.length && PLATFORMS.some((p) => p.id === k)) {
          state.slideOverride[k] = readSlides(v);
        }
      }
    }
    state.active = s.active || 0;
    state.fit = s.fit === 'contain' ? 'contain' : 'cover';
    state.pad = s.pad || '#000000';
    state.caption = s.caption || '';
    state.captionOverride = s.captionOverride ? { ...s.captionOverride } : {};
    state.captionTarget = 'master';
    state.hashtags = s.hashtags || '';
    state.firstComment = s.firstComment || '';
    // restore the brand this post used (recreate it if it was deleted)
    if (s.brandId && state.brands.some((b) => b.id === s.brandId)) {
      state.brandId = s.brandId;
    } else if (s.name) {
      const b = { id: uid('b'), name: s.name, handle: s.handle || '@brand', avatar: s.avatar || null, link: s.link || '', feedbackEmail: '' };
      state.brands.push(b);
      state.brandId = b.id;
    }
    applyBrand();
    if (Array.isArray(s.enabled) && s.enabled.length) state.enabled = new Set(s.enabled);
    if (s.ratio) state.ratio = { ...state.ratio, ...s.ratio };
    state.expanded = new Set();
    state.undo = []; state.redo = [];
    applySettingsToUI();
  }

  /* ---------- templates (reusable post setups, no photo) ---------- */
  function currentOverrideSnap() {
    const so = {};
    for (const [k, v] of Object.entries(state.slideOverride)) if (v && v.length) so[k] = snapSlides(v);
    return so;
  }
  function saveAsTemplate(rawName) {
    const name = (rawName || '').trim();
    if (!name) { toast('Give the template a name first'); return false; }
    const snap = snapshotState();
    snap.slides = [];
    snap.slideOverride = {};
    snap.active = 0;
    const existing = state.templates.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      existing.snap = snap;
      existing.updatedAt = Date.now();
      toast(`Template “${name}” updated`);
    } else {
      state.templates.unshift({ id: uid('t'), name, createdAt: Date.now(), snap });
      toast(`Template “${name}” saved`);
    }
    persistTemplates();
    $('#tplName').value = '';
    renderTemplates();
    return true;
  }
  function applyTemplate(id) {
    const t = state.templates.find((x) => x.id === id);
    if (!t) return;
    const keepSlides = snapSlides(state.slides);
    const keepOverride = currentOverrideSnap();
    applySnapshot({ ...t.snap, slides: keepSlides, slideOverride: keepOverride });
    // a template stamp starts a fresh post unless we're clearly still editing the same one
    render();
    toast(`Applied template “${t.name}”`);
  }
  function deleteTemplate(id) {
    const t = state.templates.find((x) => x.id === id);
    if (!t) return;
    state.templates = state.templates.filter((x) => x.id !== id);
    persistTemplates();
    renderTemplates();
    toast(`Deleted template “${t.name}”`, 4000, () => {
      state.templates.unshift(t);
      persistTemplates();
      renderTemplates();
    }, 'Undo');
  }
  function renderTemplates() {
    const box = $('#tplList');
    if (!box) return;
    if (!state.templates.length) {
      box.innerHTML = '<p class="field-note" style="margin:6px 0 0">No templates yet. Set up a post the way you like it, then save it here.</p>';
      return;
    }
    box.innerHTML = state.templates.map((t) => {
      const snap = t.snap || {};
      const nPl = Array.isArray(snap.enabled) ? snap.enabled.length : 0;
      const capBits = (snap.caption || '').trim().split('\n')[0].slice(0, 44);
      return `<div class="tpl-row" data-id="${t.id}">
        <div class="tpl-meta">
          <b>${escapeHtml(t.name)}</b>
          <small>${nPl} placement${nPl === 1 ? '' : 's'}${capBits ? ' · “' + escapeHtml(capBits) + '…”' : ''}</small>
        </div>
        <button class="btn btn-sm tpl-apply" data-id="${t.id}">Apply</button>
        <button class="tpl-del" data-id="${t.id}" title="Delete template">${ICONS.plus}</button>
      </div>`;
    }).join('');
    box.querySelectorAll('.tpl-apply').forEach((b) =>
      b.addEventListener('click', () => applyTemplate(b.dataset.id)));
    box.querySelectorAll('.tpl-del').forEach((b) =>
      b.addEventListener('click', () => deleteTemplate(b.dataset.id)));
  }

  function makeThumb() {
    return new Promise((resolve) => {
      const s0 = state.slides[0];
      const src = s0 && (s0.type === 'video' ? (s0.poster || '') : s0.src);
      if (!src) return resolve('');
      const img = new Image();
      img.onload = () => {
        const w = 220, h = Math.min(Math.round((img.height / img.width) * w) || 220, 300);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        const f = s0.focal || { x: 50, y: 50 };
        const scale = Math.max(w / img.width, h / img.height);
        const dw = img.width * scale, dh = img.height * scale;
        ctx.drawImage(img, (w - dw) * (f.x / 100), (h - dh) * (f.y / 100), dw, dh);
        resolve(c.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = () => resolve('');
      img.src = src;
    });
  }

  function openSaveModal() {
    if (!state.slides.length) return;
    const existing = state.editingId ? postById(state.editingId) : null;
    $('#saveTitle').value = existing ? existing.title
      : (state.pendingTitle.trim() || state.caption.trim().split('\n')[0].slice(0, 60) || 'Untitled post');
    $('#saveDate').value = existing ? existing.date : (targetDate || todayISO());
    $('#saveAsNew').hidden = !existing;
    $('#modalWrap').hidden = false;
    $('#saveTitle').focus();
    $('#saveTitle').select();
  }

  async function doSave(asNew) {
    const title = $('#saveTitle').value.trim() || 'Untitled post';
    const date = $('#saveDate').value || todayISO();
    const thumb = await makeThumb();
    const existing = !asNew && state.editingId ? postById(state.editingId) : null;
    if (existing) {
      existing.title = title; existing.date = date; existing.thumb = thumb;
      existing.updatedAt = Date.now(); existing.snapshot = snapshotState();
    } else {
      const id = uid('p');
      state.posts.push({
        id, title, date, thumb, status: 'draft', liveUrl: '',
        updatedAt: Date.now(), createdAt: Date.now(), snapshot: snapshotState(),
      });
      state.editingId = id;
      state.pendingTitle = '';
    }
    persistPosts();
    targetDate = null;
    $('#modalWrap').hidden = true;
    render();
    toast(`Saved “${title}” → ${fmtDate(date)}`);
  }

  function duplicatePost(id) {
    const p = postById(id);
    if (!p) return;
    const copy = JSON.parse(JSON.stringify(p));
    copy.id = uid('p');
    copy.title = p.title + ' (copy)';
    copy.status = 'draft'; copy.liveUrl = ''; copy.feedback = [];
    copy.reviewId = ''; copy.reviewUrl = ''; copy.reviewComments = []; copy.reviewSeen = 0; copy.reviewNotified = 0;
    copy.reviewArchived = false;
    copy.updatedAt = Date.now(); copy.createdAt = Date.now();
    state.posts.push(copy);
    persistPosts();
    toast(`Duplicated “${p.title}”`);
    renderCalendar();
    return copy.id;
  }
  function deletePost(id) {
    const i = state.posts.findIndex((p) => p.id === id);
    if (i < 0) return;
    const [p] = state.posts.splice(i, 1);
    state.trash.push({ ...p, deletedAt: Date.now() });
    if (state.editingId === id) state.editingId = null;
    persistPosts();
    toast(`“${p.title}” moved to Recently deleted`, 4000, () => {
      state.trash = state.trash.filter((x) => x.id !== p.id);
      state.posts.push(p);
      persistPosts();
      renderCalendar();
      if (state.view === 'reviews') renderReviews();
      updateReviewBadge();
    }, 'Undo');
    updateReviewBadge();
  }
  // Removing a post from the Reviews list only clears its review-tracking
  // fields — the post itself (and its Calendar placement) stays untouched.
  // Deleting the post entirely is still done from Calendar via deletePost().
  function removeFromReviews(id) {
    const p = postById(id);
    if (!p) return;
    const snapshot = {
      reviewId: p.reviewId, reviewUrl: p.reviewUrl, reviewComments: p.reviewComments,
      reviewSeen: p.reviewSeen, reviewNotified: p.reviewNotified, reviewArchived: p.reviewArchived,
    };
    p.reviewId = ''; p.reviewUrl = ''; p.reviewComments = []; p.reviewSeen = 0;
    p.reviewNotified = 0; p.reviewArchived = false;
    p.updatedAt = Date.now();
    persistPosts();
    renderReviews();
    updateReviewBadge();
    toast(`Removed “${p.title}” from Reviews`, 4000, () => {
      Object.assign(p, snapshot);
      persistPosts();
      renderReviews();
      updateReviewBadge();
    }, 'Undo');
  }
  function setPostStatus(id, status) {
    const p = postById(id);
    if (!p) return;
    p.status = status; p.updatedAt = Date.now();
    persistPosts();
  }

  function openPost(id) {
    const p = postById(id);
    if (!p) return;
    applySnapshot(p.snapshot);
    state.editingId = id;
    state.focusPid = null;
    $('#dayPanel').hidden = true;
    setView('focus');
  }
  // Clears the current compose session (images, caption, hashtags, first
  // comment, all per-placement overrides) back to an empty draft — offers
  // Undo since it can wipe unsaved work. Doesn't touch anything already
  // saved to Calendar/Reviews if this was an existing post being edited.
  function startOver() {
    if (!state.slides.length && !state.caption.trim() && !state.hashtags.trim() && !state.firstComment.trim()) {
      return toast('Already a clean slate');
    }
    const prevSnap = snapshotState();
    const prevEditingId = state.editingId;
    applySnapshot({});
    state.slides = [];
    state.caption = ''; state.hashtags = ''; state.firstComment = '';
    state.captionOverride = {};
    state.slideOverride = {};
    state.editingId = null;
    const prevPendingTitle = state.pendingTitle;
    state.pendingTitle = '';
    $('#dayPanel').hidden = true;
    render();
    toast('Cleared — starting fresh', 6000, () => {
      applySnapshot(prevSnap);
      state.editingId = prevEditingId;
      state.pendingTitle = prevPendingTitle;
      render();
    }, 'Undo');
  }

  function currentProjectTitle() {
    return state.editingId ? (postById(state.editingId)?.title || '') : state.pendingTitle;
  }
  function renameProject(rawTitle) {
    const title = rawTitle.trim().slice(0, 120);
    if (!title) return;
    if (state.editingId) {
      const post = postById(state.editingId);
      if (post && post.title !== title) {
        post.title = title;
        post.updatedAt = Date.now();
        persistPosts();
        renderCalendar();
      }
    } else {
      state.pendingTitle = title;
    }
    render();
  }
  function startTitleEdit() {
    if (state.view !== 'focus' && state.view !== 'board') return;
    const span = $('#tbTitle'), input = $('#tbTitleInput');
    input.value = currentProjectTitle();
    span.hidden = true;
    input.hidden = false;
    input.focus();
    input.select();
  }
  let suppressTitleCommit = false;
  function endTitleEdit(commit) {
    const span = $('#tbTitle'), input = $('#tbTitleInput');
    if (commit) renameProject(input.value);
    input.hidden = true;
    span.hidden = false;
  }

  function newPost(date) {
    applySnapshot({});
    state.slides = [];
    state.caption = ''; state.hashtags = ''; state.firstComment = '';
    state.captionOverride = {};
    state.slideOverride = {};
    state.editingId = null;
    state.pendingTitle = '';
    targetDate = date || null;
    $('#dayPanel').hidden = true;
    setView('focus');
    toast(date ? `New post for ${fmtDate(date)} — add images` : 'New post');
  }

  /* ---------- calendar rendering ---------- */
  function fmtDate(iso) {
    const d = new Date(iso + 'T00:00');
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function monthKey(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }

  const STATUS = { draft: ['Draft', '#a8a29e'], ready: ['Ready', '#4d8dff'], posted: ['Posted', '#5fb872'] };
  const isoOf = (d) => {
    const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
    return x.toISOString().slice(0, 10);
  };
  function postsByDate() {
    const by = {};
    // Compare-tool posts exist only to carry a review thread — they never
    // had a Calendar placement, so they're excluded from every date bucket.
    state.posts.forEach((p) => { if (p.isComparison) return; (by[p.date] = by[p.date] || []).push(p); });
    Object.values(by).forEach((a) => a.sort((x, y) => x.createdAt - y.createdAt));
    return by;
  }
  function calMatches(p) {
    const q = state.calSearch.trim().toLowerCase();
    if (!q) return true;
    return (p.title || '').toLowerCase().includes(q) ||
      ((p.snapshot && p.snapshot.caption) || '').toLowerCase().includes(q);
  }

  function chipEl(p, big) {
    const chip = el('button', 'cal-chip' + (big ? ' big' : ''));
    const st = STATUS[p.status] || STATUS.draft;
    const fbn = (p.feedback || []).length;
    chip.innerHTML =
      `<span class="cc-thumb"${p.thumb ? ` style="background-image:url(${p.thumb})"` : ''}></span>` +
      `<span class="cc-t">${escapeHtml(p.title)}</span>` +
      (fbn ? `<span class="cc-fb" title="${fbn} review${fbn === 1 ? '' : 's'}">${fbn}</span>` : '') +
      `<span class="cc-dot" style="background:${st[1]}" title="${st[0]}"></span>`;
    chip.title = p.title + ' · ' + st[0];
    chip.draggable = true;
    chip.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', p.id); });
    chip.addEventListener('click', (e) => { e.stopPropagation(); openPost(p.id); });
    return chip;
  }

  function renderCalendar() {
    const cv = state.calView;
    $('#calList').hidden = cv !== 'list';
    $('#calGrid').hidden = cv === 'list';
    $('#calDow').hidden = cv === 'list';
    $('#calSearch').hidden = cv !== 'list';
    $('#calPrev').style.visibility = cv === 'list' ? 'hidden' : '';
    $('#calNext').style.visibility = cv === 'list' ? 'hidden' : '';
    $('#calToday').style.visibility = cv === 'list' ? 'hidden' : '';
    [...$('#calViewSwitch').children].forEach((b) => b.classList.toggle('on', b.dataset.cv === cv));
    $('#calEmpty').hidden = state.posts.length > 0;

    const dow = $('#calDow');
    if (!dow.children.length) {
      ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach((d) =>
        dow.appendChild(el('span', 'cal-dow', d)));
    }
    if (cv === 'list') return renderCalList();

    const by = postsByDate();
    const today = isoOf(new Date());
    const grid = $('#calGrid');
    grid.innerHTML = '';

    let start, count, monthMode;
    if (cv === 'week') {
      start = new Date(state.calMonth);
      start.setDate(start.getDate() - start.getDay());
      count = 7; monthMode = false;
      grid.classList.add('week');
      const end = new Date(start); end.setDate(start.getDate() + 6);
      $('#calTitle').textContent = `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
    } else {
      const m = state.calMonth;
      $('#calTitle').textContent = m.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      const first = new Date(m.getFullYear(), m.getMonth(), 1);
      start = new Date(first); start.setDate(1 - first.getDay());
      count = 42; monthMode = true;
      grid.classList.remove('week');
    }

    for (let i = 0; i < count; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const iso = isoOf(d);
      const cell = el('div', 'cal-cell');
      if (monthMode && d.getMonth() !== state.calMonth.getMonth()) cell.classList.add('other');
      if (iso === today) cell.classList.add('today');
      cell.appendChild(el('span', 'cal-num', String(d.getDate())));
      const posts = (by[iso] || []);
      const cap = cv === 'week' ? 6 : (posts.length === 1 ? 1 : 3);
      posts.slice(0, cap).forEach((p) => cell.appendChild(chipEl(p, cv !== 'week' && posts.length === 1)));
      if (posts.length > cap) cell.appendChild(el('span', 'cal-more', `+${posts.length - cap} more`));
      cell.addEventListener('click', () => openDay(iso, by[iso] || []));
      cell.addEventListener('dragover', (e) => { e.preventDefault(); cell.classList.add('drop'); });
      cell.addEventListener('dragleave', () => cell.classList.remove('drop'));
      cell.addEventListener('drop', (e) => {
        e.preventDefault(); cell.classList.remove('drop');
        const id = e.dataTransfer.getData('text/plain');
        const p = postById(id);
        if (p && p.date !== iso) {
          p.date = iso; p.updatedAt = Date.now();
          persistPosts(); renderCalendar();
          toast(`Moved “${p.title}” to ${fmtDate(iso)}`);
        }
      });
      grid.appendChild(cell);
    }
  }

  function renderCalList() {
    const wrap = $('#calList');
    wrap.innerHTML = '';
    const items = state.posts.filter(calMatches).sort((a, b) => (a.date < b.date ? 1 : -1) || b.updatedAt - a.updatedAt);
    if (!items.length) {
      wrap.appendChild(el('p', 'dp-empty', state.calSearch ? 'No posts match your search.' : 'No saved posts yet.'));
      return;
    }
    items.forEach((p) => {
      const st = STATUS[p.status] || STATUS.draft;
      const row = el('div', 'cl-row');
      row.innerHTML =
        `<span class="cl-thumb"${p.thumb ? ` style="background-image:url(${p.thumb})"` : ''}></span>` +
        `<span class="cl-main"><b>${escapeHtml(p.title)}</b><small>${fmtDate(p.date)} · ${p.snapshot.slides.length} image${p.snapshot.slides.length === 1 ? '' : 's'}${(p.feedback || []).length ? ' · ' + p.feedback.length + ' review' + (p.feedback.length === 1 ? '' : 's') : ''}${p.liveUrl ? ' · <a href="' + escapeHtml(p.liveUrl) + '" target="_blank">live post ↗</a>' : ''}</small></span>` +
        `<span class="cl-status" style="color:${st[1]};border-color:${st[1]}">${st[0]}</span>`;
      row.querySelector('.cl-main').addEventListener('click', () => openPost(p.id));
      row.querySelector('.cl-thumb').addEventListener('click', () => openPost(p.id));
      wrap.appendChild(row);
    });
  }

  /* ---------- reviews list (In review / Completed) ---------- */
  // "Completed" = every placement that's gotten a verdict is Approved (and at
  // least one has). "In review" = published but either nothing verdicted yet,
  // or something's still flagged Needs work.
  function reviewVerdict(p) {
    const latest = {};
    (p.reviewComments || []).forEach((c) => { if (c.status) latest[c.cardName] = c.status; });
    const statuses = Object.values(latest);
    if (!statuses.length) return 'pending';
    return statuses.every((s) => s === 'Approved') ? 'done' : 'open';
  }

  function renderReviews() {
    const targets = state.posts.filter((p) => p.reviewId);
    const inReview = [], done = [], archived = [];
    targets.forEach((p) => {
      if (p.reviewArchived) archived.push(p);
      else if (reviewVerdict(p) === 'done') done.push(p);
      else inReview.push(p);
    });
    [inReview, done, archived].forEach((a) => a.sort((x, y) => (y.updatedAt || 0) - (x.updatedAt || 0)));

    $('#reviewsEmpty').hidden = !!targets.length;
    $('#reviewsInSection').hidden = !inReview.length;
    $('#reviewsDoneSection').hidden = !done.length;
    $('#reviewsArchivedSection').hidden = !archived.length;
    $('#reviewsInCount').textContent = inReview.length || '';
    $('#reviewsDoneCount').textContent = done.length || '';
    $('#reviewsArchivedCount').textContent = archived.length || '';

    const rowFor = (p, isArchived) => {
      const n = (p.reviewComments || []).length;
      const unseen = Math.max(0, n - (p.reviewSeen || 0));
      const v = reviewVerdict(p);
      const label = v === 'done' ? 'Approved' : v === 'open' ? 'Needs work' : 'Awaiting review';
      const color = v === 'done' ? '#5fb872' : v === 'open' ? '#e5604f' : '#a8a29e';
      const row = el('div', 'cl-row');
      row.innerHTML =
        `<span class="cl-thumb"${p.thumb ? ` style="background-image:url(${p.thumb})"` : ''}></span>` +
        `<span class="cl-main"><b>${escapeHtml(p.title)}</b><small>${fmtDate(p.date)}` +
        (n ? ` · ${n} comment${n === 1 ? '' : 's'}` : ' · no comments yet') +
        (!isArchived && unseen ? ` · <b>${unseen} new</b>` : '') + `</small></span>` +
        `<span class="cl-status" style="color:${color};border-color:${color}">${label}</span>`;
      // The row opens the actual review page (where the comments/verdicts
      // live) — not the image composer, which is often empty for a post
      // that only exists here for tracking a review thread.
      const openReview = () => window.api.openUrl(p.reviewUrl);
      row.querySelector('.cl-main').addEventListener('click', openReview);
      row.querySelector('.cl-thumb').addEventListener('click', openReview);

      const acts = el('div', 'reviews-row-acts');
      if (!p.isComparison) {
        const editBtn = el('button', 'btn btn-sm', 'Edit post');
        editBtn.addEventListener('click', (e) => { e.stopPropagation(); openPost(p.id); });
        acts.appendChild(editBtn);
      }
      if (isArchived) {
        const unBtn = el('button', 'btn btn-sm', 'Unarchive');
        unBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          p.reviewArchived = false; p.updatedAt = Date.now();
          persistPosts(); renderReviews(); updateReviewBadge();
        });
        acts.appendChild(unBtn);
      } else {
        const archBtn = el('button', 'btn btn-sm', 'Archive');
        archBtn.title = 'Mark this review as done and file it away';
        archBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          p.reviewArchived = true; p.reviewSeen = n; p.updatedAt = Date.now();
          persistPosts(); renderReviews(); updateReviewBadge();
          toast(`“${p.title}” archived`);
        });
        acts.appendChild(archBtn);
      }
      const delBtn = el('button', 'btn btn-sm dp-danger', 'Delete');
      delBtn.title = p.isComparison
        ? 'Delete this comparison'
        : 'Remove this review — the post stays on your Calendar';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // A comparison post has no Calendar placement to protect — deleting
        // it here should remove it outright rather than leave an orphan.
        if (p.isComparison) { deletePost(p.id); renderReviews(); }
        else removeFromReviews(p.id);
      });
      acts.appendChild(delBtn);
      row.appendChild(acts);
      return row;
    };

    const inWrap = $('#reviewsInList'); inWrap.innerHTML = '';
    inReview.forEach((p) => inWrap.appendChild(rowFor(p, false)));
    const doneWrap = $('#reviewsDoneList'); doneWrap.innerHTML = '';
    done.forEach((p) => doneWrap.appendChild(rowFor(p, false)));
    const archWrap = $('#reviewsArchivedList'); archWrap.innerHTML = '';
    archived.forEach((p) => archWrap.appendChild(rowFor(p, true)));
  }

  /* ---------- auto clip ---------- */
  function mmssToSec(s) {
    // Gemini sticks to m:ss for anything under an hour but may switch to
    // h:mm:ss once a recording runs past that, so both are accepted.
    const parts = String(s || '0:00').trim().split(':').map((p) => parseFloat(p) || 0);
    if (!parts.length || parts.some((p) => Number.isNaN(p))) return 0;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return Math.max(0, parts[0]);
  }
  function secToMMSS(s) {
    s = Math.max(0, Math.round(s || 0));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  function acSelectedSegments() {
    return state.autoClip.segments.filter((s) => s.selected);
  }
  function acTotalDuration() {
    return acSelectedSegments().reduce((sum, s) => sum + Math.max(0, s.end - s.start), 0);
  }

  function renderAutoClip() {
    const ac = state.autoClip;
    $('#acEmpty').hidden = !!ac.path;
    $('#acWorking').hidden = !ac.path;
    if (!ac.path) return;

    $('#acSourceName').textContent = ac.name;
    $('#acSourceDur').textContent = ac.duration ? `${secToMMSS(ac.duration)} long` : '';

    const working = ac.status === 'extracting' || ac.status === 'analyzing' || ac.status === 'rendering';
    $('#acStatus').hidden = !working;
    $('#acStatusText').textContent = ac.status === 'extracting' ? 'Extracting audio…'
      : ac.status === 'analyzing' ? 'Listening for the best moments — this can take a minute or two…'
      : ac.status === 'rendering' ? 'Rendering the clip…' : '';
    $('#acFindWrap').hidden = working || ac.segments.length > 0;
    $('#acFindBtn').disabled = working;

    $('#acResults').hidden = ac.segments.length === 0;
    if (ac.segments.length) acBuildList();
  }

  function acBuildList() {
    const list = $('#acList');
    list.innerHTML = '';
    state.autoClip.segments.forEach((seg, i) => {
      const row = el('div', 'ac-row' + (seg.selected ? ' on' : ''));
      row.dataset.id = seg.id;

      const check = el('label', 'ac-row-check');
      check.innerHTML = `<input type="checkbox"${seg.selected ? ' checked' : ''}>`;
      check.querySelector('input').addEventListener('change', (e) => {
        seg.selected = e.currentTarget.checked;
        row.classList.toggle('on', seg.selected);
        acUpdateFooter();
      });
      row.appendChild(check);

      const thumb = el('div', 'ac-thumb');
      thumb.textContent = '…';
      row.appendChild(thumb);
      if (seg.thumb) thumb.innerHTML = `<img src="${seg.thumb}" alt="">`;
      else acLoadThumb(seg, thumb);

      const main = el('div', 'ac-row-main');
      main.innerHTML =
        `<div class="ac-row-top"><span class="ac-score">${seg.score}</span><span class="ac-why">${escapeHtml(seg.why || '')}</span></div>` +
        `<div class="ac-transcript">${escapeHtml(seg.transcript || '')}</div>`;
      const nudgeRow = el('div', 'ac-nudge-row');
      nudgeRow.innerHTML =
        `<span class="ac-nudge" data-f="start"><button data-d="-1">−</button><span>${secToMMSS(seg.start)}</span><button data-d="1">+</button></span>` +
        `→` +
        `<span class="ac-nudge" data-f="end"><button data-d="-1">−</button><span>${secToMMSS(seg.end)}</span><button data-d="1">+</button></span>` +
        `<span>${Math.round(seg.end - seg.start)}s</span>`;
      nudgeRow.querySelectorAll('button').forEach((b) => {
        b.addEventListener('click', () => {
          const field = b.closest('.ac-nudge').dataset.f;
          const delta = +b.dataset.d;
          if (field === 'start') seg.start = Math.max(0, Math.min(seg.start + delta, seg.end - 1));
          else seg.end = Math.min(state.autoClip.duration || seg.end + delta, Math.max(seg.end + delta, seg.start + 1));
          acBuildList();
          acUpdateFooter();
        });
      });
      main.appendChild(nudgeRow);
      row.appendChild(main);

      const order = el('div', 'ac-row-order');
      const up = el('button'); up.textContent = '▲'; up.disabled = i === 0;
      const down = el('button'); down.textContent = '▼'; down.disabled = i === state.autoClip.segments.length - 1;
      up.addEventListener('click', () => {
        const arr = state.autoClip.segments;
        [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
        acBuildList();
      });
      down.addEventListener('click', () => {
        const arr = state.autoClip.segments;
        [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]];
        acBuildList();
      });
      order.appendChild(up); order.appendChild(down);
      row.appendChild(order);

      list.appendChild(row);
    });
    acUpdateFooter();
  }

  function acUpdateFooter() {
    const n = acSelectedSegments().length;
    const dur = acTotalDuration();
    $('#acTotal').textContent = n ? `${n} moment${n === 1 ? '' : 's'} selected · ~${secToMMSS(dur)} total` : 'Nothing selected yet';
    $('#acRenderBtn').disabled = n === 0 || state.autoClip.status === 'rendering';
  }

  // Frame thumbnails are fetched one at a time (not in parallel) — each one
  // spawns an ffmpeg process, and a results list with a dozen candidates
  // would otherwise hit the machine with a dozen simultaneous decodes.
  let _acThumbQueue = Promise.resolve();
  function acLoadThumb(seg, thumbEl) {
    _acThumbQueue = _acThumbQueue.then(async () => {
      if (seg.thumb) return; // already loaded by a previous render pass
      const r = await window.api.video.extractFrame(state.autoClip.path, seg.start + Math.min(1, (seg.end - seg.start) / 2));
      if (r.ok) {
        seg.thumb = r.dataUrl;
        const live = document.querySelector(`.ac-row[data-id="${seg.id}"] .ac-thumb`);
        if (live) live.innerHTML = `<img src="${seg.thumb}" alt="">`;
      }
    }).catch(() => {});
  }

  async function acPickVideo() {
    const r = await window.api.video.pick();
    if (!r.ok) { if (!r.canceled) toast(r.error || 'Could not open that video', 6000); return; }
    state.autoClip = {
      path: r.path, name: r.name, duration: r.duration,
      status: 'idle', segments: [],
    };
    render();
  }

  async function acFindMoments() {
    const ac = state.autoClip;
    const caps = await window.AI.caps();
    if (!caps.gemini) { toast(window.AI.explain({ kind: 'no-vision' }), 7000); return; }

    ac.status = 'extracting';
    render();
    const audio = await window.api.video.extractAudio(ac.path);
    if (!audio.ok) {
      ac.status = 'idle'; render();
      return toast(audio.error || 'Could not extract audio from that video', 6000);
    }

    ac.status = 'analyzing';
    render();
    let out;
    try {
      out = await window.AI.run('videoMoments', { mime: audio.mime, data: audio.data, durationSec: ac.duration });
    } catch (e) {
      ac.status = 'idle'; render();
      return toast(window.AI.explain(e), 7000);
    }

    const raw = (out && out.segments) || [];
    const parsed = raw.map((s, i) => ({
      id: 'seg' + i + '-' + Date.now(),
      start: mmssToSec(s.start), end: mmssToSec(s.end),
      transcript: String(s.transcript || ''), why: String(s.why || ''),
      score: Math.max(1, Math.min(10, Math.round(+s.score) || 5)),
      selected: false, thumb: '',
    })).filter((s) => s.end > s.start);

    // Default a reasonable short clip: take the highest-scored moments up to
    // ~60s combined (Opus Clip's own defaults land in roughly this range),
    // then lay the chosen ones out in the order they happened in the source.
    // Candidates routinely overlap — a broad "the whole story" span and a
    // tighter span inside it both score well — so picks that overlap an
    // already-selected one are skipped, or the default clip would replay
    // the same lines back to back.
    const byScore = [...parsed].sort((a, b) => b.score - a.score);
    let budget = 60;
    for (const s of byScore) {
      if (budget <= 0) break;
      const overlaps = parsed.some((o) => o.selected && o.start < s.end && s.start < o.end);
      if (overlaps) continue;
      s.selected = true;
      budget -= (s.end - s.start);
    }
    parsed.sort((a, b) => a.start - b.start);

    ac.segments = parsed;
    ac.status = 'ready';
    render();
    if (!parsed.length) toast('No clear moments found — try a different video', 6000);
  }

  async function acRenderClip() {
    const segs = acSelectedSegments().map((s) => ({ start: s.start, end: s.end }));
    if (!segs.length) return;
    state.autoClip.status = 'rendering';
    render();
    overlay(true, 'Rendering clip…');
    let r;
    try { r = await window.api.video.renderClip(state.autoClip.path, segs); }
    finally { overlay(false); state.autoClip.status = 'ready'; render(); }
    if (!r.ok) { if (!r.canceled) toast(r.error || 'Could not render the clip', 7000); return; }
    toast('Clip saved → ' + r.path, 7000, () => window.api.revealFile(r.path), 'Show in Finder');
  }

  /* ---------- review-feedback round-trip ---------- */
  function fbTotals(p) {
    const cards = (p.feedback || []).flatMap((f) => f.cards || []);
    return {
      reviews: (p.feedback || []).length,
      ok: cards.filter((c) => c.status === 'Approved').length,
      no: cards.filter((c) => c.status === 'Needs work').length,
    };
  }
  function feedbackSummaryNode(p) {
    if (!p.feedback || !p.feedback.length) return null;
    const t = fbTotals(p);
    const box = el('div', 'dp-fb');
    box.appendChild(el('div', 'dp-fb-head',
      `<b>${t.reviews} review${t.reviews === 1 ? '' : 's'}</b>` +
      `<span class="fb-ok">${t.ok} approved</span>` +
      `<span class="fb-no">${t.no} needs work</span>`));
    const punch = el('button', 'ai-inline-btn', `<span class="aii-ico" data-i="aiStars"></span>Turn into a punch list`);
    punch.querySelectorAll('[data-i]').forEach((e) => { e.innerHTML = ICONS[e.dataset.i] || ''; });
    punch.addEventListener('click', () => window.__aiPunchList(p));
    box.appendChild(punch);
    p.feedback.slice().reverse().forEach((f) => {
      const rev = el('div', 'dp-fb-rev');
      rev.appendChild(el('div', 'fb-rev-name',
        `${escapeHtml(f.reviewer || 'Reviewer')} · ${new Date(f.at).toLocaleDateString()}`));
      (f.cards || []).forEach((c) => {
        const pins = (c.pins || []).filter((pn) => pn.text);
        if (!c.status && !c.note && !pins.length) return;
        const line = el('div', 'fb-card');
        line.innerHTML =
          `<b>${escapeHtml(c.name)}</b>` +
          (c.status ? `<em class="${c.status === 'Approved' ? 'fb-ok' : 'fb-no'}">${c.status}</em>` : '') +
          (c.note ? `<span>${escapeHtml(c.note)}</span>` : '') +
          pins.map((pn) => `<span class="fb-pin">• ${escapeHtml(pn.text)}</span>`).join('');
        rev.appendChild(line);
      });
      box.appendChild(rev);
    });
    return box;
  }
  async function importFeedbackFor(postId, iso) {
    const p = postById(postId);
    if (!p) return;
    const r = await window.api.openText({ filters: [{ name: 'Feedback file', extensions: ['json'] }] });
    if (r.canceled) return;
    if (!r.ok) return toast('Could not read that file');
    let blob;
    try { blob = JSON.parse(r.text); } catch (e) { return toast('That is not a valid feedback file'); }
    if (blob._app !== 'sps-feedback' || !Array.isArray(blob.cards)) {
      return toast('That is not a Social Preview Studio feedback file');
    }
    p.feedback = p.feedback || [];
    const entry = {
      reviewer: String(blob.reviewer || 'Reviewer').slice(0, 60),
      at: blob.at || new Date().toISOString(),
      cards: blob.cards.map((c) => ({
        name: String(c.name || ''),
        status: (c.status === 'Approved' || c.status === 'Needs work') ? c.status : '',
        note: String(c.note || ''),
        pins: Array.isArray(c.pins)
          ? c.pins.map((pn) => ({ x: +pn.x || 0, y: +pn.y || 0, text: String(pn.text || '') }))
          : [],
      })),
    };
    p.feedback.push(entry);
    p.updatedAt = Date.now();
    persistPosts();
    const needs = entry.cards.filter((c) => c.status === 'Needs work').length;
    toast(
      needs
        ? `Feedback from ${entry.reviewer} — ${needs} placement${needs === 1 ? '' : 's'} need work`
        : `Feedback from ${entry.reviewer} imported`,
      4500,
      needs && (p.status === 'ready' || p.status === 'posted')
        ? () => { setPostStatus(p.id, 'draft'); renderCalendar(); openDay(iso, postsByDate()[iso] || []); }
        : null,
      'Set to Draft',
    );
    renderCalendar();
    openDay(iso, postsByDate()[iso] || []);
  }

  /* ---------- hosted review link (comments come back to the app) ---------- */
  function reviewLinkNode(p, iso) {
    if (!p.reviewUrl) return null;
    const box = el('div', 'dp-fb');
    const unseen = Math.max(0, (p.reviewComments || []).length - (p.reviewSeen || 0));
    box.appendChild(el('div', 'dp-fb-head',
      `<b>Review link</b>` + (unseen ? `<span class="fb-no">${unseen} new</span>` : '')));
    const linkRow = el('div', 'fb-card');
    linkRow.innerHTML = `<span>${escapeHtml(p.reviewUrl)}</span>`;
    box.appendChild(linkRow);
    const btnRow = el('div', 'dp-item-acts');
    const copyBtn = el('button', 'btn btn-sm', 'Copy link');
    copyBtn.addEventListener('click', () => navigator.clipboard.writeText(p.reviewUrl).then(() => toast('Copied')));
    const openBtn = el('button', 'btn btn-sm', 'Open ↗');
    openBtn.addEventListener('click', () => window.api.openUrl(p.reviewUrl));
    const checkBtn = el('button', 'btn btn-sm', 'Check for comments');
    checkBtn.addEventListener('click', () => checkReviewComments(p.id, iso));
    btnRow.appendChild(copyBtn); btnRow.appendChild(openBtn); btnRow.appendChild(checkBtn);
    box.appendChild(btnRow);
    if ((p.reviewComments || []).length) {
      const rev = el('div', 'dp-fb-rev');
      p.reviewComments.slice().reverse().forEach((c) => {
        const line = el('div', 'fb-card');
        line.innerHTML =
          `<b>${escapeHtml(c.author || 'Reviewer')}</b>` +
          (c.cardName && c.cardName !== 'General' ? ` <em>${escapeHtml(c.cardName)}</em>` : '') +
          (c.status ? ` <em class="${c.status === 'Approved' ? 'fb-ok' : 'fb-no'}">${escapeHtml(c.status)}</em>` : '') +
          `<span>${escapeHtml(c.text || '')}</span>`;
        rev.appendChild(line);
      });
      box.appendChild(rev);
    }
    return box;
  }

  async function checkReviewComments(postId, iso) {
    const p = postById(postId);
    if (!p || !p.reviewId) return;
    const r = await window.api.fetchComments(p.reviewId);
    if (!r || !r.ok) return toast('Could not check comments: ' + ((r && r.error) || 'unknown error'));
    const prevLen = (p.reviewComments || []).length;
    p.reviewComments = r.comments || [];
    p.reviewSeen = p.reviewComments.length;
    p.reviewNotified = p.reviewComments.length;
    persistPosts();
    renderCalendar();
    updateReviewBadge();
    if (state.view === 'reviews') renderReviews();
    if (iso) openDay(iso, postsByDate()[iso] || []);
    const added = p.reviewComments.length - prevLen;
    toast(added > 0 ? `${added} new comment${added === 1 ? '' : 's'} loaded` : 'No new comments yet');
  }

  // Unread count across every non-archived post with a review link — shown
  // as a badge on the "Reviews" sidebar item. "Unread" = comments not yet
  // seen in the day panel, the Reviews list, or via an explicit check.
  function updateReviewBadge() {
    const badge = $('#checkReviewsBadge');
    if (!badge) return;
    const n = state.posts.reduce((sum, p) => {
      if (!p.reviewId || p.reviewArchived) return sum;
      return sum + Math.max(0, (p.reviewComments || []).length - (p.reviewSeen || 0));
    }, 0);
    badge.hidden = !n;
    if (n) badge.textContent = n > 99 ? '99+' : String(n);
  }

  // Checks every open (non-archived) review link for new comments and toasts
  // once per new batch — this is the "notified in the app" part. Also runs
  // silently whenever the Reviews view is opened, so opening it is itself
  // the "check now" action.
  let _reviewPolling = false;
  async function pollReviewLinks() {
    if (_reviewPolling) return;
    _reviewPolling = true;
    try {
      const targets = state.posts.filter((p) => p.reviewId && !p.reviewArchived);
      for (const p of targets) {
        let r;
        try { r = await window.api.fetchComments(p.reviewId); } catch (e) { continue; }
        if (!r || !r.ok) continue;
        p.reviewComments = r.comments || [];
        const total = p.reviewComments.length;
        const notified = p.reviewNotified || 0;
        if (total > notified) {
          const added = total - notified;
          toast(`💬 ${added} new comment${added === 1 ? '' : 's'} on “${p.title}”`, 8000,
            () => openPost(p.id), 'View');
          p.reviewNotified = total;
        }
      }
      persistPosts();
      updateReviewBadge();
      if (state.view === 'reviews') renderReviews();
    } finally {
      _reviewPolling = false;
    }
  }

  function openDay(iso, posts) {
    const panel = $('#dayPanel');
    $('#dpDate').textContent = fmtDate(iso);
    const listEl = $('#dpList');
    listEl.innerHTML = '';
    if (!posts.length) listEl.appendChild(el('p', 'dp-empty', 'Nothing saved for this day yet.'));
    posts.forEach((p) => {
      const item = el('div', 'dp-item');
      const st = STATUS[p.status] || STATUS.draft;
      item.innerHTML =
        `<div class="dp-row">` +
        `<span class="dp-thumb"${p.thumb ? ` style="background-image:url(${p.thumb})"` : ''}></span>` +
        `<span class="dp-info"><b>${escapeHtml(p.title)}</b><small>${p.snapshot.slides.length} image${p.snapshot.slides.length === 1 ? '' : 's'}</small></span>` +
        `</div>`;
      item.querySelector('.dp-row').addEventListener('click', () => openPost(p.id));

      const ctl = el('div', 'dp-ctl');
      const seg = el('div', 'dp-seg');
      Object.entries(STATUS).forEach(([k, v]) => {
        const b = el('button', k === (p.status || 'draft') ? 'on' : null, v[0]);
        b.style.setProperty('--sc', v[1]);
        b.addEventListener('click', () => { setPostStatus(p.id, k); openDay(iso, posts); renderCalendar(); });
        seg.appendChild(b);
      });
      ctl.appendChild(seg);
      const url = el('input', 'dp-url');
      url.type = 'text'; url.placeholder = 'Paste the live post URL…'; url.value = p.liveUrl || '';
      url.addEventListener('input', () => { p.liveUrl = url.value.trim(); p.updatedAt = Date.now(); persistPosts(); });
      ctl.appendChild(url);
      const rvLink = reviewLinkNode(p, iso);
      if (rvLink) ctl.appendChild(rvLink);
      const fbSummary = feedbackSummaryNode(p);
      if (fbSummary) ctl.appendChild(fbSummary);

      const imp = el('button', 'btn btn-sm dp-import', 'Import review feedback…');
      imp.addEventListener('click', () => importFeedbackFor(p.id, iso).catch((e) => toast('Error: ' + e.message)));
      ctl.appendChild(imp);

      const acts = el('div', 'dp-item-acts');
      const dup = el('button', 'btn btn-sm', 'Duplicate');
      dup.addEventListener('click', () => { duplicatePost(p.id); openDay(iso, (postsByDate()[iso] || [])); });
      const del = el('button', 'btn btn-sm dp-danger', 'Delete');
      del.addEventListener('click', () => { deletePost(p.id); openDay(iso, (postsByDate()[iso] || [])); renderCalendar(); });
      acts.appendChild(dup); acts.appendChild(del);
      ctl.appendChild(acts);
      item.appendChild(ctl);
      listEl.appendChild(item);
    });
    $('#dpNew').onclick = () => newPost(iso);
    panel.hidden = false;
  }

  function calStep(dir) {
    if (state.calView === 'week') state.calMonth.setDate(state.calMonth.getDate() + dir * 7);
    else state.calMonth.setMonth(state.calMonth.getMonth() + dir);
    renderCalendar();
  }
  function initCalendar() {
    state.calMonth = new Date();
    $('#calPrev').addEventListener('click', () => calStep(-1));
    $('#calNext').addEventListener('click', () => calStep(1));
    $('#calToday').addEventListener('click', () => { state.calMonth = new Date(); renderCalendar(); });
    $('#calViewSwitch').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-cv]');
      if (b) { state.calView = b.dataset.cv; renderCalendar(); }
    });
    $('#calSearch').addEventListener('input', (e) => { state.calSearch = e.target.value; renderCalList(); });
    $('#dpClose').addEventListener('click', () => { $('#dayPanel').hidden = true; });

    $('#btnSave').addEventListener('click', openSaveModal);
    $('#saveCancel').addEventListener('click', () => { $('#modalWrap').hidden = true; });
    $('#saveConfirm').addEventListener('click', () => doSave(false));
    $('#saveAsNew').addEventListener('click', () => doSave(true));
    $('#modalWrap').addEventListener('click', (e) => { if (e.target.id === 'modalWrap') $('#modalWrap').hidden = true; });

    const closePack = () => { $('#packWrap').hidden = true; };
    $('#packCancel').addEventListener('click', closePack);
    $('#packWrap').addEventListener('click', (e) => { if (e.target.id === 'packWrap') closePack(); });
    $('#packConfirm').addEventListener('click', () => {
      const name = $('#packTitle').value;
      closePack();
      runPackExport(name).catch((err) => {
        overlay(false);
        toast('Ready pack failed: ' + (err && err.message || err));
      });
    });
    $('#packTitle').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); $('#packConfirm').click(); }
      if (e.key === 'Escape') closePack();
    });

    $('#sideNav').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-nav]');
      if (!b) return;
      setView(b.dataset.nav === 'calendar' ? 'calendar' : b.dataset.nav === 'board' ? 'board'
        : b.dataset.nav === 'reviews' ? 'reviews' : b.dataset.nav === 'autoclip' ? 'autoclip' : 'focus');
      if (b.dataset.nav === 'reviews') pollReviewLinks();
    });

    $('#sideAccount').addEventListener('click', () => {
      openFlyout('brand');
      $('#acctName').focus();
    });

    $('#heroChoose').addEventListener('click', () => $('#fileInput').click());

    $('#acPickBtn').addEventListener('click', acPickVideo);
    $('#acChangeBtn').addEventListener('click', acPickVideo);
    $('#acFindBtn').addEventListener('click', () => acFindMoments().catch((e) => toast(String((e && e.message) || e), 6000)));
    $('#acRenderBtn').addEventListener('click', () => acRenderClip().catch((e) => toast(String((e && e.message) || e), 6000)));
  }

  /* ---------- boot ---------- */
  window.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-i]').forEach((e) => { e.innerHTML = ICONS[e.dataset.i] || ''; });
    loadSettings();
    loadPosts();
    applyAppTheme();
    $('#themeToggle').addEventListener('click', toggleAppTheme);
    initToggles();
    applySettingsToUI();
    initDropzone();
    initFocus();
    initInputs();
    initCalendar();
    initSidebarResize();
    initToolPanels();
    initCompare();
    updateReviewBadge();
    setTimeout(pollReviewLinks, 4000);
    setInterval(pollReviewLinks, 60000);

    const guard = (fn) => (...a) => fn(...a).catch((err) => {
      document.body.classList.remove('exporting');
      overlay(false);
      toast('Error: ' + err.message);
    });
    $('#btnPublishReview').addEventListener('click', guard(publishForReview));
    $('#btnStartOver').addEventListener('click', startOver);

    $('#tbTitle').addEventListener('click', startTitleEdit);
    $('#tbTitleInput').addEventListener('blur', () => {
      if (suppressTitleCommit) { suppressTitleCommit = false; return; }
      endTitleEdit(true);
    });
    $('#tbTitleInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); $('#tbTitleInput').blur(); }
      else if (e.key === 'Escape') { suppressTitleCommit = true; endTitleEdit(false); $('#tbTitleInput').blur(); }
    });

    // view switch
    $('#viewSwitch').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-view]');
      if (b) setView(b.dataset.view);
    });

    // light / dark preview chrome
    $('#pvTheme').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-pv]');
      if (!b) return;
      state.previewTheme = b.dataset.pv;
      [...$('#pvTheme').children].forEach((x) => x.classList.toggle('on', x === b));
      render();
    });

    // mobile / desktop chrome
    $('#deviceSwitch').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-dv]');
      if (!b) return;
      state.device = b.dataset.dv;
      [...$('#deviceSwitch').children].forEach((x) => x.classList.toggle('on', x === b));
      render();
    });

    // device mock (phone / computer) on-off
    $('#frameToggle').addEventListener('click', (e) => {
      state.deviceFrame = !state.deviceFrame;
      e.currentTarget.setAttribute('aria-pressed', String(state.deviceFrame));
      render();
    });

    // in-feed context (focus mode)
    $('#feedContextToggle').addEventListener('click', (e) => {
      state.feedContext = !state.feedContext;
      e.currentTarget.setAttribute('aria-pressed', String(state.feedContext));
      render();
    });

    // export menu
    const exportMenu = $('#exportMenu');
    $('#btnExport').addEventListener('click', (e) => {
      e.stopPropagation();
      const r = e.currentTarget.getBoundingClientRect();
      exportMenu.style.top = r.bottom + 8 + 'px';
      exportMenu.style.right = window.innerWidth - r.right + 'px';
      exportMenu.hidden = !exportMenu.hidden;
      $('#placementsPop').hidden = true;
    });
    exportMenu.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-exp]');
      if (!b) return;
      exportMenu.hidden = true;
      const runners = { ready: exportReadyPack, pngs: exportPngs, 'board-png': exportBoardPng, 'board-pdf': exportBoardPdf, scheduler: exportScheduler };
      guard(runners[b.dataset.exp])();
    });

    // placements popover
    const pop = $('#placementsPop');
    $('#btnPlacements').addEventListener('click', (e) => {
      e.stopPropagation();
      const btn = e.currentTarget.getBoundingClientRect();
      pop.style.top = btn.bottom + 8 + 'px';
      pop.style.right = window.innerWidth - btn.right + 'px';
      pop.hidden = !pop.hidden;
      exportMenu.hidden = true;
    });

    // dismiss popovers on outside click / escape
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#placementsPop,#btnPlacements')) pop.hidden = true;
      if (!e.target.closest('#exportMenu,#btnExport')) exportMenu.hidden = true;
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { pop.hidden = true; exportMenu.hidden = true; }
    });

    // focus prev / next placement
    $('#focusPrev').addEventListener('click', () => cycleFocus(-1));
    $('#focusNext').addEventListener('click', () => cycleFocus(1));

    // click "… more" / "show less" in any caption
    $('.stage').addEventListener('click', (e) => {
      const m = e.target.closest('.more');
      if (!m) return;
      const card = e.target.closest('.card');
      if (!card) return;
      const id = card.dataset.id;
      if (state.expanded.has(id)) state.expanded.delete(id);
      else state.expanded.add(id);
      render();
    });

    // paste image(s) from the clipboard
    window.addEventListener('paste', (e) => {
      const files = [];
      for (const it of e.clipboardData.items || []) {
        if (it.type && it.type.startsWith('image/')) {
          const f = it.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length) { e.preventDefault(); addFiles(files); toast(`Pasted ${files.length} image${files.length === 1 ? '' : 's'}`); }
    });

    // keyboard: arrows switch placement (focus) or flip slides (board)
    window.addEventListener('keydown', (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.metaKey || e.ctrlKey) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const step = e.key === 'ArrowLeft' ? -1 : 1;
      if (state.view === 'focus' && !e.shiftKey) { cycleFocus(step); return; }
      if (state.slides.length > 1) {
        state.active = (activeIndex() + step + state.slides.length) % state.slides.length;
        render();
      }
    });

    initAI();
    render();
  });

  function applySidebarW() {
    document.documentElement.style.setProperty('--side-w', state.sidebarW + 'px');
  }

  function initSidebarResize() {
    applySidebarW();
    const handle = $('#sideResize');
    if (!handle) return;
    let dragging = false;
    const onMove = (e) => {
      if (!dragging) return;
      const w = Math.min(460, Math.max(260, e.clientX));
      state.sidebarW = w;
      applySidebarW();
    };
    const stop = () => {
      if (!dragging) return;
      dragging = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', stop);
      saveSettings();
    };
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      dragging = true;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', stop);
    });
    handle.addEventListener('dblclick', () => {
      state.sidebarW = 300;
      applySidebarW();
      saveSettings();
    });
  }

  function closePop(id) { const e = document.getElementById(id); if (e) e.hidden = true; }

  /* =====================================================================
     AI assist — connection UI, result sheet, caption tools, alt text,
     hashtags, sermon pack, feedback punch list, caption-health checks
     ===================================================================== */

  function paintIcons(root) {
    (root || document).querySelectorAll('[data-i]').forEach((e) => {
      if (!e.dataset.iPainted) { e.innerHTML = ICONS[e.dataset.i] || ''; e.dataset.iPainted = '1'; }
    });
  }
  function aiInline(dataUrl) {
    const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl || '');
    return m ? { mimeType: m[1], data: m[2] } : null;
  }
  function aiCurrentCaption() {
    return state.captionTarget === 'master'
      ? state.caption
      : (state.captionOverride[state.captionTarget] || state.caption || '');
  }
  function aiSetCaption(text) {
    if (state.captionTarget === 'master') state.caption = text;
    else state.captionOverride[state.captionTarget] = text;
    const ta = $('#caption'); if (ta) ta.value = text;
    render();
  }

  /* ---------- result sheet ---------- */
  const AiSheet = {
    _regen: null,
    open(title) {
      $('#aiSheetTitle').textContent = title;
      $('#aiSheet').hidden = false;
      document.body.classList.add('ai-sheet-open');
      this.setRegen(null);
    },
    close() {
      $('#aiSheet').hidden = true;
      document.body.classList.remove('ai-sheet-open');
    },
    loading(msg) {
      $('#aiSheetBody').innerHTML =
        `<div class="ai-loading"><span class="ai-spark" data-i="aiStars"></span>` +
        `<div class="ai-shimmer"></div><div class="ai-shimmer"></div><div class="ai-shimmer sm"></div>` +
        `<p>${escapeHtml(msg || 'Thinking…')}</p></div>`;
      paintIcons($('#aiSheetBody'));
    },
    error(e) {
      const msg = window.AI.explain(e);
      const wantPanel = e && (e.kind === 'no-backend' || e.kind === 'no-vision' || e.kind === 'no-ondevice');
      $('#aiSheetBody').innerHTML =
        `<div class="ai-error"><p>${escapeHtml(msg)}</p>` +
        (wantPanel ? `<button class="btn btn-sm btn-primary" id="aiErrConnect">Open AI panel</button>` : '') +
        `</div>`;
      const c = $('#aiErrConnect');
      if (c) c.addEventListener('click', () => { AiSheet.close(); openFlyout('ai'); });
    },
    setRegen(fn) {
      this._regen = fn || null;
      $('#aiSheetFoot').hidden = !fn;
    },
  };
  const sheetBody = () => $('#aiSheetBody');

  async function aiWith(title, loadingMsg, fn) {
    AiSheet.open(title);
    AiSheet.loading(loadingMsg);
    AiSheet.setRegen(() => aiWith(title, loadingMsg, fn));
    try { await fn(); }
    catch (e) { console.warn('[ai]', e); AiSheet.error(e); }
  }

  function aiCard(label, text, opts) {
    opts = opts || {};
    const card = el('div', 'ai-card');
    card.innerHTML =
      `<div class="ai-card-label">${escapeHtml(label)}</div>` +
      `<div class="ai-card-text"></div>` +
      `<div class="ai-card-acts">` +
      `<button class="btn btn-sm btn-primary" data-a="use"><span class="b-ico" data-i="check"></span>${escapeHtml(opts.useLabel || 'Use')}</button>` +
      `<button class="btn btn-sm" data-a="copy"><span class="b-ico" data-i="copy"></span>Copy</button>` +
      `</div>`;
    card.querySelector('.ai-card-text').textContent = text;
    paintIcons(card);
    card.querySelector('[data-a="use"]').addEventListener('click', () => {
      (opts.onUse || aiSetCaption)(text);
      toast(opts.usedToast || 'Applied to caption');
      if (!opts.keepOpen) AiSheet.close();
    });
    card.querySelector('[data-a="copy"]').addEventListener('click', () => {
      navigator.clipboard.writeText(text).then(() => toast('Copied'));
    });
    return card;
  }

  /* ---------- caption tools ---------- */
  function needCaption() {
    const t = aiCurrentCaption().trim();
    if (!t) { toast('Write a caption first'); return null; }
    return t;
  }
  function foldLimit() {
    const folds = enabledList().map((p) => capRule(p).truncateAt).filter(Boolean);
    return folds.length ? Math.min(...folds) : null;
  }

  function aiRewrite(tone, label) {
    const text = needCaption(); if (!text) return;
    aiWith('Rewrite — ' + label, 'Rewriting…', async () => {
      const out = await window.AI.run('rewrite', { text, tone });
      sheetBody().innerHTML = '';
      sheetBody().appendChild(aiCard(label, out));
    });
  }
  function aiVariants() {
    const text = needCaption(); if (!text) return;
    aiWith('3 variants', 'Writing three different angles…', async () => {
      const out = await window.AI.run('variants', { text, n: 3 });
      sheetBody().innerHTML = '';
      (out.variants || []).forEach((v) => sheetBody().appendChild(aiCard(v.angle || 'Variant', v.text)));
      if (!(out.variants || []).length) throw new window.AI.AIError('bad-json');
    });
  }
  function aiHookFix() {
    const text = needCaption(); if (!text) return;
    aiWith('Fix the hook', 'Rewriting the first line to beat the fold…', async () => {
      const out = await window.AI.run('hook', { text, limit: foldLimit() });
      sheetBody().innerHTML = '';
      sheetBody().appendChild(aiCard('Hook before the “… more” fold', out));
    });
  }
  function aiToneCheck() {
    const text = needCaption(); if (!text) return;
    aiWith('Tone check', 'Reading it as a first-time visitor…', async () => {
      const out = await window.AI.run('toneCheck', { text });
      const b = sheetBody(); b.innerHTML = '';
      const c = el('div', 'ai-card');
      c.innerHTML = `<div class="ai-card-label">Reads as</div>` +
        `<div class="ai-tone-reads">${escapeHtml(out.reads_as || '—')}</div>` +
        ((out.flags || []).length
          ? `<ul class="ai-flags">${out.flags.map((f) => `<li>${escapeHtml(f)}</li>`).join('')}</ul>`
          : `<p class="ai-ok">Nothing jumped out — this reads well.</p>`);
      b.appendChild(c);
      if (out.suggestion && out.suggestion.trim()) b.appendChild(aiCard('Gentler version', out.suggestion));
    });
  }
  function aiRepurpose() {
    const text = needCaption(); if (!text) return;
    const plats = enabledList();
    if (!plats.length) return toast('Turn on some placements first');
    aiWith('Per-platform captions', 'Adapting for each placement…', async () => {
      const out = await window.AI.run('repurpose', { text, platforms: plats });
      const b = sheetBody(); b.innerHTML = '';
      let any = false;
      plats.forEach((p) => {
        const t = out.captions && out.captions[p.id];
        if (!t) return;
        any = true;
        b.appendChild(aiCard(platformName(p), t, {
          keepOpen: true,
          usedToast: platformName(p) + ' caption set',
          onUse: (txt) => { state.captionOverride[p.id] = txt; render(); },
        }));
      });
      if (!any) throw new window.AI.AIError('bad-json');
      const all = el('button', 'btn btn-sm btn-primary ai-apply-all');
      all.textContent = 'Apply all as per-placement captions';
      all.addEventListener('click', () => {
        plats.forEach((p) => {
          if (out.captions && out.captions[p.id]) state.captionOverride[p.id] = out.captions[p.id];
        });
        render(); toast('Applied to every placement'); AiSheet.close();
      });
      b.appendChild(all);
    });
  }
  function aiTranslate(lang) {
    const text = needCaption(); if (!text) return;
    aiWith('Translate — ' + lang, 'Translating…', async () => {
      const out = await window.AI.run('translate', { text, lang });
      const b = sheetBody(); b.innerHTML = '';
      b.appendChild(aiCard(lang, out, { usedToast: 'Translation set as caption' }));
      const chk = el('div', 'ai-backcheck');
      chk.textContent = 'Checking the meaning held…';
      b.appendChild(chk);
      try {
        const back = await window.AI.run('backTranslate', { text: out });
        chk.innerHTML = `<b>Translated back to English:</b> ${escapeHtml(back)}`;
      } catch (e) { chk.remove(); }
    });
  }

  /* ---------- alt text ---------- */
  function aiAltText(all) {
    if (!state.slides.length) return toast('Add an image first');
    const idxs = all ? state.slides.map((_, i) => i) : [Math.max(0, activeIndex())];
    aiWith(all ? 'Alt text — all slides' : 'Alt text', 'Looking at the image…', async () => {
      const b = sheetBody(); b.innerHTML = '';
      for (const i of idxs) {
        const s = state.slides[i];
        const inl = aiInline(s.type === 'video' ? (s.poster || s.src) : s.src);
        if (!inl) continue;
        const out = await window.AI.run('altText', { mime: inl.mimeType, data: inl.data, context: state.caption.trim().slice(0, 400) });
        b.appendChild(aiCard(state.slides.length > 1 ? `Slide ${i + 1}` : 'Alt text', out, {
          keepOpen: all,
          usedToast: 'Alt text set',
          onUse: (txt) => {
            state.slides[i].alt = txt;
            if (activeIndex() === i) { const f = $('#altText'); if (f) f.value = txt; }
            renderStrip(); render();
          },
        }));
      }
    });
  }

  /* ---------- hashtags ---------- */
  function aiHashtags() {
    const text = (state.caption || '').trim() || aiCurrentCaption().trim();
    if (!text) return toast('Write a caption first');
    aiWith('Suggested hashtags', 'Thinking of hashtags…', async () => {
      const out = await window.AI.run('hashtags', { text, brand: state.handle });
      const b = sheetBody(); b.innerHTML = '';
      const groups = [['branded', 'Branded'], ['topical', 'Topical'], ['local', 'Local (edit these)']];
      const chosen = new Set((state.hashtags.match(/#[^\s#]+/g) || []));
      const chipWrap = el('div', 'ai-tag-groups');
      groups.forEach(([k, lbl]) => {
        const arr = (out[k] || []).filter(Boolean);
        if (!arr.length) return;
        const g = el('div', 'ai-tag-group');
        g.innerHTML = `<div class="ai-card-label">${lbl}</div>`;
        const row = el('div', 'ai-tags');
        arr.forEach((tag) => {
          const t = tag.startsWith('#') ? tag : '#' + tag.replace(/\s+/g, '');
          const c = el('button', 'ai-tag' + (chosen.has(t) ? ' on' : ''));
          c.textContent = t;
          c.addEventListener('click', () => { c.classList.toggle('on'); });
          row.appendChild(c);
        });
        g.appendChild(row); chipWrap.appendChild(g);
      });
      b.appendChild(chipWrap);
      const apply = el('button', 'btn btn-sm btn-primary ai-apply-all');
      apply.textContent = 'Add selected to hashtags';
      apply.addEventListener('click', () => {
        const picks = [...b.querySelectorAll('.ai-tag.on')].map((x) => x.textContent);
        const cur = (state.hashtags.match(/#[^\s#]+/g) || []);
        const merged = [...new Set([...cur, ...picks])];
        state.hashtags = merged.join(' ');
        $('#hashtags').value = state.hashtags;
        render(); renderHashSetPicker(); toast('Hashtags updated'); AiSheet.close();
      });
      b.appendChild(apply);
    });
  }

  /* ---------- verse suggestions (from Caption Health) ---------- */
  function aiVerseSuggest() {
    const text = needCaption(); if (!text) return;
    aiWith('Scripture that fits', 'Finding passages…', async () => {
      const out = await window.AI.run('verseSuggest', { text });
      const b = sheetBody(); b.innerHTML = '';
      (out.passages || []).forEach((p) => {
        const c = el('div', 'ai-card');
        c.innerHTML = `<div class="ai-verse-ref">${escapeHtml(p.ref || '')}</div>` +
          `<div class="ai-verse-why">${escapeHtml(p.why || '')}</div>` +
          `<div class="ai-card-acts"><button class="btn btn-sm" data-a="copy"><span class="b-ico" data-i="copy"></span>Copy reference</button></div>`;
        paintIcons(c);
        c.querySelector('[data-a="copy"]').addEventListener('click', () =>
          navigator.clipboard.writeText(p.ref || '').then(() => toast('Copied')));
        b.appendChild(c);
      });
      if (!(out.passages || []).length) throw new window.AI.AIError('bad-json');
    });
  }

  /* ---------- feedback → punch list ---------- */
  function aiPunchList(p) {
    const notes = (p.feedback || []).flatMap((f) =>
      (f.cards || []).flatMap((c) => [
        c.status ? `${c.name}: ${c.status}` : '',
        c.note ? `${c.name}: ${c.note}` : '',
        ...(c.pins || []).filter((pn) => pn.text).map((pn) => `${c.name} pin: ${pn.text}`),
      ])).filter(Boolean).join('\n');
    if (!notes.trim()) return toast('No written feedback to summarise');
    aiWith('Feedback → punch list', 'Turning notes into to-dos…', async () => {
      const out = await window.AI.run('feedbackPunchList', { notes });
      const b = sheetBody(); b.innerHTML = '';
      const mk = (title, items, cls) => {
        if (!items || !items.length) return;
        const box = el('div', 'ai-card');
        box.innerHTML = `<div class="ai-card-label ${cls || ''}">${title}</div>`;
        const ul = el('ul', 'ai-punch');
        items.forEach((it) => {
          const li = el('li');
          li.innerHTML = `<label><input type="checkbox"> <span>${escapeHtml(it)}</span></label>`;
          ul.appendChild(li);
        });
        box.appendChild(ul); b.appendChild(box);
      };
      mk('Must fix', out.blockers, 'is-bad');
      mk('Changes', out.items);
      const copy = el('button', 'btn btn-sm ai-apply-all');
      copy.textContent = 'Copy list';
      copy.addEventListener('click', () => {
        const all = [...(out.blockers || []).map((x) => '! ' + x), ...(out.items || [])].map((x) => '• ' + x).join('\n');
        navigator.clipboard.writeText(all).then(() => toast('Copied'));
      });
      b.appendChild(copy);
    });
  }
  window.__aiPunchList = aiPunchList; // used by feedbackSummaryNode

  /* ---------- sermon → post pack ---------- */
  function openSermon() { $('#sermonWrap').hidden = false; $('#sermonSrc').focus(); }
  function closeSermon() { $('#sermonWrap').hidden = true; }
  function runSermon() {
    const src = $('#sermonSrc').value.trim();
    if (src.length < 60) return toast('Paste a bit more — notes or a transcript');
    const count = +$('#sermonCount').value || 5;
    closeSermon();
    aiWith('Sermon → post pack', 'Reading the sermon and drafting a week…', async () => {
      const out = await window.AI.run('sermonPack', { source: src, count, brand: state.name });
      const b = sheetBody(); b.innerHTML = '';

      if (out.series_title) {
        const h = el('div', 'ai-card');
        h.innerHTML = `<div class="ai-card-label">Series</div><div class="ai-series">${escapeHtml(out.series_title)}</div>`;
        b.appendChild(h);
      }
      if ((out.key_scriptures || []).length) {
        const s = el('div', 'ai-card');
        s.innerHTML = `<div class="ai-card-label">Key scriptures</div>` +
          `<div class="ai-refs">${out.key_scriptures.map((r) => `<span>${escapeHtml(r)}</span>`).join('')}</div>`;
        b.appendChild(s);
      }
      (out.pull_quotes || []).forEach((q, i) => {
        b.appendChild(aiCard('Pull-quote ' + (i + 1), q, {
          keepOpen: true, useLabel: 'Use as caption', usedToast: 'Loaded into caption',
        }));
      });
      (out.posts || []).forEach((post, i) => {
        const c = el('div', 'ai-card ai-post');
        c.innerHTML =
          `<div class="ai-card-label">${escapeHtml(post.day || 'Post ' + (i + 1))} · ${escapeHtml(post.platform || '')}</div>` +
          `<div class="ai-card-text"></div>` +
          (post.first_comment ? `<div class="ai-fc"><b>First comment:</b> ${escapeHtml(post.first_comment)}</div>` : '') +
          `<div class="ai-card-acts">` +
          `<button class="btn btn-sm btn-primary" data-a="use"><span class="b-ico" data-i="check"></span>Use as caption</button>` +
          `<button class="btn btn-sm" data-a="copy"><span class="b-ico" data-i="copy"></span>Copy</button>` +
          `</div>`;
        c.querySelector('.ai-card-text').textContent = post.caption || '';
        paintIcons(c);
        c.querySelector('[data-a="use"]').addEventListener('click', () => {
          state.captionTarget = 'master';
          state.caption = post.caption || '';
          if (post.first_comment) state.firstComment = post.first_comment;
          openFlyout('caption');
          render();
          toast('Loaded — add an image and save it');
        });
        c.querySelector('[data-a="copy"]').addEventListener('click', () =>
          navigator.clipboard.writeText(post.caption || '').then(() => toast('Copied')));
        b.appendChild(c);
      });
    });
  }

  /* ---------- caption health (offline heuristics) ---------- */
  function chip(label, val, status, note) {
    const s = status || 'ok';
    return `<span class="hc-chip hc-${s}" ${note ? `title="${escapeHtml(note)}"` : ''}>` +
      `<b>${escapeHtml(label)}</b>${val != null ? `<span>${escapeHtml(String(val))}</span>` : ''}</span>`;
  }
  function renderCapHealth() {
    const det = $('#capHealth');
    const body = $('#capHealthBody');
    const score = $('#capHealthScore');
    if (!det || !body) return;
    const text = editedCaption().trim();
    if (!text) {
      det.hidden = false;
      score.textContent = '';
      body.innerHTML = `<p class="hint">Start typing — checks for reading level, hooks, scripture references and tone appear here. No AI key needed.</p>`;
      return;
    }
    det.hidden = false;
    const H = window.AI.heuristics;
    const read = H.readability(text);
    const emoji = H.emojiNoise(text);
    const shout = H.shoutiness(text);
    const cta = H.cta(text);
    const plain = H.plainLanguage(text);
    const scr = H.scripture(text);
    const folds = enabledList().map((p) => ({ platform: platformName(p), at: capRule(p).truncateAt })).filter((f) => f.at);
    const hook = H.hookFold(text, folds);

    const warnCount = [read.status, emoji.status, shout.status, cta.status, hook.status, scr.status]
      .filter((s) => s === 'warn').length;
    score.textContent = warnCount ? `${warnCount} to look at` : 'looks good';
    score.className = 'ai-health-score ' + (warnCount ? 'is-warn' : 'is-ok');

    let html = '<div class="hc-chips">';
    html += chip('Reading level', 'grade ' + read.grade, read.status, `Flesch ease ${read.ease} · avg ${read.avgSentence} words/sentence`);
    html += chip('Hook', hook.rows.some((r) => r.ctaHidden) ? 'CTA hidden' : (hook.firstLineLen > 125 ? 'long first line' : 'clear'), hook.status,
      hook.rows.some((r) => r.ctaHidden) ? 'Your call-to-action falls after the "… more" fold on ' + hook.rows.filter((r) => r.ctaHidden).map((r) => r.platform).join(', ') : '');
    html += chip('Next step', cta.has ? 'present' : 'missing', cta.status, cta.note);
    html += chip('Emoji', emoji.count, emoji.status, emoji.note);
    if (shout.status === 'warn') html += chip('Tone', shout.note, 'warn');
    html += chip('Scripture', scr.status === 'idle' ? 'none' : (scr.bad.length ? scr.bad.length + ' to check' : scr.refs.length + ' ok'),
      scr.status === 'idle' ? 'ok' : scr.status);
    html += '</div>';

    if (scr.bad.length) {
      html += '<div class="hc-detail">';
      scr.bad.forEach((r) => {
        const why = r.reason === 'bad-chapter' ? escapeHtml(r.detail)
          : r.reason === 'spelling' ? `${escapeHtml(r.detail)}`
            : r.reason === 'high-verse' ? escapeHtml(r.detail)
              : r.suggest ? `did you mean <b>${escapeHtml(r.suggest)}</b>?`
                : 'unrecognised book';
        html += `<div class="hc-line hc-warn">“${escapeHtml(r.raw)}” — ${why}</div>`;
      });
      html += '</div>';
    }
    const longs = H.longSentences(text, 26);
    if (longs.length) {
      html += `<div class="hc-line hc-note">Long sentence (${longs[0].n} words): “${escapeHtml(longs[0].s.slice(0, 90))}${longs[0].s.length > 90 ? '…' : ''}”</div>`;
    }
    if (plain.hits.length) {
      html += `<div class="hc-line hc-note">Insider terms a newcomer may not know: ${plain.hits.map((h) => `<b>${escapeHtml(h)}</b>`).join(', ')}` +
        ` <button class="hc-fix" data-fix="plain">Rewrite plainer</button></div>`;
    }

    html += '<div class="hc-actions">';
    html += '<button class="hc-fix" data-fix="verse">Suggest a verse</button>';
    if (hook.status === 'warn') html += '<button class="hc-fix" data-fix="hook">Fix the hook</button>';
    html += '</div>';

    body.innerHTML = html;
    body.querySelectorAll('[data-fix]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const f = btn.dataset.fix;
        if (f === 'verse') aiVerseSuggest();
        else if (f === 'hook') aiHookFix();
        else if (f === 'plain') {
          const t = needCaption(); if (!t) return;
          aiWith('Rewrite plainer', 'Making it newcomer-friendly…', async () => {
            const out = await window.AI.run('plainLanguageRewrite', { text: t, terms: plain.hits });
            sheetBody().innerHTML = '';
            sheetBody().appendChild(aiCard('Plain-language version', out));
          });
        }
      });
    });
  }

  /* ---------- connection panel ---------- */
  async function refreshAiStatusUI() {
    await window.AI.refreshKeyStatus();
    const caps = await window.AI.caps();
    const dot = $('#aiDot'), title = $('#aiConnTitle'), sub = $('#aiConnSub');
    const sub2 = $('#aiToolSub'), form = $('#aiKeyForm'), okRow = $('#aiKeyOk');

    if (caps.gemini) {
      dot.className = 'ai-dot on';
      title.textContent = 'AI connected';
      sub.textContent = 'Writing & image tools are on. Requests go straight from this app to Google’s free tier.';
    } else {
      dot.className = 'ai-dot';
      title.textContent = 'Turn on the writing tools — free';
      sub.textContent = 'Runs through Google’s free Gemini tier. No credit card, about a minute, and one key covers the whole team.';
    }
    if (form) form.hidden = caps.gemini;
    if (okRow) okRow.hidden = !caps.gemini;
    if (sub2) sub2.textContent = caps.gemini ? 'Ready' : 'Add a free key';
  }

  function initAI() {
    paintIcons(document);
    $('#aiSheetClose').addEventListener('click', () => AiSheet.close());
    $('#aiSheetRegen').addEventListener('click', () => { if (AiSheet._regen) AiSheet._regen(); });

    // Gemini key
    $('#aiGetKey').addEventListener('click', () => {
      window.api.openLink('gemini-key');
      $('#aiKeyInput').focus();
    });
    $('#aiKeyClearBtn').addEventListener('click', async () => {
      await window.api.ai.keyClear();
      toast('Key removed');
      refreshAiStatusUI();
    });
    $('#aiKeySave').addEventListener('click', async () => {
      const key = $('#aiKeyInput').value.trim();
      const msg = $('#aiKeyMsg');
      if (!key) { msg.textContent = 'Paste your key first.'; return; }
      msg.textContent = 'Testing…';
      const test = await window.api.ai.keyTest(key);
      if (!test.ok) { msg.textContent = test.error || 'That key was rejected.'; return; }
      await window.api.ai.keySet(key);
      $('#aiKeyInput').value = '';
      msg.innerHTML = 'Connected. Stored encrypted on this Mac only.';
      toast('Gemini key connected');
      refreshAiStatusUI();
    });
    $('#aiKeyInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#aiKeySave').click(); });

    // caption AI bar
    const bar = $('#capAiBar');
    if (bar) {
      bar.querySelectorAll('.ai-bar-menu').forEach((m) => {
        const btn = m.querySelector('.ai-chip');
        const pop = m.querySelector('.ai-pop');
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          document.querySelectorAll('.ai-pop').forEach((p) => { if (p !== pop) p.hidden = true; });
          pop.hidden = !pop.hidden;
        });
        pop.addEventListener('click', (e) => {
          const b = e.target.closest('button'); if (!b) return;
          pop.hidden = true;
          if (b.dataset.tone) aiRewrite(b.dataset.tone, b.textContent.trim());
          if (b.dataset.lang) aiTranslate(b.dataset.lang);
        });
      });
      bar.addEventListener('click', (e) => {
        const b = e.target.closest('.ai-chip[data-act]'); if (!b) return;
        const a = b.dataset.act;
        if (a === 'variants') aiVariants();
        else if (a === 'hook') aiHookFix();
        else if (a === 'tone') aiToneCheck();
        else if (a === 'repurpose') aiRepurpose();
      });
    }
    document.addEventListener('click', () => {
      document.querySelectorAll('.ai-pop').forEach((p) => { p.hidden = true; });
    });

    // alt text
    const aw = $('#altWrite'); if (aw) aw.addEventListener('click', () => aiAltText(false));
    const awa = $('#altWriteAll'); if (awa) awa.addEventListener('click', () => aiAltText(true));

    // hashtags
    const hs = $('#hashSuggest'); if (hs) hs.addEventListener('click', aiHashtags);

    // sermon
    $('#aiSermon').addEventListener('click', openSermon);
    $('#sermonClose').addEventListener('click', closeSermon);
    $('#sermonCancel').addEventListener('click', closeSermon);
    $('#sermonWrap').addEventListener('click', (e) => { if (e.target.id === 'sermonWrap') closeSermon(); });
    $('#sermonGo').addEventListener('click', runSermon);

    refreshAiStatusUI();
  }

})();
