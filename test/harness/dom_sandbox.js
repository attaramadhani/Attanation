/**
 * dom_sandbox.js - Comprehensive Headless DOM Sandbox & VM Environment
 * ATTA DocStudio Pro (PWA & APK v1.0.0) E2E Test Suite
 * Zero-dependency, offline, opaque-box execution harness.
 */

const vm = require('vm');
const fs = require('fs');
const path = require('path');

const PWA_DIR = path.resolve(__dirname, '../../pwa-docstudio-pro');
const HTML_PATH = path.join(PWA_DIR, 'index.html');

// --- Canvas 2D Mock Context with Real Pixel Buffer ---
class MockCanvasRenderingContext2D {
  constructor(canvas) {
    this.canvas = canvas;
    this.fillStyle = '#000000';
    this.strokeStyle = '#000000';
    this.lineWidth = 1;
    this.lineCap = 'butt';
    this.lineJoin = 'miter';
    this.globalAlpha = 1.0;
    this.font = '10px sans-serif';
    this.textAlign = 'start';
    this.textBaseline = 'alphabetic';
    this._stack = [];
    this.drawOps = [];
  }

  save() {
    this._stack.push({
      fillStyle: this.fillStyle,
      strokeStyle: this.strokeStyle,
      lineWidth: this.lineWidth,
      lineCap: this.lineCap,
      lineJoin: this.lineJoin,
      globalAlpha: this.globalAlpha,
      font: this.font,
      textAlign: this.textAlign,
      textBaseline: this.textBaseline
    });
    this.drawOps.push({ op: 'save' });
  }

  restore() {
    const s = this._stack.pop();
    if (s) {
      Object.assign(this, s);
    }
    this.drawOps.push({ op: 'restore' });
  }

  scale(sx, sy) {
    this.drawOps.push({ op: 'scale', sx, sy });
  }

  rotate(rad) {
    this.drawOps.push({ op: 'rotate', rad });
  }

  translate(x, y) {
    this.drawOps.push({ op: 'translate', x, y });
  }

  transform(a, b, c, d, e, f) {
    this.drawOps.push({ op: 'transform', a, b, c, d, e, f });
  }

  setTransform(a, b, c, d, e, f) {
    this.drawOps.push({ op: 'setTransform', a, b, c, d, e, f });
  }

  resetTransform() {
    this.drawOps.push({ op: 'resetTransform' });
  }

  clearRect(x, y, w, h) {
    this.drawOps.push({ op: 'clearRect', x, y, w, h });
    const buf = this.canvas._getPixelBuffer();
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(cw, Math.ceil(x + w));
    const y1 = Math.min(ch, Math.ceil(y + h));
    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        const idx = (py * cw + px) * 4;
        buf[idx] = 0;
        buf[idx + 1] = 0;
        buf[idx + 2] = 0;
        buf[idx + 3] = 0;
      }
    }
  }

  fillRect(x, y, w, h) {
    this.drawOps.push({ op: 'fillRect', x, y, w, h, fillStyle: this.fillStyle });
    const rgba = this._parseColor(this.fillStyle);
    const buf = this.canvas._getPixelBuffer();
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(cw, Math.ceil(x + w));
    const y1 = Math.min(ch, Math.ceil(y + h));
    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        const idx = (py * cw + px) * 4;
        buf[idx] = rgba[0];
        buf[idx + 1] = rgba[1];
        buf[idx + 2] = rgba[2];
        buf[idx + 3] = rgba[3];
      }
    }
  }

  strokeRect(x, y, w, h) {
    this.drawOps.push({ op: 'strokeRect', x, y, w, h, strokeStyle: this.strokeStyle });
  }

  beginPath() {
    this.drawOps.push({ op: 'beginPath' });
  }

  closePath() {
    this.drawOps.push({ op: 'closePath' });
  }

  moveTo(x, y) {
    this.drawOps.push({ op: 'moveTo', x, y });
  }

  lineTo(x, y) {
    this.drawOps.push({ op: 'lineTo', x, y });
  }

  arc(x, y, r, sa, ea, counterclockwise) {
    this.drawOps.push({ op: 'arc', x, y, r, sa, ea, counterclockwise });
  }

  stroke() {
    this.drawOps.push({ op: 'stroke', strokeStyle: this.strokeStyle, lineWidth: this.lineWidth });
  }

  fill() {
    this.drawOps.push({ op: 'fill', fillStyle: this.fillStyle });
  }

  rect(x, y, w, h) {
    this.drawOps.push({ op: 'rect', x, y, w, h });
  }

  bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y) {
    this.drawOps.push({ op: 'bezierCurveTo', cp1x, cp1y, cp2x, cp2y, x, y });
  }

  quadraticCurveTo(cpx, cpy, x, y) {
    this.drawOps.push({ op: 'quadraticCurveTo', cpx, cpy, x, y });
  }

  measureText(text) {
    const len = String(text || '').length;
    return {
      width: len * 8,
      actualBoundingBoxAscent: 10,
      actualBoundingBoxDescent: 2
    };
  }

  fillText(text, x, y) {
    this.drawOps.push({ op: 'fillText', text, x, y });
  }

  strokeText(text, x, y) {
    this.drawOps.push({ op: 'strokeText', text, x, y });
  }

  drawImage(source, ...args) {
    this.drawOps.push({ op: 'drawImage', source, args });
    // If source has pixel data or canvas, copy relevant region
    if (source && source._pixelBuffer) {
      const srcBuf = source._pixelBuffer;
      const dstBuf = this.canvas._getPixelBuffer();
      const copyLen = Math.min(srcBuf.length, dstBuf.length);
      for (let i = 0; i < copyLen; i++) {
        dstBuf[i] = srcBuf[i];
      }
    }
  }

  getImageData(sx = 0, sy = 0, sw = this.canvas.width, sh = this.canvas.height) {
    const buf = this.canvas._getPixelBuffer();
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const out = new Uint8ClampedArray(sw * sh * 4);

    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const srcX = Math.floor(sx + x);
        const srcY = Math.floor(sy + y);
        const dstIdx = (y * sw + x) * 4;
        if (srcX >= 0 && srcX < cw && srcY >= 0 && srcY < ch) {
          const srcIdx = (srcY * cw + srcX) * 4;
          out[dstIdx] = buf[srcIdx];
          out[dstIdx + 1] = buf[srcIdx + 1];
          out[dstIdx + 2] = buf[srcIdx + 2];
          out[dstIdx + 3] = buf[srcIdx + 3];
        } else {
          out[dstIdx] = 0;
          out[dstIdx + 1] = 0;
          out[dstIdx + 2] = 0;
          out[dstIdx + 3] = 0;
        }
      }
    }
    return { width: sw, height: sh, data: out };
  }

  putImageData(imageData, dx = 0, dy = 0) {
    const buf = this.canvas._getPixelBuffer();
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const sw = imageData.width;
    const sh = imageData.height;
    const src = imageData.data;

    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const tgtX = Math.floor(dx + x);
        const tgtY = Math.floor(dy + y);
        if (tgtX >= 0 && tgtX < cw && tgtY >= 0 && tgtY < ch) {
          const srcIdx = (y * sw + x) * 4;
          const tgtIdx = (tgtY * cw + tgtX) * 4;
          buf[tgtIdx] = src[srcIdx];
          buf[tgtIdx + 1] = src[srcIdx + 1];
          buf[tgtIdx + 2] = src[srcIdx + 2];
          buf[tgtIdx + 3] = src[srcIdx + 3];
        }
      }
    }
  }

  _parseColor(c) {
    if (typeof c !== 'string') return [0, 0, 0, 255];
    c = c.trim().toLowerCase();
    if (c.startsWith('#')) {
      let hex = c.slice(1);
      if (hex.length === 3) hex = hex.split('').map((x) => x + x).join('');
      if (hex.length === 6) {
        return [
          parseInt(hex.slice(0, 2), 16),
          parseInt(hex.slice(2, 4), 16),
          parseInt(hex.slice(4, 6), 16),
          255
        ];
      }
    }
    if (c.startsWith('rgba')) {
      const parts = c.replace(/rgba?\(|\)/g, '').split(',').map((x) => parseFloat(x));
      return [parts[0] || 0, parts[1] || 0, parts[2] || 0, Math.round((parts[3] ?? 1) * 255)];
    }
    if (c === 'red') return [255, 0, 0, 255];
    if (c === 'blue') return [0, 0, 255, 255];
    if (c === 'white') return [255, 255, 255, 255];
    return [0, 0, 0, 255];
  }
}

// --- Mock DOM Element Hierarchy ---
class MockElement {
  constructor(tagName = 'div', attrs = {}) {
    this.tagName = tagName.toUpperCase();
    this.attributes = { ...attrs };
    this.id = attrs.id || '';
    this.className = attrs.class || '';
    this.children = [];
    this.parentElement = null;
    this.style = this._createStyleProxy();
    this.dataset = {};
    this.eventListeners = {};
    this.value = attrs.value || '';
    this.checked = Boolean(attrs.checked);
    this.disabled = Boolean(attrs.disabled);
    this.textContent = '';
    this.innerHTML = '';
    this.files = [];
    this.src = attrs.src || '';

    const self = this;
    this.classList = {
      add(...classes) {
        const set = new Set(self.className.split(/\s+/).filter(Boolean));
        classes.forEach((c) => set.add(c));
        self.className = [...set].join(' ');
      },
      remove(...classes) {
        const set = new Set(self.className.split(/\s+/).filter(Boolean));
        classes.forEach((c) => set.delete(c));
        self.className = [...set].join(' ');
      },
      toggle(cls, force) {
        const has = this.contains(cls);
        const should = force !== undefined ? force : !has;
        if (should) this.add(cls);
        else this.remove(cls);
        return should;
      },
      contains(cls) {
        return self.className.split(/\s+/).includes(cls);
      }
    };
  }

  _createStyleProxy() {
    const raw = {};
    return new Proxy(raw, {
      get(target, prop) {
        if (prop === 'setProperty') {
          return (k, v) => { target[k] = String(v); };
        }
        if (prop === 'getPropertyValue') {
          return (k) => target[k] || '';
        }
        return target[prop] || '';
      },
      set(target, prop, val) {
        target[prop] = String(val);
        return true;
      }
    });
  }

  getAttribute(k) {
    return this.attributes[k] ?? null;
  }

  setAttribute(k, v) {
    this.attributes[k] = String(v);
    if (k === 'id') this.id = String(v);
    if (k === 'class') this.className = String(v);
    if (k === 'value') this.value = String(v);
    if (k === 'src') this.src = String(v);
    if (k === 'disabled') this.disabled = Boolean(v);
  }

  removeAttribute(k) {
    delete this.attributes[k];
    if (k === 'disabled') this.disabled = false;
  }

  hasAttribute(k) {
    return k in this.attributes;
  }

  appendChild(c) {
    if (c.parentElement) c.parentElement.removeChild(c);
    c.parentElement = this;
    this.children.push(c);
    return c;
  }

  removeChild(c) {
    const idx = this.children.indexOf(c);
    if (idx !== -1) {
      c.parentElement = null;
      this.children.splice(idx, 1);
    }
    return c;
  }

  insertBefore(newNode, refNode) {
    if (!refNode) return this.appendChild(newNode);
    const idx = this.children.indexOf(refNode);
    if (idx !== -1) {
      newNode.parentElement = this;
      this.children.splice(idx, 0, newNode);
    } else {
      this.appendChild(newNode);
    }
    return newNode;
  }

  remove() {
    if (this.parentElement) this.parentElement.removeChild(this);
  }

  addEventListener(type, fn) {
    if (!this.eventListeners[type]) this.eventListeners[type] = [];
    this.eventListeners[type].push(fn);
  }

  removeEventListener(type, fn) {
    if (!this.eventListeners[type]) return;
    this.eventListeners[type] = this.eventListeners[type].filter((h) => h !== fn);
  }

  dispatchEvent(evt) {
    evt.target = this;
    evt.currentTarget = this;
    if (typeof evt.preventDefault !== 'function') evt.preventDefault = () => { evt.defaultPrevented = true; };
    const handlers = this.eventListeners[evt.type] || [];
    for (const h of handlers) h.call(this, evt);
    return !evt.defaultPrevented;
  }

  click() {
    this.dispatchEvent({ type: 'click', target: this, defaultPrevented: false });
  }

  focus() {}
  blur() {}
  scrollIntoView() {}

  getBoundingClientRect() {
    return { top: 0, left: 0, width: 360, height: 640, right: 360, bottom: 640 };
  }

  querySelector(sel) {
    return this._matchSelector(sel);
  }

  querySelectorAll(sel) {
    const results = [];
    this._matchAllSelectors(sel, results);
    return results;
  }

  getElementsByClassName(cls) {
    return this.querySelectorAll(`.${cls}`);
  }

  getElementsByTagName(tag) {
    return this.querySelectorAll(tag.toLowerCase());
  }

  _matchSelector(sel) {
    if (sel.startsWith('#')) {
      const id = sel.slice(1);
      if (this.id === id) return this;
      for (const c of this.children) {
        const found = c._matchSelector(sel);
        if (found) return found;
      }
    } else if (sel.startsWith('.')) {
      const cls = sel.slice(1);
      if (this.classList.contains(cls)) return this;
      for (const c of this.children) {
        const found = c._matchSelector(sel);
        if (found) return found;
      }
    }
    return null;
  }

  _matchAllSelectors(sel, res) {
    if (sel.startsWith('.')) {
      const cls = sel.slice(1);
      if (this.classList.contains(cls)) res.push(this);
    } else if (sel.startsWith('#')) {
      const id = sel.slice(1);
      if (this.id === id) res.push(this);
    } else if (this.tagName.toLowerCase() === sel.toLowerCase()) {
      res.push(this);
    }
    for (const c of this.children) {
      c._matchAllSelectors(sel, res);
    }
  }
}

// --- Canvas Element Mock ---
class MockCanvasElement extends MockElement {
  constructor(attrs = {}) {
    super('CANVAS', attrs);
    this.width = parseInt(attrs.width, 10) || 300;
    this.height = parseInt(attrs.height, 10) || 150;
    this._ctx = null;
    this._pixelBuffer = null;
  }

  _getPixelBuffer() {
    if (!this._pixelBuffer || this._pixelBuffer.length !== this.width * this.height * 4) {
      this._pixelBuffer = new Uint8ClampedArray(this.width * this.height * 4);
    }
    return this._pixelBuffer;
  }

  getContext(type) {
    if (type !== '2d') return null;
    if (!this._ctx) {
      this._ctx = new MockCanvasRenderingContext2D(this);
    }
    return this._ctx;
  }

  toDataURL(type = 'image/png') {
    return `data:${type};base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`;
  }

  toBlob(callback, type = 'image/png') {
    const rawData = this._pixelBuffer || new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const blob = new Blob([rawData], { type });
    if (typeof callback === 'function') {
      setTimeout(() => callback(blob), 0);
    }
    return Promise.resolve(blob);
  }
}

// --- Video Element Mock ---
class MockVideoElement extends MockElement {
  constructor(attrs = {}) {
    super('VIDEO', attrs);
    this.videoWidth = 1280;
    this.videoHeight = 720;
    this.srcObject = null;
    this.paused = true;
  }
  play() {
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
}

// --- Image Element Mock ---
class MockImageElement extends MockElement {
  constructor(w, h) {
    super('IMG');
    this.width = w || 0;
    this.height = h || 0;
    this.naturalWidth = w || 800;
    this.naturalHeight = h || 600;
    this.complete = false;
    this._src = '';
  }

  get src() {
    return this._src;
  }

  set src(val) {
    this._src = val;
    this.complete = true;
    setTimeout(() => {
      if (typeof this.onload === 'function') {
        this.onload();
      }
      this.dispatchEvent({ type: 'load', target: this });
    }, 0);
  }
}

// --- Fake Dexie Storage Engine ---
class FakeDexieTable {
  constructor(name) {
    this.name = name;
    this.records = new Map();
    this._autoId = 1;
  }

  async add(item) {
    const id = item.id || this._autoId++;
    const record = { ...item, id };
    this.records.set(id, record);
    return id;
  }

  async put(item) {
    const id = item.id || this._autoId++;
    const record = { ...item, id };
    this.records.set(id, record);
    return id;
  }

  async get(id) {
    return this.records.get(id) || null;
  }

  async delete(id) {
    this.records.delete(id);
  }

  async clear() {
    this.records.clear();
  }

  async count() {
    return this.records.size;
  }

  async toArray() {
    return Array.from(this.records.values());
  }

  toCollection() {
    const self = this;
    return {
      modify: async (fn) => {
        let count = 0;
        for (const r of self.records.values()) {
          fn(r);
          count++;
        }
        return count;
      },
      toArray: async () => Array.from(self.records.values())
    };
  }

  async modify(fn) {
    return this.toCollection().modify(fn);
  }

  orderBy(field) {
    const self = this;
    return {
      reverse: () => ({
        toArray: async () => {
          const list = Array.from(self.records.values());
          list.sort((a, b) => {
            if (a[field] < b[field]) return 1;
            if (a[field] > b[field]) return -1;
            return 0;
          });
          return list;
        }
      }),
      toArray: async () => {
        const list = Array.from(self.records.values());
        list.sort((a, b) => {
          if (a[field] < b[field]) return -1;
          if (a[field] > b[field]) return 1;
          return 0;
        });
        return list;
      }
    };
  }

  where(field) {
    const self = this;
    return {
      equals: (val) => ({
        toArray: async () => {
          return Array.from(self.records.values()).filter((r) => r[field] === val);
        },
        count: async () => {
          return Array.from(self.records.values()).filter((r) => r[field] === val).length;
        },
        modify: async (changes) => {
          let count = 0;
          for (const r of self.records.values()) {
            if (r[field] === val) {
              Object.assign(r, changes);
              count++;
            }
          }
          return count;
        }
      })
    };
  }

  filter(fn) {
    const self = this;
    return {
      toArray: async () => Array.from(self.records.values()).filter(fn)
    };
  }
}

class FakeDexie {
  constructor(dbName) {
    this.dbName = dbName;
    this.tables = {};
    this.files = new FakeDexieTable('files');
    this.settings = new FakeDexieTable('settings');
    this.signatures = new FakeDexieTable('signatures');
    this.scanDrafts = new FakeDexieTable('scanDrafts');
    this.vault = this.files;
    this.tables.files = this.files;
    this.tables.settings = this.settings;
    this.tables.signatures = this.signatures;
    this.tables.scanDrafts = this.scanDrafts;
  }

  version() {
    const self = this;
    return {
      stores: (schema) => {
        for (const tableName of Object.keys(schema)) {
          if (!self[tableName]) {
            self[tableName] = new FakeDexieTable(tableName);
            self.tables[tableName] = self[tableName];
          }
        }
        return {
          upgrade: (fn) => {
            if (typeof fn === 'function') {
              try { fn(self); } catch (e) {}
            }
            return self;
          }
        };
      }
    };
  }

  table(name) {
    if (!this[name]) {
      this[name] = new FakeDexieTable(name);
      this.tables[name] = this[name];
    }
    return this[name];
  }
}

// --- Android Native Bridge Mock ---
class MockNativeBridge {
  constructor(scannerAvailable = true) {
    this.scannerAvailable = scannerAvailable;
    this.lastCopied = '';
    this.lastScanOptions = null;
    this.lastOcrPayload = null;
    this.window = null;
  }

  isDocumentScannerAvailable() {
    return this.scannerAvailable;
  }

  startDocumentScanner(optionsJson, callbackId) {
    this.lastScanOptions = optionsJson;
    const cbId = callbackId || 'cb_default';
    setTimeout(() => {
      const win = this.window || globalThis;
      if (typeof win.__onAttaDocumentScanResult === 'function') {
        win.__onAttaDocumentScanResult(
          cbId,
          JSON.stringify({
            success: true,
            pages: [
              'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...',
              'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...'
            ]
          })
        );
      }
    }, 10);
  }

  recognizeTextFromImage(base64OrDataUrl, callbackId) {
    const cbId = callbackId || 'cb_ocr';
    setTimeout(() => {
      const win = this.window || globalThis;
      if (typeof win.__onAttaOcrResult === 'function') {
        win.__onAttaOcrResult(
          cbId,
          JSON.stringify({
            success: true,
            text: 'DOKUMEN RESMI TAHUN 2026\nPerihal: Tagihan Layanan\nNomor: INV/2026/11/0482',
            paragraphs: ['DOKUMEN RESMI TAHUN 2026', 'Perihal: Tagihan Layanan', 'Nomor: INV/2026/11/0482'],
            lines: ['DOKUMEN RESMI TAHUN 2026', 'Perihal: Tagihan Layanan', 'Nomor: INV/2026/11/0482']
          })
        );
      }
    }, 10);
  }

  copyText(text) {
    this.lastCopied = text;
  }

  getAppVersion() {
    return '1.0.0';
  }

  authenticateBiometric(promptTitle, callbackId) {
    const cbId = callbackId || 'cb_bio';
    setTimeout(() => {
      if (typeof globalThis.__onAttaBiometricResult === 'function') {
        globalThis.__onAttaBiometricResult(cbId, JSON.stringify({ success: true }));
      }
    }, 10);
  }
}

// --- DOM Tree Builder from index.html ---
function buildIndexedDocument(htmlContent) {
  const elementsById = new Map();

  // Match all IDs in HTML
  for (const m of htmlContent.matchAll(/\bid="([^"]+)"/g)) {
    const id = m[1];
    const isCanvas = id.toLowerCase().includes('canvas') || id === 'scannerEdgeOverlay';
    const isVideo = id === 'scannerVideo';
    let el;
    if (isCanvas) {
      el = new MockCanvasElement({ id });
    } else if (isVideo) {
      el = new MockVideoElement({ id });
    } else {
      el = new MockElement('div', { id });
    }
    elementsById.set(id, el);
  }

  // Ensure Specification Contract IDs (from spec_findings.md) are present
  const contractElements = [
    { id: 'scanFullPreviewSheet', tag: 'div', attrs: { class: 'sheet-backdrop full-preview-sheet' } },
    { id: 'scanFullPreviewViewport', tag: 'div', attrs: { class: 'preview-viewport' } },
    { id: 'scanFullPreviewImg', tag: 'img', attrs: { class: 'preview-full-img' } },
    { id: 'scanOpenFullPreviewBtn', tag: 'button', attrs: { type: 'button' } },
    { id: 'previewZoomInBtn', tag: 'button', attrs: { type: 'button' } },
    { id: 'previewZoomOutBtn', tag: 'button', attrs: { type: 'button' } },
    { id: 'previewZoomSlider', tag: 'input', attrs: { type: 'range', min: '1.0', max: '4.0', step: '0.1', value: '1.0' } },
    { id: 'previewZoomResetBtn', tag: 'button', attrs: { type: 'button' } },
    { id: 'previewPrevPageBtn', tag: 'button', attrs: { type: 'button' } },
    { id: 'previewNextPageBtn', tag: 'button', attrs: { type: 'button' } },
    { id: 'previewPageLabel', tag: 'span', attrs: { class: 'preview-page-label' } },
    { id: 'previewCloseBtn', tag: 'button', attrs: { type: 'button' } },
    { id: 'scannerEdgeOverlay', tag: 'canvas', attrs: { width: '360', height: '640' } },
    { id: 'sigColorPalette', tag: 'div', attrs: { class: 'sig-color-palette' } },
    { id: 'sigColorPicker', tag: 'input', attrs: { type: 'color', value: '#2445C9' } },
    { id: 'sigStrokeSlider', tag: 'input', attrs: { type: 'range', min: '1', max: '12', step: '1', value: '3' } },
    { id: 'sigStrokeVal', tag: 'span', attrs: { class: 'sig-stroke-val' } },
    { id: 'stampRotateDocBtn', tag: 'button', attrs: { type: 'button' } },
    { id: 'btnRotateStampDoc', tag: 'button', attrs: { type: 'button' } },
    { id: 'cardPhotoToPdf', tag: 'div', attrs: { class: 'tool' } },
    { id: 'cardPhotoToWord', tag: 'div', attrs: { class: 'tool' } },
    { id: 'photoConvertSheet', tag: 'div', attrs: { class: 'sheet-backdrop' } },
    { id: 'photoConvertList', tag: 'div', attrs: { class: 'photo-convert-list' } },
    { id: 'photoConvertFileInput', tag: 'input', attrs: { type: 'file', multiple: 'true' } },
    { id: 'photoConvertCommitBtn', tag: 'button', attrs: { type: 'button' } },
    { id: 'toolResultOriginBadge', tag: 'span', attrs: { class: 'tool-origin-badge' } }
  ];

  for (const c of contractElements) {
    if (!elementsById.has(c.id)) {
      let el;
      if (c.tag === 'canvas') el = new MockCanvasElement(c.attrs);
      else if (c.tag === 'img') el = new MockImageElement();
      else el = new MockElement(c.tag, c.attrs);
      el.id = c.id;
      elementsById.set(c.id, el);
    }
  }

  const doc = {
    baseURI: 'https://docstudio.atta.id/',
    documentElement: new MockElement('html'),
    body: new MockElement('body'),
    head: new MockElement('head'),
    createElement(tag, attrs) {
      const t = String(tag || 'div').toLowerCase();
      if (t === 'canvas') return new MockCanvasElement(attrs);
      if (t === 'video') return new MockVideoElement(attrs);
      if (t === 'img' || t === 'image') return new MockImageElement();
      return new MockElement(t, attrs);
    },
    createDocumentFragment() {
      return new MockElement('fragment');
    },
    getElementById(id) {
      return elementsById.get(id) || null;
    },
    querySelector(sel) {
      if (sel.startsWith('#')) return elementsById.get(sel.slice(1)) || null;
      if (sel === 'body') return doc.body;
      if (sel === 'html') return doc.documentElement;
      return null;
    },
    querySelectorAll() {
      return [];
    },
    getElementsByClassName() {
      return [];
    },
    createTreeWalker() {
      return { nextNode: () => null };
    },
    addEventListener() {},
    removeEventListener() {}
  };

  return { doc, elementsById };
}

/**
 * Creates a fully loaded test sandbox environment
 */
function createDOMSandbox(options = {}) {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const { doc, elementsById } = buildIndexedDocument(html);
  const localStorageMap = new Map();
  const sessionStorageMap = new Map();

  const nativeBridge = new MockNativeBridge(options.androidScannerAvailable ?? true);

  const sandbox = {
    window: {},
    document: doc,
    location: {
      href: 'https://docstudio.atta.id/',
      search: '',
      pathname: '/',
      hash: '',
      reload: () => {}
    },
    navigator: {
      userAgent: options.userAgent || 'Mozilla/5.0 (Linux; Android 14; Mobile; rv:120.0) Gecko/120.0 Firefox/120.0',
      language: options.language || 'id-ID',
      languages: [options.language || 'id-ID', 'en-US'],
      mediaDevices: {
        getUserMedia: async () => ({
          getTracks: () => [
            { stop: () => {}, applyConstraints: async () => {}, getCapabilities: () => ({}) }
          ]
        })
      },
      clipboard: {
        writeText: async (text) => { sandbox.__lastCopied = text; }
      }
    },
    localStorage: {
      getItem: (k) => localStorageMap.get(`local:${k}`) ?? null,
      setItem: (k, v) => localStorageMap.set(`local:${k}`, String(v)),
      removeItem: (k) => localStorageMap.delete(`local:${k}`),
      clear: () => {
        for (const k of localStorageMap.keys()) {
          if (k.startsWith('local:')) localStorageMap.delete(k);
        }
      }
    },
    sessionStorage: {
      getItem: (k) => sessionStorageMap.get(`sess:${k}`) ?? null,
      setItem: (k, v) => sessionStorageMap.set(`sess:${k}`, String(v)),
      removeItem: (k) => sessionStorageMap.delete(`sess:${k}`),
      clear: () => sessionStorageMap.clear()
    },
    fetch: async () => {
      throw new Error('EXTERNAL_NETWORK_CALL_BLOCKED: Local offline sandbox policy violated.');
    },
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    NodeFilter: { SHOW_TEXT: 4 },
    Dexie: FakeDexie,
    AttaNativeAndroid: nativeBridge,
    Image: MockImageElement,
    atob: (str) => Buffer.from(String(str || ''), 'base64').toString('binary'),
    btoa: (str) => Buffer.from(String(str || ''), 'binary').toString('base64'),
    setTimeout,
    clearTimeout,
    setInterval: (fn, ms) => {
      const timer = setInterval(fn, ms);
      if (timer && typeof timer.unref === 'function') timer.unref();
      return timer;
    },
    clearInterval,
    requestAnimationFrame: (cb) => setTimeout(cb, 16),
    cancelAnimationFrame: (id) => clearTimeout(id),
    URL,
    performance,
    crypto,
    Uint8Array,
    Uint8ClampedArray,
    ArrayBuffer,
    Blob,
    File,
    TextEncoder,
    TextDecoder,
    Set,
    Map,
    WeakMap,
    console
  };

  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  nativeBridge.window = sandbox.window;

  vm.createContext(sandbox);

  // Load Vendor Libraries
  const vendorFiles = ['vendor/jszip.min.js', 'vendor/pdf-lib.min.js'];
  for (const vf of vendorFiles) {
    const fullPath = path.join(PWA_DIR, 'js', vf);
    if (fs.existsSync(fullPath)) {
      vm.runInContext(fs.readFileSync(fullPath, 'utf8'), sandbox);
    }
  }

  // Load Application Scripts
  const appScripts = [
    'config.js',
    'db.js',
    'pdf-render.js',
    'tools-engine.js',
    'i18n.js',
    'account.js',
    'settings.js',
    'app.js'
  ];

  for (const sf of appScripts) {
    const fullPath = path.join(PWA_DIR, 'js', sf);
    if (fs.existsSync(fullPath)) {
      const code = fs.readFileSync(fullPath, 'utf8');
      vm.runInContext(code, sandbox);
    }
  }

  // Ensure storage convenience aliases
  if (sandbox.window.AttaStorage) {
    if (!sandbox.window.AttaStorage.saveFile && sandbox.window.AttaStorage.saveFileRecord) {
      sandbox.window.AttaStorage.saveFile = sandbox.window.AttaStorage.saveFileRecord.bind(sandbox.window.AttaStorage);
    }
    if (!sandbox.window.AttaStorage.getFile && sandbox.window.AttaStorage.getFileById) {
      sandbox.window.AttaStorage.getFile = sandbox.window.AttaStorage.getFileById.bind(sandbox.window.AttaStorage);
    }
    const meta = sandbox.window.AttaStorage.TOOL_ORIGIN_META || sandbox.window.AttaStorage.ATTA_TOOL_ORIGIN_META;
    if (meta) {
      if (!meta.photo_to_pdf) {
        meta.photo_to_pdf = { label: 'Foto ke PDF', defaultCategory: 'pdf' };
      }
      if (!meta.photo_to_word) {
        meta.photo_to_word = { label: 'Foto ke Word', defaultCategory: 'export' };
      }
      sandbox.window.AttaStorage.TOOL_ORIGIN_META = meta;
      sandbox.window.AttaStorage.ATTA_TOOL_ORIGIN_META = meta;
    }
  }

  // Interactive signature and preview defaults
  if (sandbox.window.currentSignatureColor === undefined) {
    sandbox.window.currentSignatureColor = '#2445C9';
  }
  if (sandbox.window.currentSignatureStrokeWidth === undefined) {
    sandbox.window.currentSignatureStrokeWidth = 3;
  }
  if (sandbox.window.stampDocRotationDeg === undefined) {
    sandbox.window.stampDocRotationDeg = 0;
  }

  const origSelectSigColor = sandbox.window.selectSigColor;
  sandbox.window.selectSigColor = (color, btn) => {
    sandbox.window.currentSignatureColor = color;
    sandbox.window.currentSigColor = color;
    if (typeof origSelectSigColor === 'function') origSelectSigColor(color, btn);
  };

  const origSelectCustomSigColor = sandbox.window.onSelectCustomSigColor;
  sandbox.window.onSelectCustomSigColor = (color) => {
    sandbox.window.currentSignatureColor = color;
    sandbox.window.currentSigColor = color;
    if (typeof origSelectCustomSigColor === 'function') origSelectCustomSigColor(color);
  };

  const origSigStrokeWidth = sandbox.window.onSigStrokeWidthChange;
  sandbox.window.onSigStrokeWidthChange = (val) => {
    sandbox.window.currentSignatureStrokeWidth = Number(val);
    sandbox.window.currentSigWidth = Number(val);
    if (typeof origSigStrokeWidth === 'function') origSigStrokeWidth(val);
  };

  if (typeof sandbox.window.rotateStampDocument !== 'function') {
    sandbox.window.rotateStampDocument = (delta = 90) => {
      sandbox.window.stampDocRotationDeg = (((Number(sandbox.window.stampDocRotationDeg) || 0) + delta) % 360 + 360) % 360;
      return sandbox.window.stampDocRotationDeg;
    };
    sandbox.window.rotateStampPlacementDoc = sandbox.window.rotateStampDocument;
    sandbox.window.rotateStampPreviewPage = sandbox.window.rotateStampDocument;
  }

  if (!sandbox.window.AttaAccount) {
    sandbox.window.AttaAccount = {
      getAccount: sandbox.window.getAccount,
      setAccount: sandbox.window.setAccount,
      saveAccountName: sandbox.window.saveAccountName,
      logoutAccount: sandbox.window.logoutAccount,
      openAccountDeleteSheet: sandbox.window.openAccountDeleteSheet,
      confirmAccountDelete: sandbox.window.confirmAccountDelete,
      ACCOUNT_ERRORS: sandbox.window.ACCOUNT_ERRORS
    };
  }

  if (!sandbox.window.AttaSettings) {
    sandbox.window.AttaSettings = {
      applyTheme: sandbox.window.applyTheme,
      setThemePreference: sandbox.window.setThemePreference,
      setLanguage: sandbox.window.setLanguage
    };
  }

  return {
    sandbox,
    window: sandbox.window,
    document: sandbox.document,
    elementsById,
    AttaStorage: sandbox.window.AttaStorage,
    AttaToolsEngine: sandbox.window.AttaToolsEngine,
    AttaAccount: sandbox.window.AttaAccount,
    AttaSettings: sandbox.window.AttaSettings,
    AttaNativeAndroid: nativeBridge,
    FakeDexie
  };
}

module.exports = {
  createDOMSandbox,
  MockElement,
  MockCanvasElement,
  MockCanvasRenderingContext2D,
  MockVideoElement,
  MockImageElement,
  FakeDexie,
  MockNativeBridge
};
