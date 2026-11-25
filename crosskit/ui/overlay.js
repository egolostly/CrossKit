// Screen overlay: puts a crosshair, a custom shape or your own image in the
// middle of the screen, on top of everything (see overlay.py).
//
// Shapes are plain canvas paths drawn around (0, 0). `r` is half the size,
// so every shape fits in a box from -r to r.

'use strict';

const SHAPES = {
  stick: {
    name: 'Stick figure',
    head: (r) => -r + r * 0.26, // y of the head centre
    draw(c, r) {
      const head = r * 0.26;
      c.beginPath();
      c.arc(0, -r + head, head, 0, Math.PI * 2);
      c.moveTo(0, -r + head * 2);
      c.lineTo(0, r * 0.25);
      c.moveTo(-r * 0.62, -r * 0.22);
      c.lineTo(0, -r * 0.34);
      c.lineTo(r * 0.62, -r * 0.22);
      c.moveTo(-r * 0.5, r);
      c.lineTo(0, r * 0.25);
      c.lineTo(r * 0.5, r);
      c.stroke();
    },
  },
  dot: {
    name: 'Dot',
    draw(c, r) {
      c.beginPath();
      c.arc(0, 0, r * 0.3, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    },
  },
  plus: {
    name: 'Plus',
    draw(c, r) {
      c.beginPath();
      c.moveTo(0, -r); c.lineTo(0, r);
      c.moveTo(-r, 0); c.lineTo(r, 0);
      c.stroke();
    },
  },
  square: {
    name: 'Square',
    draw(c, r) {
      const k = r * 0.8;
      c.beginPath();
      c.rect(-k, -k, k * 2, k * 2);
      c.stroke();
    },
  },
  ring: {
    name: 'Ring',
    draw(c, r) {
      c.beginPath();
      c.arc(0, 0, r, 0, Math.PI * 2);
      c.stroke();
    },
  },
  ringDot: {
    name: 'Ring + dot',
    draw(c, r, lw) {
      c.beginPath();
      c.arc(0, 0, r, 0, Math.PI * 2);
      c.stroke();
      c.beginPath();
      c.arc(0, 0, Math.max(1.5, lw * 1.1), 0, Math.PI * 2);
      c.fill();
    },
  },
  scope: {
    name: 'Scope',
    draw(c, r) {
      c.beginPath();
      c.arc(0, 0, r * 0.7, 0, Math.PI * 2);
      c.moveTo(0, -r); c.lineTo(0, -r * 0.25);
      c.moveTo(0, r); c.lineTo(0, r * 0.25);
      c.moveTo(-r, 0); c.lineTo(-r * 0.25, 0);
      c.moveTo(r, 0); c.lineTo(r * 0.25, 0);
      c.stroke();
    },
  },
  chevron: {
    name: 'Chevron',
    draw(c, r) {
      c.beginPath();
      c.moveTo(-r, r * 0.6);
      c.lineTo(0, 0);
      c.lineTo(r, r * 0.6);
      c.stroke();
    },
  },
  triangle: {
    name: 'Triangle',
    draw(c, r) {
      c.beginPath();
      c.moveTo(0, -r);
      c.lineTo(r * 0.87, r * 0.5);
      c.lineTo(-r * 0.87, r * 0.5);
      c.closePath();
      c.stroke();
    },
  },
  diamond: {
    name: 'Diamond',
    draw(c, r) {
      c.beginPath();
      c.moveTo(0, -r); c.lineTo(r, 0); c.lineTo(0, r); c.lineTo(-r, 0);
      c.closePath();
      c.stroke();
    },
  },
  brackets: {
    name: 'Brackets',
    draw(c, r) {
      const k = r * 0.45;
      c.beginPath();
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        c.moveTo(sx * r, sy * (r - k));
        c.lineTo(sx * r, sy * r);
        c.lineTo(sx * (r - k), sy * r);
      }
      c.stroke();
    },
  },
  x: {
    name: 'X',
    draw(c, r) {
      const a = r * 0.3;
      c.beginPath();
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        c.moveTo(sx * a, sy * a);
        c.lineTo(sx * r, sy * r);
      }
      c.stroke();
    },
  },
  tshape: {
    name: 'T-shape',
    draw(c, r) {
      const g = r * 0.25;
      c.beginPath();
      c.moveTo(-r, 0); c.lineTo(-g, 0);
      c.moveTo(r, 0); c.lineTo(g, 0);
      c.moveTo(0, g); c.lineTo(0, r);
      c.stroke();
    },
  },
  star: {
    name: 'Star',
    draw(c, r) {
      c.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const d = i % 2 ? r * 0.42 : r;
        c[i ? 'lineTo' : 'moveTo'](Math.cos(a) * d, Math.sin(a) * d);
      }
      c.closePath();
      c.stroke();
    },
  },
  heart: {
    name: 'Heart',
    draw(c, r) {
      c.beginPath();
      c.moveTo(0, r * 0.85);
      c.bezierCurveTo(-r * 1.25, -r * 0.05, -r * 0.55, -r * 1.05, 0, -r * 0.4);
      c.bezierCurveTo(r * 0.55, -r * 1.05, r * 1.25, -r * 0.05, 0, r * 0.85);
      c.closePath();
      c.stroke();
    },
  },
  smiley: {
    name: 'Smiley',
    draw(c, r, lw) {
      c.beginPath();
      c.arc(0, 0, r, 0, Math.PI * 2);
      c.moveTo(r * 0.55, r * 0.15);
      c.arc(0, r * 0.15, r * 0.55, 0, Math.PI);
      c.stroke();
      for (const sx of [-1, 1]) {
        c.beginPath();
        c.arc(sx * r * 0.35, -r * 0.3, Math.max(1.2, lw * 0.9), 0, Math.PI * 2);
        c.fill();
      }
    },
  },
  arrow: {
    name: 'Arrow',
    draw(c, r) {
      c.beginPath();
      c.moveTo(0, -r); c.lineTo(0, -r * 0.1);
      c.moveTo(-r * 0.4, -r * 0.5); c.lineTo(0, -r * 0.1); c.lineTo(r * 0.4, -r * 0.5);
      c.stroke();
    },
  },
};

const OVERLAY_DEFAULTS = {
  source: 'shape', // 'crosshair' | 'shape' | 'image'
  shape: 'stick',
  color: '#4cc2ff',
  size: 24,
  thick: 1,
  outline: true,
  dot: false,
  headAim: false,
  hideAds: false,
  scale: 1,
  opacity: 1,
  dx: 0,
  dy: 0,
  imgSize: 96,
  image: null,
  imageName: '',
};

const OVERLAY_COLORS = ['#ffffff', '#00ff00', '#ffff00', '#00ffff', '#ff00ff', '#ff0000', '#4cc2ff', '#ff8a00'];

const overlay = {
  o: { ...OVERLAY_DEFAULTS },
  on: false,
  ready: false,
  tilesDirty: true,
  previewQueued: false,
  img: null,
  sendTimer: null,
  saveTimer: null,

  // -- rendering ---------------------------------------------------------

  // Draws one shape into `c`. (cx, cy) is the aim point: the shape's centre,
  // or its head when `aimY` is set (the head's y relative to the centre).
  drawShape(c, cx, cy, key, size, thick, color, outline, dot, aimY = 0) {
    const shape = SHAPES[key] || SHAPES.ring;
    const r = size / 2;
    const k = Math.ceil(thick / 2);
    c.save();
    c.translate(cx, cy);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.translate(0, -aimY);
    if (outline) {
      c.strokeStyle = c.fillStyle = '#000';
      c.lineWidth = thick + 2;
      shape.draw(c, r, thick + 1);
    }
    c.strokeStyle = c.fillStyle = color;
    c.lineWidth = thick;
    shape.draw(c, r, thick);
    c.translate(0, aimY);
    if (dot) {
      if (outline) {
        c.fillStyle = '#000';
        c.fillRect(-k - 1, -k - 1, k * 2 + 2, k * 2 + 2);
      }
      c.fillStyle = color;
      c.fillRect(-k, -k, k * 2, k * 2);
    }
    c.restore();
  },

  aimOffset() {
    const shape = SHAPES[this.o.shape];
    return this.o.headAim && shape && shape.head ? shape.head(this.o.size / 2) : 0;
  },

  // Renders what goes on screen at real size (1 canvas px = 1 screen px).
  render() {
    const o = this.o;
    const c = document.createElement('canvas');
    let ctx;

    if (o.source === 'crosshair') {
      const px = o.scale * realPx(); // 1× = the size it has in game
      c.width = c.height = (extent(S) * 2 + 2) * px + 2;
      ctx = c.getContext('2d');
      const mid = Math.floor(c.width / 2);
      drawCrosshair(ctx, mid, mid, S, px);
    } else if (o.source === 'image' && this.img) {
      const k = o.imgSize / Math.max(this.img.width, this.img.height);
      c.width = Math.max(1, Math.round(this.img.width * k));
      c.height = Math.max(1, Math.round(this.img.height * k));
      ctx = c.getContext('2d');
      ctx.drawImage(this.img, 0, 0, c.width, c.height);
    } else {
      const pad = o.thick + 4;
      const aimY = this.aimOffset();
      // odd size, so the aim point sits on a real centre pixel
      c.width = c.height = Math.ceil(o.size + Math.abs(aimY) * 2 + pad * 2) | 1;
      ctx = c.getContext('2d');
      const mid = c.width / 2;
      this.drawShape(ctx, mid, mid, o.shape, o.size, o.thick, o.color, o.outline, o.dot, aimY);
    }
    return c;
  },

  // The overlay window treats one colour as "transparent" and has no
  // per-pixel alpha, so every pixel ends up either fully on or fully off.
  // Crosshairs are pixel exact, so anything visible stays; shapes and images
  // have soft edges that get trimmed. Opacity is applied to the whole window.
  forScreen(c) {
    const cut = this.o.source === 'crosshair' ? 1 : 100;
    const ctx = c.getContext('2d');
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i + 3] = d[i + 3] < cut ? 0 : 255;
      if (d[i] === 1 && d[i + 1] === 2 && d[i + 2] === 3) d[i + 2] = 4; // never hit the key colour
    }
    ctx.putImageData(img, 0, 0);
    return c;
  },

  // -- page --------------------------------------------------------------

  init(saved, image) {
    Object.assign(this.o, OVERLAY_DEFAULTS, saved || {});
    if (image) this.o.image = image;
    if (this.o.image) this.loadImage(this.o.image);

    const grid = $('ov-shapes');
    grid.innerHTML = Object.entries(SHAPES).map(([key, s]) =>
      `<button data-shape="${key}" title="${s.name}"><canvas></canvas><span>${s.name}</span></button>`).join('');
    grid.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      this.set({ shape: b.dataset.shape, source: 'shape' });
    }));

    $('ov-colors').innerHTML = OVERLAY_COLORS.map((hex) =>
      `<button data-hex="${hex}" style="background:${hex}"></button>`).join('') +
      '<label title="Custom color"><input type="color" id="ov-custom"></label>';
    $('ov-colors').querySelectorAll('button').forEach((b) =>
      b.addEventListener('click', () => this.set({ color: b.dataset.hex })));
    $('ov-custom').addEventListener('input', (e) => this.set({ color: e.target.value }));

    $('ov-source').querySelectorAll('button').forEach((b) =>
      b.addEventListener('click', () => this.set({ source: b.dataset.src })));

    document.querySelectorAll('#page-overlay input[type=range]').forEach((input) => {
      input.addEventListener('input', () => this.set({ [input.dataset.ov]: Number(input.value) }));
    });
    document.querySelectorAll('#page-overlay [data-ovcheck]').forEach((el) => {
      el.addEventListener('click', () => {
        const key = el.dataset.ovcheck;
        const patch = { [key]: !this.o[key] };
        if (key === 'headAim' && patch.headAim && this.o.dy) {
          patch.dy = 0; // the head is now the centre, an old manual nudge would double it
          toast('Head is now the aim point · vertical offset reset');
        }
        this.set(patch);
      });
    });

    // drop an image anywhere on the page
    const page = $('page-overlay');
    page.addEventListener('dragover', (e) => { e.preventDefault(); page.classList.add('dropping'); });
    page.addEventListener('dragleave', (e) => { if (e.target === page || !page.contains(e.relatedTarget)) page.classList.remove('dropping'); });
    page.addEventListener('drop', (e) => {
      e.preventDefault();
      page.classList.remove('dropping');
      const file = [...(e.dataTransfer.files || [])].find((f) => f.type.startsWith('image/'));
      if (!file) return toast('Drop an image file');
      if (file.size > 4e6) return toast('That image is over 4 MB.');
      const reader = new FileReader();
      reader.onload = () => {
        this.loadImage(reader.result);
        this.setImage(reader.result, file.name);
      };
      reader.readAsDataURL(file);
    });

    $('ov-toggle').addEventListener('click', () => this.toggle());
    $('ov-image').addEventListener('click', () => this.pickImage());
    $('ov-center').addEventListener('click', () => this.set({ dx: 0, dy: 0 }));
    $('ov-quit').addEventListener('click', () => {
      if (inApp()) backend('quit');
      else toast('Only available in the desktop app');
    });

    new ResizeObserver(() => this.queuePreview()).observe($('ov-stage'));
    this.ready = true;
    this.sync();
  },

  set(patch) {
    const recolor = 'color' in patch && patch.color !== this.o.color;
    Object.assign(this.o, patch);
    if (recolor) this.tilesDirty = true;
    this.sync();
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.save(), 600);
  },

  // The picked image is kept apart from the other settings so a slider
  // move doesn't push megabytes through the bridge every time.
  save() {
    const { image, ...rest } = this.o;
    backend('set_pref', 'overlay', rest);
  },

  visible() {
    return $('page-overlay').classList.contains('on');
  },

  // the editor crosshair changed
  crosshairChanged() {
    if (!this.ready || this.o.source !== 'crosshair') return;
    if (this.on) this.queueSend();
    if (this.visible()) this.queuePreview();
  },

  sync() {
    if (!this.ready) return;
    const o = this.o;
    $('ov-source').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.src === o.source));
    document.querySelectorAll('#page-overlay [data-for]').forEach((el) => {
      el.hidden = !el.dataset.for.split(' ').includes(o.source);
    });
    document.querySelectorAll('#page-overlay [data-shape-only]').forEach((el) => {
      el.hidden = el.dataset.shapeOnly !== o.shape;
    });
    $('ov-shapes').querySelectorAll('button').forEach((b) =>
      b.classList.toggle('on', o.source === 'shape' && b.dataset.shape === o.shape));
    if (this.visible()) this.drawTiles();

    $('ov-colors').querySelectorAll('button').forEach((b) =>
      b.classList.toggle('on', b.dataset.hex.toLowerCase() === o.color.toLowerCase()));
    $('ov-custom').value = o.color;

    document.querySelectorAll('#page-overlay input[type=range]').forEach((input) => {
      const v = o[input.dataset.ov];
      input.value = v;
      input.style.setProperty('--p', ((v - input.min) / (input.max - input.min)) * 100 + '%');
      const label = input.dataset.ov === 'opacity' ? Math.round(v * 100) + '%'
        : input.dataset.ov === 'scale' ? v + '×'
        : input.dataset.ov === 'dx' || input.dataset.ov === 'dy' ? (v > 0 ? '+' : '') + v + ' px'
        : v + ' px';
      document.querySelectorAll(`[data-ovout="${input.dataset.ov}"]`).forEach((out) => { out.textContent = label; });
    });
    document.querySelectorAll('#page-overlay [data-ovcheck]').forEach((el) =>
      el.querySelector('.switch').classList.toggle('on', Boolean(o[el.dataset.ovcheck])));

    $('ov-image-name').textContent = o.imageName || 'PNG with a transparent background works best';

    $('ov-toggle').classList.toggle('on', this.on);
    $('ov-state').textContent = this.on ? 'On screen' : 'Off';
    document.querySelector('.nav [data-page="overlay"]').classList.toggle('live', this.on);

    if (this.visible()) this.queuePreview();
    if (this.on) this.queueSend();
  },

  // shape buttons only need repainting when the color or their size changes
  drawTiles() {
    $('ov-shapes').querySelectorAll('button').forEach((b) => {
      const c = b.querySelector('canvas');
      const w = Math.round(c.clientWidth * dpr());
      const h = Math.round(c.clientHeight * dpr());
      if (!w || !h) return;
      if (!this.tilesDirty && c.width === w && c.height === h) return;
      c.width = w;
      c.height = h;
      this.drawShape(c.getContext('2d'), w / 2, h / 2, b.dataset.shape, h * 0.62, 1.6 * dpr(), this.o.color, false, false);
    });
    this.tilesDirty = false;
  },

  // coalesce bursts of slider events into one paint per frame
  queuePreview() {
    if (this.previewQueued) return;
    this.previewQueued = true;
    requestAnimationFrame(() => {
      this.previewQueued = false;
      this.preview();
    });
  },

  preview() {
    if (!this.ready || !this.visible()) return;
    const c = $('ov-view');
    const box = $('ov-stage').getBoundingClientRect();
    if (!box.width) return;
    const w = Math.round(box.width * dpr());
    const h = Math.round(box.height * dpr());
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    // real size: the canvas is in device pixels, same as the overlay window
    const shot = this.forScreen(this.render());
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = this.o.opacity;
    ctx.drawImage(shot, Math.floor(w / 2) - Math.floor(shot.width / 2) + this.o.dx,
      Math.floor(h / 2) - Math.floor(shot.height / 2) + this.o.dy);
    ctx.globalAlpha = 1;
  },

  // -- talking to the overlay window --------------------------------------

  queueSend() {
    clearTimeout(this.sendTimer);
    this.sendTimer = setTimeout(() => this.send(), 90);
  },

  async send() {
    if (!this.on) return;
    const png = this.forScreen(this.render()).toDataURL('image/png').split(',')[1];
    const res = await backend('overlay_show', png, this.o.opacity, this.o.dx, this.o.dy, this.o.hideAds);
    if (!res || !res.ok) {
      this.on = false;
      this.sync();
      toast((res && res.error) || 'The overlay needs the desktop app');
    }
  },

  async toggle() {
    if (!inApp()) {
      toast('The overlay only works in the desktop app');
      return;
    }
    if (this.o.source === 'image' && !this.img) {
      toast('Pick an image first');
      return;
    }
    this.on = !this.on;
    if (this.on) {
      await this.send();
      if (this.on) toast('Overlay on · Ctrl+Shift+H hides it');
    } else {
      await backend('overlay_hide');
    }
    this.sync();
  },

  setImage(url, name) {
    backend('set_pref', 'overlayImage', url);
    this.set({ source: 'image', image: url, imageName: name });
  },

  loadImage(url) {
    const img = new Image();
    img.onload = () => { this.img = img; this.sync(); };
    img.src = url;
  },

  async pickImage() {
    if (!inApp()) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = () => {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          this.loadImage(reader.result);
          this.setImage(reader.result, file.name);
        };
        reader.readAsDataURL(file);
      };
      input.click();
      return;
    }
    const res = await backend('pick_image');
    if (!res) return;
    if (res.error) {
      toast(res.error);
      return;
    }
    this.loadImage(res.url);
    this.setImage(res.url, res.name);
  },
};
