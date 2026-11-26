'use strict';

const $ = (id) => document.getElementById(id);
const dpr = () => window.devicePixelRatio || 1;

let S = clone(DEFAULTS);
let saved = [];
let favorites = new Set();
let undoStack = [JSON.stringify(S)];

// ---------------------------------------------------------------- backend
// Inside the app every call goes to Python (crosskit.py). When index.html is
// opened in a normal browser we fall back to localStorage so it still works.

const local = {
  read() {
    try { return JSON.parse(localStorage.getItem('crosskit')) || {}; } catch { return {}; }
  },
  write(data) {
    try { localStorage.setItem('crosskit', JSON.stringify(data)); } catch { /* private mode */ }
  },
};

async function backend(method, ...args) {
  const api = window.pywebview && window.pywebview.api;
  if (api && api[method]) {
    try { return await api[method](...args); } catch (err) { console.warn(method, err); return null; }
  }

  const data = local.read();
  data.saved = data.saved || [];
  switch (method) {
    case 'load':
      return data;
    case 'remember':
      data.last = args[0];
      break;
    case 'save_crosshair':
      data.saved = data.saved.filter((x) => x.name !== args[0]);
      data.saved.unshift({ name: args[0], code: args[1], time: Math.floor(Date.now() / 1000) });
      break;
    case 'delete_crosshair':
      data.saved = data.saved.filter((x) => x.name !== args[0]);
      break;
    case 'pin':
      data.pinned = args[0];
      break;
    case 'set_pref':
      data[args[0]] = args[1];
      break;
    default:
      return null;
  }
  local.write(data);
  return data.saved;
}

function inApp() {
  return Boolean(window.pywebview && window.pywebview.api && window.pywebview.api.load);
}

// ---------------------------------------------------------------- helpers

let toastTimer;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1900);
}

async function copyText(text) {
  if (inApp() && (await backend('copy', text))) return true;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

function isTyping() {
  const el = document.activeElement;
  return Boolean(document.querySelector('dialog[open]')) ||
    (el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && el.type !== 'range')));
}

const getPath = (path) => path.split('.').reduce((o, k) => o[k], S);
function setPath(path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  keys.reduce((o, k) => o[k], S)[last] = value;
}

// How far the crosshair reaches from the centre, in game pixels.
function extent(s) {
  let e = s.dot ? Math.ceil(s.dotThick / 2) : 1;
  for (const g of [s.inner, s.outer]) {
    if (g.on && g.len > 0 && g.thick > 0) e = Math.max(e, g.offset + g.len + 1);
  }
  return e + (s.outline ? s.outlineThick : 0);
}

function drawThumb(canvas, s) {
  const w = Math.round(canvas.clientWidth * dpr());
  const h = Math.round(canvas.clientHeight * dpr());
  if (!w || !h) return;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  // real in-game size
  drawCrosshair(ctx, Math.floor(w / 2), Math.floor(h / 2), s, realPx());
}

// ---------------------------------------------------------------- state

let persistTimer;
function commit() {
  const snap = JSON.stringify(S);
  if (snap !== undoStack[undoStack.length - 1]) {
    undoStack.push(snap);
    if (undoStack.length > 200) undoStack.shift();
  }
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => backend('remember', encode(S)), 400);
}

function setCrosshair(next) {
  S = next;
  sync();
  commit();
}

function undo() {
  if (undoStack.length < 2) return toast('Nothing to undo');
  undoStack.pop();
  S = JSON.parse(undoStack[undoStack.length - 1]);
  sync();
  backend('remember', encode(S));
  toast('Undone');
}

// Random, but always something you'd actually play with: picks one of a few
// proven layouts and keeps the proportions sane (lines longer than they are
// thick, gaps that fit the line size, no clutter).
function randomCrosshair() {
  const s = clone(DEFAULTS);
  const int = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const chance = (p) => Math.random() < p;

  const custom = ['#00ffcc', '#7cf9ff', '#b6ff00', '#ff4fd8', '#ffe066', '#9d8cff'];
  s.color = pick([1, 1, 5, 5, 5, 4, 6, 7, 0, 8]);
  if (s.color === 8) s.custom = pick(custom);

  s.outline = chance(0.45);
  s.outlineThick = 1;
  s.outlineAlpha = pick([0.5, 0.75, 1]);

  s.inner.alpha = 1;
  s.inner.fire = false;
  s.inner.move = false;
  s.inner.split = false;
  s.outer.on = false;
  s.dot = false;

  const kind = pick(['cross', 'cross', 'cross', 'tiny', 'dot', 'crossdot', 'dynamic']);

  if (kind === 'dot') {
    s.inner.on = false;
    s.dot = true;
    s.dotThick = int(2, 4);
    s.outline = chance(0.7);
    return s;
  }

  s.inner.on = true;
  s.inner.thick = kind === 'tiny' ? int(1, 2) : pick([1, 2, 2]);
  s.inner.len = kind === 'tiny' ? int(s.inner.thick, 2) : int(Math.max(2, s.inner.thick + 1), 6);
  s.inner.offset = kind === 'tiny' ? int(0, 1) : int(1, Math.min(4, s.inner.len));

  if (kind === 'crossdot') {
    s.dot = true;
    s.dotThick = s.inner.thick;
    s.inner.offset = Math.max(s.inner.offset, s.dotThick + 1);
  }
  if (kind === 'dynamic') {
    s.inner.fire = true;
    s.outer.on = true;
    s.outer.alpha = pick([0.35, 0.5]);
    s.outer.len = int(1, 2);
    s.outer.thick = s.inner.thick;
    s.outer.offset = s.inner.offset + s.inner.len + int(3, 6);
    s.outer.move = true;
    s.outer.fire = true;
  }
  return s;
}

// ---------------------------------------------------------------- controls

function linesTab(key, maxOffset) {
  const maxLen = MAX_LEN[key];
  return [{
    title: 'Show lines',
    toggle: key + '.on',
    items: [
      ['slider', key + '.alpha', 'Opacity', 0, 1, 0.01],
      ['slider', key + '.len', 'Length', 0, maxLen, 1],
      ['check', key + '.split', 'Separate vertical length'],
      ['slider', key + '.vlen', 'Vertical length', 0, maxLen, 1, key + '.split'],
      ['slider', key + '.thick', 'Thickness', 0, 10, 1],
      ['slider', key + '.offset', 'Offset', 0, maxOffset, 1],
    ],
  }, {
    title: 'Error',
    needs: key + '.on',
    items: [
      ['check', key + '.move', 'Movement error'],
      ['slider', key + '.moveMult', 'Movement error multiplier', 0, 3, 0.001, key + '.move'],
      ['check', key + '.fire', 'Firing error'],
      ['slider', key + '.fireMult', 'Firing error multiplier', 0, 3, 0.001, key + '.fire'],
    ],
  }];
}

const TABS = {
  general: [
    { title: 'Color', colors: true },
    {
      title: 'Outlines',
      toggle: 'outline',
      items: [['slider', 'outlineAlpha', 'Opacity', 0, 1, 0.01], ['slider', 'outlineThick', 'Thickness', 1, 6, 1]],
    },
    {
      title: 'Center dot',
      toggle: 'dot',
      items: [['slider', 'dotAlpha', 'Opacity', 0, 1, 0.01], ['slider', 'dotThick', 'Thickness', 1, 6, 1]],
    },
  ],
  inner: linesTab('inner', 20),
  outer: linesTab('outer', 40),
};

function groupHtml(g) {
  const head = g.toggle
    ? `<div class="group-head toggle" data-toggle="${g.toggle}">${g.title}<i class="switch"></i></div>`
    : `<div class="group-head">${g.title}</div>`;

  let body = '';
  if (g.colors) {
    body += '<div class="swatches">';
    COLORS.forEach((hex, i) => {
      body += `<button data-color="${i}" style="background:${hex}" title="${COLOR_NAMES[i]}"></button>`;
    });
    body += '<label data-color="8" title="Custom color"><input type="color" id="custom-color"></label></div>';
    body += '<div class="color-name" id="color-name"></div>';
  }
  for (const [type, path, label, min, max, step, needs] of g.items || []) {
    if (type === 'check') {
      body += `<div class="check" data-check="${path}">${label}<i class="switch"></i></div>`;
      continue;
    }
    // multipliers get a typeable box, like the game, since 0.001 steps are fiddly to drag
    const value = path.endsWith('Mult')
      ? `<input class="num" type="number" data-num="${path}" min="${min}" max="${max}" step="${step}">`
      : `<output data-out="${path}"></output>`;
    body += `<div class="slider"${needs ? ` data-needs="${needs}"` : ''}>
      <div class="slider-top"><label>${label}</label>${value}</div>
      <input type="range" data-path="${path}" min="${min}" max="${max}" step="${step}">
    </div>`;
  }

  const bodyAttr = g.toggle ? ` data-body="${g.toggle}"` : g.needs ? ` data-needs="${g.needs}"` : '';
  return `<div class="group">${head}<div class="group-body"${bodyAttr}>${body}</div></div>`;
}

function buildControls() {
  $('controls').innerHTML = Object.entries(TABS)
    .map(([name, groups]) => `<div class="tab${name === 'general' ? ' on' : ''}" data-tab="${name}">${groups.map(groupHtml).join('')}</div>`)
    .join('');

  const root = $('controls');

  root.querySelectorAll('input[type=range]').forEach((input) => {
    input.addEventListener('input', () => {
      setPath(input.dataset.path, Number(input.value));
      sync();
    });
    input.addEventListener('change', commit);
  });

  root.querySelectorAll('input[data-num]').forEach((input) => {
    input.addEventListener('input', () => {
      if (input.value === '' || !Number.isFinite(Number(input.value))) return;
      setPath(input.dataset.num, clampMult(Number(input.value)));
      sync();
    });
    input.addEventListener('change', () => {
      sync(true);
      commit();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') input.blur();
    });
  });

  root.querySelectorAll('[data-toggle], [data-check]').forEach((el) => {
    const path = el.dataset.toggle || el.dataset.check;
    el.addEventListener('click', () => {
      setPath(path, !getPath(path));
      sync();
      commit();
    });
  });

  root.querySelectorAll('.swatches button').forEach((b) => {
    b.addEventListener('click', () => {
      S.color = Number(b.dataset.color);
      sync();
      commit();
    });
  });

  const custom = $('custom-color');
  custom.addEventListener('input', () => {
    S.color = 8;
    S.custom = custom.value;
    sync();
  });
  custom.addEventListener('change', commit);

  $('tabs').querySelectorAll('button').forEach((b) => {
    b.addEventListener('click', () => {
      $('tabs').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      root.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === b.dataset.tab));
    });
  });
}

function formatValue(path, v) {
  if (path.endsWith('lpha')) return Math.round(v * 100) + '%';
  if (path.endsWith('Mult')) return Number(v).toFixed(3); // the game shows 1.000
  return String(v);
}

// Pushes the current state into every control, the code bar and the preview.
function sync(force = false) {
  const root = $('controls');

  root.querySelectorAll('input[type=range]').forEach((input) => {
    const v = getPath(input.dataset.path);
    input.value = v;
    const p = ((v - input.min) / (input.max - input.min)) * 100;
    input.style.setProperty('--p', p + '%');
    const out = root.querySelector(`[data-out="${input.dataset.path}"]`);
    if (out) out.textContent = formatValue(input.dataset.path, v);
  });
  root.querySelectorAll('input[data-num]').forEach((input) => {
    // don't rewrite the box while someone is typing in it
    if (force || document.activeElement !== input) input.value = formatValue(input.dataset.num, getPath(input.dataset.num));
  });

  root.querySelectorAll('[data-toggle], [data-check]').forEach((el) => {
    el.querySelector('.switch').classList.toggle('on', Boolean(getPath(el.dataset.toggle || el.dataset.check)));
  });
  root.querySelectorAll('[data-body]').forEach((el) => {
    el.classList.toggle('off', !getPath(el.dataset.body));
  });
  root.querySelectorAll('[data-needs]').forEach((el) => {
    el.classList.toggle('off', !getPath(el.dataset.needs));
  });

  root.querySelectorAll('.swatches [data-color]').forEach((el) => {
    el.classList.toggle('on', Number(el.dataset.color) === S.color);
  });
  $('custom-color').value = S.custom;
  $('color-name').textContent = S.color === 8 ? `Custom · ${S.custom.toUpperCase()}` : COLOR_NAMES[S.color];

  if (typeof overlay !== 'undefined') overlay.crosshairChanged();

  const code = encode(S);
  $('code').innerHTML = code === '0' ? '0 <span class="faint">&nbsp;game default</span>' : code;
  stage.dirty = true;
}

// ---------------------------------------------------------------- preview

// How many screen pixels one crosshair pixel takes in game. The game scales
// the crosshair with the vertical resolution (1080p = 1), so this keeps the
// preview the same size you'll see in game.
function realPx() {
  const physical = (window.screen && window.screen.height ? window.screen.height : 1080) * dpr();
  return Math.max(1, Math.round(physical / 1080));
}

const stage = {
  canvas: null,
  zoom: 1,
  bg: '#000000',
  spread: 0,
  firing: false,
  keys: new Set(),
  dirty: true,
  last: 0,

  init() {
    this.canvas = $('view');
    new ResizeObserver(() => this.resize()).observe($('stage'));

    const el = $('stage');
    el.addEventListener('pointerdown', (e) => {
      if (e.button === 0 && e.target === this.canvas) this.firing = true;
    });
    window.addEventListener('pointerup', () => { this.firing = false; });
    window.addEventListener('blur', () => { this.firing = false; this.keys.clear(); });

    pickOne($('zoom-pick'), 'zoom', (v) => {
      this.zoom = Number(v);
      this.dirty = true;
      $('size-note').textContent = this.zoom === 1 ? 'Real in-game size' : `Zoomed ${this.zoom}×`;
    });

    this.initBackground();
    requestAnimationFrame((t) => this.frame(t));
  },

  // Black, white or any colour behind the preview – a black outline
  // vanishes on black, so you want to check it on something bright too.
  initBackground() {
    const pick = $('bg-pick');
    const color = $('bg-color');
    let saveTimer;

    const apply = (mode, custom, remember = true) => {
      if (custom) color.value = custom;
      this.bg = mode === 'white' ? '#ffffff' : mode === 'custom' ? color.value : '#000000';
      pick.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.bg === mode));
      $('bg-swatch').style.background = mode === 'custom' ? color.value : '';
      $('stage').style.background = this.bg;
      this.dirty = true;
      if (remember) {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => backend('set_pref', 'stageBg', { mode, color: color.value }), 400);
      }
    };

    pick.querySelectorAll('button').forEach((b) => {
      b.addEventListener('click', () => apply(b.dataset.bg));
    });
    color.addEventListener('input', () => apply('custom'));
    this.setBackground = (saved) => {
      if (saved && saved.mode) apply(saved.mode, saved.color, false);
    };
  },

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.round(r.width * dpr()));
    this.canvas.height = Math.max(1, Math.round(r.height * dpr()));
    this.dirty = true;
  },

  frame(t) {
    const dt = Math.min(0.05, (t - this.last) / 1000 || 0);
    this.last = t;

    const target = this.firing ? 1 : 0;
    if (this.spread !== target) {
      this.spread = this.firing ? Math.min(1, this.spread + dt * 2.4) : Math.max(0, this.spread - dt * 4);
      this.dirty = true;
    }

    // only paint while the editor is on screen
    if (this.dirty && $('page-editor').classList.contains('on')) {
      this.dirty = false;
      const c = this.canvas.getContext('2d');
      c.fillStyle = this.bg;
      c.fillRect(0, 0, this.canvas.width, this.canvas.height);
      const px = realPx() * this.zoom;
      const cx = Math.floor(this.canvas.width / 2);
      const cy = Math.floor(this.canvas.height / 2);
      drawCrosshair(c, cx, cy, S, px, this.spread, this.keys.size > 0);
      $('spread').style.width = Math.round(this.spread * 100) + '%';
    }
    requestAnimationFrame((n) => this.frame(n));
  },

  snapshot(stamp) {
    const c = document.createElement('canvas');
    c.width = this.canvas.width;
    c.height = this.canvas.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(this.canvas, 0, 0);
    const size = Math.round(11 * dpr());
    ctx.font = `600 ${size}px Segoe UI, system-ui, sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#ffffffb0';
    ctx.shadowColor = '#000c';
    ctx.shadowBlur = 3 * dpr();
    ctx.fillText('CrossKit \u00b7 ' + stamp, c.width - size, c.height - size * 0.8);
    return c.toDataURL('image/png');
  },
};

function pickOne(container, attr, onPick) {
  container.querySelectorAll('button').forEach((b) => {
    b.addEventListener('click', () => {
      container.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      onPick(b.dataset[attr]);
    });
  });
}

// ---------------------------------------------------------------- pages

function showPage(name) {
  document.querySelectorAll('.nav button').forEach((b) => b.classList.toggle('on', b.dataset.page === name));
  document.querySelectorAll('.page').forEach((p) => p.classList.toggle('on', p.id === 'page-' + name));
  if (name === 'editor') stage.dirty = true;
  if (name === 'library') renderLibrary();
  if (name === 'pros') pros.render();
  if (name === 'saved') renderSaved();
  if (name === 'overlay') overlay.sync();
}

let libFilter = 'all';
let libThumbs;
const noteCache = new Map();

function libraryNote(item) {
  if (item.note) return item.note;
  if (!noteCache.has(item.code)) noteCache.set(item.code, describe(decode(item.code)));
  return noteCache.get(item.code);
}

// Shape categories are worked out from the crosshair itself, so new library
// entries land in the right place without tagging them by hand.
const shapeCache = new Map();

function shapesOf(item) {
  if (shapeCache.has(item.code)) return shapeCache.get(item.code);
  const s = decode(item.code);
  const shown = (g) => g.on && g.thick > 0 && g.alpha > 0 && (g.len > 0 || (g.split && g.vlen > 0));
  const lines = shown(s.inner) || shown(s.outer);
  const dot = s.dot && s.dotAlpha > 0;
  const out = [];
  if (dot && !lines) out.push('Dot');
  if (lines && !dot) out.push('Cross');
  if (lines && dot) out.push('Cross + dot');
  if ([s.inner, s.outer].some((g) => shown(g) && (g.fire || g.move))) out.push('Dynamic');
  shapeCache.set(item.code, out);
  return out;
}

function inCategory(item, cat) {
  if (cat === 'fav') return favorites.has(item.name);
  return cat === 'all' || item.tag === cat || shapesOf(item).includes(cat);
}

function toggleFavorite(name) {
  if (favorites.has(name)) favorites.delete(name);
  else favorites.add(name);
  backend('set_pref', 'favorites', [...favorites]);
}

function renderLibrary() {
  const proCount = LIBRARY.filter((x) => x.tag === 'Pro').length;
  const starters = LIBRARY.length - proCount;
  $('lib-sub').textContent = `${proCount} pro crosshairs and ${starters} clean starting points.`;
  const q = $('lib-search').value.trim().toLowerCase();
  const items = LIBRARY.filter((x) =>
    inCategory(x, libFilter) &&
    (!q || `${x.name} ${x.team || ''} ${libraryNote(x)}`.toLowerCase().includes(q)));

  document.querySelectorAll('#lib-filter button').forEach((b) => {
    const n = LIBRARY.filter((x) => inCategory(x, b.dataset.f)).length;
    b.dataset.n = n;
  });

  const box = $('library');
  if (!items.length) {
    box.innerHTML = libFilter === 'fav' && !q
      ? '<div class="empty" style="grid-column:1/-1"><svg><use href="#i-star"/></svg><b>No favorites yet</b>Star a crosshair to pin it here.</div>'
      : '<div class="empty" style="grid-column:1/-1"><b>No matches</b>Try a different name or category.</div>';
    return;
  }

  box.innerHTML = items.map((x, i) => `
    <div class="card">
      <div class="card-art">
        <canvas data-i="${i}"></canvas>
        <button class="star${favorites.has(x.name) ? ' on' : ''}" data-fav="${i}" title="Favorite"><svg><use href="#i-star"/></svg></button>
      </div>
      <div class="card-body">
        <div class="card-title"><span>${escapeHtml(x.name)}</span><span class="tag ${x.tag.toLowerCase()}">${x.tag}</span></div>
        ${x.tag === 'Pro' ? `<div class="card-meta">${escapeHtml(x.team || 'No team')}${x.dpi ? ` · ${x.dpi} DPI · ${x.sens}` : ''}</div>` : ''}
        <div class="card-note">${libraryNote(x)}</div>
        <div class="card-actions">
          <button class="btn ghost small" data-use="${i}">Use</button>
          <button class="btn ghost small icon" data-copy="${i}" title="Copy code"><svg><use href="#i-copy"/></svg></button>
        </div>
      </div>
    </div>`).join('');

  // ~200 cards: only draw the ones that scroll into view
  if (libThumbs) libThumbs.disconnect();
  libThumbs = new IntersectionObserver((seen) => {
    for (const it of seen) {
      if (!it.isIntersecting) continue;
      libThumbs.unobserve(it.target);
      drawThumb(it.target, decode(items[it.target.dataset.i].code));
    }
  }, { root: box, rootMargin: '300px' });
  box.querySelectorAll('canvas').forEach((c) => libThumbs.observe(c));
  box.querySelectorAll('[data-fav]').forEach((b) => b.addEventListener('click', () => {
    const item = items[b.dataset.fav];
    toggleFavorite(item.name);
    if (libFilter === 'fav') renderLibrary();
    else {
      b.classList.toggle('on', favorites.has(item.name));
      const chip = document.querySelector('#lib-filter [data-f="fav"]');
      chip.dataset.n = favorites.size;
    }
  }));
  box.querySelectorAll('[data-use]').forEach((b) => b.addEventListener('click', () => {
    const item = items[b.dataset.use];
    setCrosshair(decode(item.code));
    showPage('editor');
    toast(`Loaded ${item.name}`);
  }));
  box.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
    const item = items[b.dataset.copy];
    if (await copyText(item.code)) toast(`Copied ${item.name}'s code`);
  }));
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

function renderSaved() {
  $('saved-count').textContent = saved.length;
  const box = $('saved');

  if (!saved.length) {
    box.innerHTML = `<div class="empty"><svg><use href="#i-bookmark"/></svg>
      <b>Nothing saved yet</b>Build something in the editor and hit Save.</div>`;
    return;
  }

  box.innerHTML = saved.map((x, i) => `
    <div class="row">
      <canvas data-i="${i}"></canvas>
      <div class="row-main"><b>${escapeHtml(x.name)}</b><code class="mono">${escapeHtml(x.code)}</code></div>
      <div class="row-actions">
        <button class="btn ghost small" data-load="${i}">Load</button>
        <button class="btn ghost small icon" data-screen="${i}" title="Show on screen"><svg><use href="#i-screen"/></svg></button>
        <button class="btn ghost small icon" data-copy="${i}" title="Copy code"><svg><use href="#i-copy"/></svg></button>
        <button class="btn ghost small icon danger" data-del="${i}" title="Delete"><svg><use href="#i-trash"/></svg></button>
      </div>
    </div>`).join('');

  box.querySelectorAll('canvas').forEach((c) => {
    const s = decode(saved[c.dataset.i].code);
    if (s) drawThumb(c, s);
  });
  box.querySelectorAll('[data-load]').forEach((b) => b.addEventListener('click', () => {
    const item = saved[b.dataset.load];
    const s = decode(item.code);
    if (!s) return toast('That code looks broken');
    setCrosshair(s);
    showPage('editor');
    toast(`Loaded ${item.name}`);
  }));
  box.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
    if (await copyText(saved[b.dataset.copy].code)) toast('Code copied');
  }));
  box.querySelectorAll('[data-screen]').forEach((b) => b.addEventListener('click', () => {
    const s = decode(saved[b.dataset.screen].code);
    if (!s) return toast('That code looks broken');
    setCrosshair(s);
    overlay.set({ source: 'crosshair' });
    showPage('overlay');
  }));
  box.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    const item = saved[b.dataset.del];
    saved = (await backend('delete_crosshair', item.name)) || saved.filter((x) => x !== item);
    renderSaved();
    toast(`Deleted ${item.name}`);
  }));
}

// ---------------------------------------------------------------- dialogs & actions

function openImport(prefill = '') {
  $('import-text').value = prefill;
  $('import-err').textContent = '';
  $('dlg-import').showModal();
  $('import-text').focus();
}

// Several codes (one per line, optionally "name: code" or "name - code")
// are saved in one go.
function parseList(text) {
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const at = line.search(/(^|[\s:|-])0(;|$)/);
    if (at < 0) return null;
    const code = line.slice(at).replace(/^[\s:|-]+/, '').split(/\s/)[0];
    const name = line.slice(0, at).replace(/[\s:|-]+$/, '').trim();
    return decode(code) ? { name, code } : null;
  }).filter(Boolean);
}

async function importList(list) {
  for (const [i, x] of list.entries()) {
    saved = (await backend('save_crosshair', x.name || `Imported ${i + 1}`, x.code)) || saved;
  }
  $('saved-count').textContent = saved.length;
  showPage('saved');
  toast(`Imported ${list.length} crosshairs`);
}

function importCode(text) {
  const list = parseList(text);
  if (list.length > 1) {
    importList(list);
    return true;
  }
  const s = decode(list.length ? list[0].code : text);
  if (!s) return false;
  setCrosshair(s);
  showPage('editor');
  toast('Crosshair imported');
  return true;
}

function openSave() {
  $('save-name').value = '';
  $('dlg-save').showModal();
  $('save-name').focus();
}

async function saveCurrent() {
  const name = $('save-name').value.trim() || `Crosshair ${saved.length + 1}`;
  saved = (await backend('save_crosshair', name, encode(S))) || saved;
  $('saved-count').textContent = saved.length;
  if ($('page-saved').classList.contains('on')) renderSaved();
  toast(`Saved as "${name}"`);
}

async function copyAll() {
  if (!saved.length) return toast('Nothing saved yet');
  const text = saved.map((x) => `${x.name}: ${x.code}`).join('\n');
  if (await copyText(text)) toast(`Copied ${saved.length} crosshairs`);
}

async function copyCode() {
  if (await copyText(encode(S))) toast('Code copied — paste it in your game settings');
  else toast('Could not reach the clipboard');
}

async function exportPng() {
  const url = stage.snapshot(SIGN);
  if (inApp()) {
    const path = await backend('export_png', url);
    toast(path ? 'Saved to Pictures/CrossKit' : 'Could not save the image');
    return;
  }
  const a = document.createElement('a');
  a.href = url;
  a.download = 'crosshair.png';
  a.click();
}

function bindActions() {
  document.querySelectorAll('.nav button').forEach((b) => b.addEventListener('click', () => showPage(b.dataset.page)));

  $('btn-copy').addEventListener('click', copyCode);
  $('btn-import').addEventListener('click', () => openImport());
  $('btn-save').addEventListener('click', openSave);
  $('btn-save-2').addEventListener('click', openSave);
  $('btn-png').addEventListener('click', exportPng);
  $('btn-copy-all').addEventListener('click', copyAll);
  $('btn-keys').addEventListener('click', () => $('dlg-keys').showModal());
  $('btn-folder').addEventListener('click', () => {
    if (inApp()) backend('open_folder');
    else toast('Only available in the desktop app');
  });
  $('btn-random').addEventListener('click', () => setCrosshair(randomCrosshair()));
  $('btn-reset').addEventListener('click', () => {
    setCrosshair(clone(DEFAULTS));
    toast('Back to the game default');
  });

  $('pin').addEventListener('click', () => {
    const on = !$('pin').classList.contains('on');
    $('pin').classList.toggle('on', on);
    backend('pin', on);
  });

  pickOne($('lib-filter'), 'f', (v) => { libFilter = v; renderLibrary(); });
  $('lib-search').addEventListener('input', renderLibrary);
  pros.bind();

  $('import-ok').addEventListener('click', (e) => {
    e.preventDefault();
    if (importCode($('import-text').value)) $('dlg-import').close();
    else $('import-err').textContent = "That doesn't look like a crosshair code.";
  });
  $('import-text').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      $('import-ok').click();
    }
  });
  $('save-ok').addEventListener('click', () => saveCurrent());

  window.addEventListener('keydown', (e) => {
    if (isTyping()) return;
    const key = e.key.toLowerCase();

    if (e.code === 'Space') {
      e.preventDefault();
      stage.firing = true;
    } else if (key.length === 1 && 'wasd'.includes(key) && !e.ctrlKey) {
      stage.keys.add(key);
      stage.dirty = true;
    } else if (e.ctrlKey && key === 'z') {
      e.preventDefault();
      undo();
    } else if (e.ctrlKey && key === 's') {
      e.preventDefault();
      openSave();
    } else if (!e.ctrlKey && !e.altKey && key === 'c') {
      copyCode();
    } else if (!e.ctrlKey && !e.altKey && key === 'r') {
      setCrosshair(randomCrosshair());
    } else if (e.key === '?') {
      $('dlg-keys').showModal();
    } else if (!e.ctrlKey && !e.altKey && '12345'.includes(key) && key.length === 1) {
      showPage(['editor', 'library', 'pros', 'saved', 'overlay'][Number(key) - 1]);
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') stage.firing = false;
    if (stage.keys.delete(e.key.toLowerCase())) stage.dirty = true;
  });

  // pasting a code anywhere imports it straight away
  window.addEventListener('paste', (e) => {
    if (isTyping()) return;
    const text = (e.clipboardData || window.clipboardData).getData('text');
    if (!importCode(text)) openImport(text);
  });

  window.addEventListener('resize', () => {
    if ($('page-overlay').classList.contains('on')) overlay.sync();
    if ($('page-library').classList.contains('on')) renderLibrary();
  });
}

// ---------------------------------------------------------------- boot

function waitForBackend() {
  return new Promise((resolve) => {
    if (inApp()) return resolve();
    window.addEventListener('pywebviewready', resolve, { once: true });
    setTimeout(resolve, 800);
  });
}

async function boot() {
  buildControls();
  bindActions();
  stage.init();
  sync();

  await waitForBackend();
  const data = (await backend('load')) || {};
  saved = data.saved || [];
  $('saved-count').textContent = saved.length;
  if (data.version) $('version').textContent = 'v' + data.version;
  if (data.pinned) $('pin').classList.add('on');
  favorites = new Set(data.favorites || []);
  overlay.init(data.overlay, data.overlayImage);
  pros.init(data.mouse);
  stage.setBackground(data.stageBg);

  const last = data.last && decode(data.last);
  if (last && undoStack.length === 1) {
    S = last;
    undoStack = [JSON.stringify(S)];
    sync();
  }
}

boot();
