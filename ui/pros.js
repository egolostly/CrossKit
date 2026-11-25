// Pro settings page: DPI, sens, eDPI and cm/360 for every pro in library.js,
// plus a "your setup" box that converts any of them to your own DPI.

'use strict';

// cm per full turn: 360° / (eDPI × 0.07° per count) × 2.54 cm per inch
const CM360 = (360 / 0.07) * 2.54;

const pros = (() => {
  const mouse = { dpi: 800, sens: 0.35 };
  const sort = { key: 'name', dir: 1 };
  let filter = 'all';
  let saveTimer;
  let thumbs;

  const median = (list) => {
    const s = [...list].sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  const fmt = (v, digits = 3) => String(Math.round(v * 10 ** digits) / 10 ** digits);
  const myEdpi = () => mouse.dpi * mouse.sens;

  function matches(p) {
    if (filter === 'code') return Boolean(p.code);
    if (filter === 'other') return ![400, 800, 1600].includes(p.dpi);
    return filter === 'all' || p.dpi === Number(filter);
  }

  function value(p, key) {
    if (key === 'name') return p.name.toLowerCase();
    if (key === 'team') return (p.team || '~').toLowerCase();
    if (key === 'cm') return -p.edpi; // higher eDPI = fewer cm
    if (key === 'mine') return p.edpi;
    if (key === 'seen') return seenOrder(p.seen);
    return p[key];
  }

  function seenOrder(text) {
    const m = /(\w{3}) (\d{4})/.exec(text || '');
    if (!m) return 0;
    return Number(m[2]) * 12 + 'JanFebMarAprMayJunJulAugSepOctNovDec'.indexOf(m[1]) / 3;
  }

  // ---------------------------------------------------------------- top area

  function renderStats() {
    const all = PRO_SETTINGS;
    const med = median(all.map((p) => p.edpi));
    const byDpi = {};
    for (const p of all) byDpi[p.dpi] = (byDpi[p.dpi] || 0) + 1;
    const [topDpi, topCount] = Object.entries(byDpi).sort((a, b) => b[1] - a[1])[0];

    $('pro-sub').textContent = `${all.length} players. Values change often, so check the date before you copy one.`;
    $('pro-stats').innerHTML = [
      ['Players', all.length, `${all.filter((p) => p.code).length} with a crosshair`],
      ['Median eDPI', fmt(med, 0), 'half the pros are below this'],
      ['Most used DPI', topDpi, `${Math.round((topCount / all.length) * 100)}% of players`],
      ['Median cm/360', fmt(CM360 / med, 1), 'one full turn on the pad'],
    ].map(([label, big, small]) => `
      <div class="stat"><span>${label}</span><b>${big}</b><small>${small}</small></div>`).join('');
  }

  function renderYou() {
    const e = myEdpi();
    const all = PRO_SETTINGS;
    const valid = e > 0 && Number.isFinite(e);
    $('you-edpi').textContent = valid ? fmt(e, 1) : '–';
    $('you-cm').textContent = valid ? fmt(CM360 / e, 1) + ' cm' : '–';

    let verdict = 'Enter your mouse DPI and in-game sens.';
    if (valid) {
      const slower = all.filter((p) => p.edpi < e).length;
      const pct = Math.round((slower / all.length) * 100);
      if (pct >= 95) verdict = 'Faster than almost every pro.';
      else if (pct <= 5) verdict = 'Slower than almost every pro.';
      else verdict = `Faster than ${pct}% of pros.`;
    }
    $('you-verdict').textContent = verdict;

    // eDPI spread, 0-600 in 25 wide buckets, with a marker for you
    const max = 600;
    const step = 25;
    const bins = new Array(max / step).fill(0);
    for (const p of all) bins[Math.min(bins.length - 1, Math.floor(p.edpi / step))] += 1;
    const top = Math.max(...bins);
    const mine = valid ? Math.min(max, e) / max : -1;
    $('you-spread').innerHTML =
      bins.map((n, i) => {
        const hot = valid && e >= i * step && (e < (i + 1) * step || (i === bins.length - 1 && e >= max));
        return `<i class="${hot ? 'hot' : ''}" style="height:${Math.max(4, (n / top) * 100)}%" title="${i * step}–${(i + 1) * step} eDPI: ${n}"></i>`;
      }).join('') +
      (mine >= 0 ? `<em style="left:${mine * 100}%"></em>` : '');
  }

  // ---------------------------------------------------------------- table

  function render() {
    renderYou();
    const q = $('pro-search').value.trim().toLowerCase();
    const rows = PRO_SETTINGS
      .filter((p) => matches(p) && (!q || `${p.name} ${p.team || ''}`.toLowerCase().includes(q)))
      .sort((a, b) => {
        const x = value(a, sort.key);
        const y = value(b, sort.key);
        return (x < y ? -1 : x > y ? 1 : 0) * sort.dir || a.name.localeCompare(b.name);
      });

    document.querySelectorAll('#pro-filter button').forEach((b) => {
      const was = filter;
      filter = b.dataset.f;
      b.dataset.n = PRO_SETTINGS.filter(matches).length;
      filter = was;
    });
    document.querySelectorAll('.pro-table th[data-k]').forEach((th) => {
      th.classList.toggle('sorted', th.dataset.k === sort.key);
      th.classList.toggle('desc', th.dataset.k === sort.key && sort.dir < 0);
    });

    const body = $('pro-rows');
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="8" class="none">No players match that.</td></tr>';
      return;
    }

    const dpi = mouse.dpi > 0 ? mouse.dpi : 0;
    const e = myEdpi();
    body.innerHTML = rows.map((p, i) => {
      const yours = dpi ? fmt(p.edpi / dpi) : '–';
      const close = e > 0 && Math.abs(p.edpi - e) / e <= 0.05;
      return `
      <tr class="${close ? 'close' : ''}">
        <td><div class="who">
          ${p.code ? `<canvas data-i="${i}"></canvas>` : '<span class="no-xh" title="No recent crosshair code"></span>'}
          <div><b>${escapeHtml(p.name)}</b><small>${escapeHtml(p.team || 'No team')}</small></div>
        </div></td>
        <td class="n">${p.dpi}</td>
        <td class="n">${fmt(p.sens)}</td>
        <td class="n strong">${fmt(p.edpi, 1)}</td>
        <td class="n">${fmt(CM360 / p.edpi, 1)}</td>
        <td class="n"><button class="mine" data-sens="${i}" title="Copy this sens">${yours}</button></td>
        <td class="seen">${p.seen || '–'}</td>
        <td class="act">${p.code
          ? `<button class="btn ghost small" data-use="${i}">Use crosshair</button>`
          : ''}</td>
      </tr>`;
    }).join('');

    if (thumbs) thumbs.disconnect();
    thumbs = new IntersectionObserver((seen) => {
      for (const it of seen) {
        if (!it.isIntersecting) continue;
        thumbs.unobserve(it.target);
        drawThumb(it.target, decode(rows[it.target.dataset.i].code));
      }
    }, { root: $('pro-wrap'), rootMargin: '200px' });
    body.querySelectorAll('canvas').forEach((c) => thumbs.observe(c));

    body.querySelectorAll('[data-use]').forEach((b) => b.addEventListener('click', () => {
      const p = rows[b.dataset.use];
      setCrosshair(decode(p.code));
      showPage('editor');
      toast(`Loaded ${p.name}'s crosshair`);
    }));
    body.querySelectorAll('[data-sens]').forEach((b) => b.addEventListener('click', async () => {
      const p = rows[b.dataset.sens];
      if (!dpi) return;
      if (await copyText(b.textContent)) toast(`${b.textContent} at ${dpi} DPI feels like ${p.name}`);
    }));
  }

  // ---------------------------------------------------------------- setup

  function readMouse() {
    mouse.dpi = Math.max(0, Math.round(Number($('you-dpi').value) || 0));
    mouse.sens = Math.max(0, Number($('you-sens').value) || 0);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => backend('set_pref', 'mouse', { ...mouse }), 600);
    render();
  }

  function init(saved) {
    if (saved && saved.dpi > 0) mouse.dpi = saved.dpi;
    if (saved && saved.sens > 0) mouse.sens = saved.sens;
    $('you-dpi').value = mouse.dpi;
    $('you-sens').value = mouse.sens;
    renderStats();
  }

  function bind() {
    $('you-dpi').value = mouse.dpi;
    $('you-sens').value = mouse.sens;
    renderStats();
    $('pro-search').addEventListener('input', render);
    $('you-dpi').addEventListener('input', readMouse);
    $('you-sens').addEventListener('input', readMouse);
    pickOne($('pro-filter'), 'f', (v) => { filter = v; render(); });
    document.querySelectorAll('.pro-table th[data-k]').forEach((th) => th.addEventListener('click', () => {
      const k = th.dataset.k;
      if (sort.key === k) sort.dir = -sort.dir;
      else Object.assign(sort, { key: k, dir: k === 'seen' ? -1 : 1 });
      render();
    }));
  }

  return { init, bind, render };
})();
