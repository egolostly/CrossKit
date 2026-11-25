// Crosshair model: share-code parsing/encoding and canvas drawing.
//
// A code looks like "0;s;1;P;c;5;h;0;0l;4;...;S;c;0;s;1.2". The leading block
// holds general options, P is the primary crosshair, A the ADS crosshair and
// S the sniper dot. Only values that differ from the game default are written.
//
// CrossKit edits the primary crosshair. Everything it doesn't understand
// (general options, ADS/sniper sections, error multipliers...) is kept as-is
// so an imported code still comes out the same when you copy it back.

'use strict';

const COLORS = ['#ffffff', '#00ff00', '#7fff00', '#dfff00', '#ffff00', '#00ffff', '#ff00ff', '#ff0000'];
const COLOR_NAMES = ['White', 'Green', 'Yellow green', 'Green yellow', 'Yellow', 'Cyan', 'Pink', 'Red', 'Custom'];

const DEFAULTS = {
  color: 0,
  custom: '#ffffff',
  outline: true,
  outlineThick: 1,
  outlineAlpha: 0.5,
  dot: false,
  dotThick: 2,
  dotAlpha: 1,
  inner: { on: true, alpha: 0.8, len: 6, vlen: 6, split: false, thick: 2, offset: 3, move: false, moveMult: 1, fire: true, fireMult: 1 },
  outer: { on: true, alpha: 0.35, len: 2, vlen: 2, split: false, thick: 2, offset: 10, move: true, moveMult: 1, fire: true, fireMult: 1 },
  extra: { head: [], primary: [], tail: [] },
};

const clone = (o) => JSON.parse(JSON.stringify(o));
const clampInt = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(v)));
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const trimNum = (v) => String(Math.round(v * 1000) / 1000);
// error multipliers: 0-3 in steps of 0.001, like the in-game slider
const clampMult = (v) => Math.round(Math.min(3, Math.max(0, v)) * 1000) / 1000;
// line length limits differ: inner lines go to 20, outer lines stop at 10
const MAX_LEN = { inner: 20, outer: 10 };

function crosshairColor(s) {
  return s.color === 8 ? s.custom : COLORS[s.color];
}

function encode(s) {
  const d = DEFAULTS;
  const out = [];
  const put = (key, value, def) => {
    if (String(value) !== String(def)) out.push(key, value);
  };
  const bit = (b) => (b ? 1 : 0);

  put('c', s.color, d.color);
  if (s.color === 8 || s.custom !== d.custom) out.push('u', s.custom.slice(1).toUpperCase() + 'FF');
  put('h', bit(s.outline), bit(d.outline));
  put('t', s.outlineThick, d.outlineThick);
  put('o', trimNum(s.outlineAlpha), trimNum(d.outlineAlpha));
  put('d', bit(s.dot), bit(d.dot));
  put('z', s.dotThick, d.dotThick);
  put('a', trimNum(s.dotAlpha), trimNum(d.dotAlpha));

  for (const [p, key] of [['0', 'inner'], ['1', 'outer']]) {
    const g = s[key];
    const dg = d[key];
    put(p + 'b', bit(g.on), bit(dg.on));
    put(p + 't', g.thick, dg.thick);
    put(p + 'l', g.len, dg.len);
    put(p + 'v', g.vlen, dg.vlen);
    put(p + 'g', bit(g.split), bit(dg.split));
    put(p + 'o', g.offset, dg.offset);
    put(p + 'a', trimNum(g.alpha), trimNum(dg.alpha));
    put(p + 'm', bit(g.move), bit(dg.move));
    put(p + 's', trimNum(g.moveMult ?? 1), trimNum(dg.moveMult));
    put(p + 'f', bit(g.fire), bit(dg.fire));
    put(p + 'e', trimNum(g.fireMult ?? 1), trimNum(dg.fireMult));
  }

  const extra = s.extra || d.extra;
  const primary = out.concat(extra.primary.flat());
  const parts = ['0', ...extra.head.flat()];
  if (primary.length) parts.push('P', ...primary);
  parts.push(...extra.tail);
  return parts.join(';');
}

// Applies one primary-section key. Returns false for a broken value and
// 'unknown' for keys CrossKit doesn't edit.
function applyKey(s, key, raw) {
  if (key === 'u') {
    if (!/^[0-9a-f]{6}/i.test(raw)) return false;
    s.custom = '#' + raw.slice(0, 6).toLowerCase();
    return true;
  }

  const v = Number(raw);
  if (raw === '' || !Number.isFinite(v)) return false;

  const lines = key[0] === '0' ? s.inner : key[0] === '1' ? s.outer : null;
  if (lines && key.length === 2) {
    const maxLen = lines === s.inner ? MAX_LEN.inner : MAX_LEN.outer;
    switch (key[1]) {
      case 'b': lines.on = v !== 0; return true;
      case 't': lines.thick = clampInt(v, 0, 10); return true;
      case 'l': lines.len = clampInt(v, 0, maxLen); return true;
      case 'v': lines.vlen = clampInt(v, 0, maxLen); return true;
      case 'g': lines.split = v !== 0; return true;
      case 'o': lines.offset = clampInt(v, 0, lines === s.inner ? 20 : 40); return true;
      case 'a': lines.alpha = clamp01(v); return true;
      case 'm': lines.move = v !== 0; return true;
      case 's': lines.moveMult = clampMult(v); return true;
      case 'f': lines.fire = v !== 0; return true;
      case 'e': lines.fireMult = clampMult(v); return true;
      default: return 'unknown';
    }
  }

  switch (key) {
    case 'c': s.color = clampInt(v, 0, 8); return true;
    case 'h': s.outline = v !== 0; return true;
    case 't': s.outlineThick = clampInt(v, 1, 6); return true;
    case 'o': s.outlineAlpha = clamp01(v); return true;
    case 'd': s.dot = v !== 0; return true;
    case 'z': s.dotThick = clampInt(v, 1, 6); return true;
    case 'a': s.dotAlpha = clamp01(v); return true;
    default: return 'unknown';
  }
}

// Returns a settings object, or null if the text isn't a valid code.
function decode(text) {
  const parts = String(text || '').trim().replace(/;+$/, '').split(';').map((p) => p.trim());
  if (parts[0] !== '0') return null;

  const s = clone(DEFAULTS);
  let section = '';
  let i = 1;

  while (i < parts.length) {
    const key = parts[i];
    if (key === 'P' || key === 'A' || key === 'S') {
      section = key;
      if (key !== 'P') s.extra.tail.push(key);
      i += 1;
      continue;
    }

    const value = parts[i + 1];
    if (value === undefined || key === '' || value === '' || /nan/i.test(value)) return null;
    i += 2;

    if (section === '') {
      s.extra.head.push([key, value]);
    } else if (section === 'P') {
      const ok = applyKey(s, key, value);
      if (ok === false) return null;
      if (ok === 'unknown') s.extra.primary.push([key, value]);
    } else {
      s.extra.tail.push(key, value);
    }
  }
  return s;
}

function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

// Draws the crosshair around the middle of the game pixel whose top-left
// corner is at (cx, cy). `px` is the size of one game pixel on the canvas.
// `spread` (0..1) and `moving` simulate the firing / movement error.
//
// Every element is laid out around the same centre point (half a pixel in),
// so mixed odd/even thicknesses stay symmetric. With an even `px` all edges
// land on whole canvas pixels; with px = 1 they get rounded.
function drawCrosshair(ctx, cx, cy, s, px, spread = 0, moving = false) {
  const C = 0.5;
  const rects = [];

  const addLines = (g) => {
    if (!g.on || g.thick <= 0) return;
    // the game pushes error lines out by the weapon's spread times the multiplier
    const fire = g.fire ? spread * 14 * (g.fireMult ?? 1) : 0;
    const move = g.move && moving ? 7 * (g.moveMult ?? 1) : 0;
    const off = g.offset + Math.round(fire + move);
    const gap = off + (g.thick % 2) / 2;
    const side = C - g.thick / 2;
    const h = g.len;
    const v = g.split ? g.vlen : g.len;
    if (v > 0) rects.push([side, C - gap - v, g.thick, v, g.alpha], [side, C + gap, g.thick, v, g.alpha]);
    if (h > 0) rects.push([C - gap - h, side, h, g.thick, g.alpha], [C + gap, side, h, g.thick, g.alpha]);
  };

  addLines(s.outer);
  addLines(s.inner);

  if (s.dot) {
    const side = C - s.dotThick / 2;
    rects.push([side, side, s.dotThick, s.dotThick, s.dotAlpha]);
  }

  // game units -> snapped canvas rect
  const box = (x, y, w, h) => {
    const x0 = Math.round(cx + x * px);
    const y0 = Math.round(cy + y * px);
    return [x0, y0, Math.round(cx + (x + w) * px) - x0, Math.round(cy + (y + h) * px) - y0];
  };

  if (s.outline && s.outlineAlpha > 0) {
    const e = s.outlineThick;
    ctx.fillStyle = `rgba(0,0,0,${s.outlineAlpha})`;
    for (const [x, y, w, h] of rects) {
      ctx.beginPath();
      ctx.rect(...box(x - e, y - e, w + e * 2, h + e * 2));
      ctx.rect(...box(x, y, w, h));
      ctx.fill('evenodd');
    }
  }

  const color = crosshairColor(s);
  for (const [x, y, w, h, a] of rects) {
    ctx.fillStyle = rgba(color, a);
    ctx.fillRect(...box(x, y, w, h));
  }
}

// Short human description, used on library cards: "Cyan cross, no gap".
function describe(s) {
  const visible = (g) => g.on && g.thick > 0 && g.alpha > 0 && (g.len > 0 || (g.split && g.vlen > 0));
  const lines = visible(s.inner) || visible(s.outer);
  const dot = s.dot && s.dotAlpha > 0;

  let shape = 'empty';
  if (lines && dot) shape = 'cross with a dot';
  else if (lines) shape = 'cross';
  else if (dot) shape = s.dotThick >= 3 ? 'big dot' : 'dot';

  if (lines) {
    const g = visible(s.inner) ? s.inner : s.outer;
    if (g.split && g.vlen === 0) shape = dot ? 'dash with a dot' : 'horizontal dash';
    else if (visible(s.inner) && visible(s.outer)) shape = dot ? 'double cross with a dot' : 'double cross';
    else if (g.len + g.offset <= 3 && shape === 'cross') shape = 'tiny cross';
  }

  const color = s.color === 8 ? 'Custom' : COLOR_NAMES[s.color];
  const bits = [`${color} ${shape}`];
  if (lines && visible(s.inner) && s.inner.offset === 0) bits.push('no gap');
  if (lines && (s.inner.fire && visible(s.inner))) bits.push('dynamic');
  bits.push(s.outline && s.outlineAlpha > 0 ? 'outlined' : 'no outlines');
  return bits.join(', ');
}

// ---------------------------------------------------------------- credit
// Author credit, required by the license. The app keeps it on screen.

const SIGN = [55,59,62,63,122,56,35,116,122,31,61,53,22,53,41,46].map((b) => String.fromCharCode(b ^ 0x5a)).join('');

(function keepCredit() {
  if (typeof document === 'undefined') return;
  const lock = 'display:block!important;visibility:visible!important;opacity:1!important;' +
    'position:fixed!important;left:22px!important;bottom:12px!important;z-index:2147483647!important;' +
    'pointer-events:none!important;transform:none!important;filter:none!important;clip-path:none!important';
  const make = () => {
    const host = document.createElement('ck-credit');
    host.setAttribute('style', lock);
    const root = host.attachShadow({ mode: 'closed' });
    const parts = SIGN.split(' ');
    const name = parts.pop();
    root.innerHTML = '<span style="font:500 11px/1.4 Segoe UI,system-ui,sans-serif;color:#52525b;' +
      'letter-spacing:.2px;white-space:nowrap">' + parts.join(' ') +
      ' <b style="color:#4cc2ff;font-weight:600">' + name + '</b></span>';
    return host;
  };
  let el = null;
  const guard = () => {
    if (!el || !el.isConnected) {
      el = document.querySelector('ck-credit') || make();
      if (!el.isConnected) document.documentElement.appendChild(el);
      watch.observe(el, { attributes: true });
    }
    if (el.getAttribute('style') !== lock) el.setAttribute('style', lock);
  };
  const watch = new MutationObserver(guard);
  guard();
  // cheap: only direct children of <html> and the credit element itself
  new MutationObserver(guard).observe(document.documentElement, { childList: true });
  setInterval(guard, 3000);
})();

if (typeof module !== 'undefined') {
  module.exports = { DEFAULTS, COLORS, MAX_LEN, encode, decode, describe, clone, SIGN };
}
