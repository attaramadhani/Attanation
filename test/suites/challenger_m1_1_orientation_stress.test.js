/**
 * test/suites/challenger_m1_1_orientation_stress.test.js
 * Adversarial empirical test harness for Milestone 1 Orientation Normalization
 *
 * Designed and executed by Challenger M1-1
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const PWA_DIR = path.resolve(__dirname, '../../pwa-docstudio-pro');
const dbCode = fs.readFileSync(path.join(PWA_DIR, 'js', 'db.js'), 'utf8');

const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;

// Extract functions under test from db.js
const matchParse = dbCode.match(/_parseExifOrientation\(buffer\)\s*\{([\s\S]*?)\n  \},/);
if (!matchParse) throw new Error('Could not find _parseExifOrientation in db.js');
const _parseExifOrientation = new Function('buffer', matchParse[1]);

const matchGet = dbCode.match(/async getExifOrientation\(fileOrBlob\)\s*\{([\s\S]*?)\n  \},/);
if (!matchGet) throw new Error('Could not find getExifOrientation in db.js');
const getExifOrientation = new AsyncFunction('fileOrBlob', matchGet[1]);

const matchNorm = dbCode.match(/async normalizeImageOrientation\(fileOrBlob\)\s*\{([\s\S]*?)\n  \},/);
if (!matchNorm) throw new Error('Could not find normalizeImageOrientation in db.js');
const normalizeImageOrientation = new AsyncFunction('fileOrBlob', matchNorm[1]);

const matchLoad = dbCode.match(/async _loadImageFromSource\(source\)\s*\{([\s\S]*?)\n  \},/);
if (!matchLoad) throw new Error('Could not find _loadImageFromSource in db.js');
const _loadImageFromSource = new AsyncFunction('source', matchLoad[1]);

const AttaStorage = {
  _parseExifOrientation,
  getExifOrientation,
  normalizeImageOrientation,
  _loadImageFromSource
};

// Synthetic JPEG generator
function makeSyntheticJpeg({
  orientation = 1,
  littleEndian = true,
  app0Before = false,
  app2Before = false,
  xmpBefore = false,
  app1LengthOverride = null,
  exifMagic = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00],
  tiffEndian = null,
  tiffMagic = 42,
  ifd0Offset = 8,
  numEntries = 1,
  tagId = 0x0112,
  tagValue = null,
  extraEntries = [],
  truncateAt = null,
  corruptedMarkerLength = null,
  insertSOS = false
} = {}) {
  const parts = [];

  // SOI
  parts.push(Buffer.from([0xFF, 0xD8]));

  // Optional APP0 (JFIF)
  if (app0Before) {
    const jfifPayload = Buffer.from('JFIF\0\1\1\0\0\1\0\1\0\0', 'binary');
    const app0 = Buffer.alloc(2 + 2 + jfifPayload.length);
    app0.writeUInt16BE(0xFFE0, 0);
    app0.writeUInt16BE(jfifPayload.length + 2, 2);
    jfifPayload.copy(app0, 4);
    parts.push(app0);
  }

  // Optional APP2 (e.g. ICC profile)
  if (app2Before) {
    const app2Payload = Buffer.from('ICC_PROFILE\0', 'binary');
    const app2 = Buffer.alloc(2 + 2 + app2Payload.length);
    app2.writeUInt16BE(0xFFE2, 0);
    app2.writeUInt16BE(app2Payload.length + 2, 2);
    app2Payload.copy(app2, 4);
    parts.push(app2);
  }

  // Optional XMP APP1 before EXIF APP1
  if (xmpBefore) {
    const xmpPayload = Buffer.from('http://ns.adobe.com/xap/1.0/\0<xmpmeta/>', 'binary');
    const xmpHdr = Buffer.alloc(4);
    xmpHdr.writeUInt16BE(0xFFE1, 0);
    xmpHdr.writeUInt16BE(xmpPayload.length + 2, 2);
    parts.push(xmpHdr);
    parts.push(xmpPayload);
  }

  // Corrupted marker
  if (corruptedMarkerLength !== null) {
    const cor = Buffer.alloc(4);
    cor.writeUInt16BE(0xFFE3, 0);
    cor.writeUInt16BE(corruptedMarkerLength, 2);
    parts.push(cor);
  }

  // Premature SOS
  if (insertSOS) {
    parts.push(Buffer.from([0xFF, 0xDA, 0x00, 0x02]));
  }

  // APP1 EXIF payload
  const tiffBuf = Buffer.alloc(512);
  let p = 0;

  const endianBytes = tiffEndian !== null ? tiffEndian : (littleEndian ? 0x4949 : 0x4D4D);
  tiffBuf.writeUInt16BE(endianBytes, p); p += 2;

  if (littleEndian) {
    tiffBuf.writeUInt16LE(tiffMagic, p);
  } else {
    tiffBuf.writeUInt16BE(tiffMagic, p);
  }
  p += 2;

  if (littleEndian) {
    tiffBuf.writeUInt32LE(ifd0Offset, p);
  } else {
    tiffBuf.writeUInt32BE(ifd0Offset, p);
  }
  p += 4;

  if (ifd0Offset === p) {
    const totalEntries = numEntries;
    if (littleEndian) {
      tiffBuf.writeUInt16LE(totalEntries, p);
    } else {
      tiffBuf.writeUInt16BE(totalEntries, p);
    }
    p += 2;

    for (const ent of extraEntries) {
      if (littleEndian) {
        tiffBuf.writeUInt16LE(ent.tag, p);
        tiffBuf.writeUInt16LE(ent.type || 3, p + 2);
        tiffBuf.writeUInt32LE(ent.count || 1, p + 4);
        tiffBuf.writeUInt16LE(ent.val, p + 8);
        tiffBuf.writeUInt16LE(0, p + 10);
      } else {
        tiffBuf.writeUInt16BE(ent.tag, p);
        tiffBuf.writeUInt16BE(ent.type || 3, p + 2);
        tiffBuf.writeUInt32BE(ent.count || 1, p + 4);
        tiffBuf.writeUInt16BE(ent.val, p + 8);
        tiffBuf.writeUInt16BE(0, p + 10);
      }
      p += 12;
    }

    const finalVal = tagValue !== null ? tagValue : orientation;
    if (littleEndian) {
      tiffBuf.writeUInt16LE(tagId, p);
      tiffBuf.writeUInt16LE(3, p + 2);
      tiffBuf.writeUInt32LE(1, p + 4);
      tiffBuf.writeUInt16LE(finalVal, p + 8);
      tiffBuf.writeUInt16LE(0, p + 10);
    } else {
      tiffBuf.writeUInt16BE(tagId, p);
      tiffBuf.writeUInt16BE(3, p + 2);
      tiffBuf.writeUInt32BE(1, p + 4);
      tiffBuf.writeUInt16BE(finalVal, p + 8);
      tiffBuf.writeUInt16BE(0, p + 10);
    }
    p += 12;
  }

  const app1Payload = Buffer.concat([
    Buffer.from(exifMagic),
    tiffBuf.slice(0, p)
  ]);

  const app1Len = app1LengthOverride !== null ? app1LengthOverride : app1Payload.length + 2;
  const app1Header = Buffer.alloc(4);
  app1Header.writeUInt16BE(0xFFE1, 0);
  app1Header.writeUInt16BE(app1Len, 2);

  parts.push(app1Header);
  parts.push(app1Payload);

  let finalBuffer = Buffer.concat(parts);
  if (truncateAt !== null) {
    finalBuffer = finalBuffer.slice(0, truncateAt);
  }
  return finalBuffer;
}

// Canvas transform simulation
function simulateCanvasTransform(orientation, rawW, rawH) {
  const isRotated90or270 = orientation === 5 || orientation === 6 || orientation === 7 || orientation === 8;
  const cw = isRotated90or270 ? rawH : rawW;
  const ch = isRotated90or270 ? rawW : rawH;

  let M = [1, 0, 0, 1, 0, 0];
  function multiply(a1, b1, c1, d1, e1, f1) {
    const a2 = M[0], b2 = M[1], c2 = M[2], d2 = M[3], e2 = M[4], f2 = M[5];
    M = [
      a2 * a1 + c2 * b1,
      b2 * a1 + d2 * b1,
      a2 * c1 + c2 * d1,
      b2 * c1 + d2 * d1,
      a2 * e1 + c2 * f1 + e2,
      b2 * e1 + d2 * f1 + f2
    ];
  }
  const ctx = {
    translate: (x, y) => multiply(1, 0, 0, 1, x, y),
    rotate: (rad) => {
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      multiply(cos, sin, -sin, cos, 0, 0);
    },
    scale: (sx, sy) => multiply(sx, 0, 0, sy, 0, 0)
  };

  switch (orientation) {
    case 2:
      ctx.translate(cw, 0);
      ctx.scale(-1, 1);
      break;
    case 3:
      ctx.translate(cw, ch);
      ctx.rotate(Math.PI);
      break;
    case 4:
      ctx.translate(0, ch);
      ctx.scale(1, -1);
      break;
    case 5:
      ctx.rotate(0.5 * Math.PI);
      ctx.scale(1, -1);
      break;
    case 6:
      ctx.translate(cw, 0);
      ctx.rotate(0.5 * Math.PI);
      break;
    case 7:
      ctx.rotate(-0.5 * Math.PI);
      ctx.translate(-ch, 0);
      ctx.scale(1, -1);
      break;
    case 8:
      ctx.translate(0, ch);
      ctx.rotate(-0.5 * Math.PI);
      break;
    default:
      break;
  }

  function transform(x, y) {
    return {
      x: Math.round(x * M[0] + y * M[2] + M[4]),
      y: Math.round(x * M[1] + y * M[3] + M[5])
    };
  }

  const corners = [
    transform(0, 0),
    transform(rawW, 0),
    transform(rawW, rawH),
    transform(0, rawH)
  ];

  const minX = Math.min(...corners.map(c => c.x));
  const maxX = Math.max(...corners.map(c => c.x));
  const minY = Math.min(...corners.map(c => c.y));
  const maxY = Math.max(...corners.map(c => c.y));

  return { cw, ch, corners, minX, maxX, minY, maxY };
}

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

async function runTest(name, fn) {
  totalTests++;
  try {
    const res = fn();
    if (res && typeof res.then === 'function') {
      await res;
    }
    passedTests++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    failedTests++;
    failures.push({ name, error: err.message });
    console.error(`  [FAIL] ${name}: ${err.message}`);
  }
}

async function main() {
  console.log('================================================================');
  console.log('CHALLENGER SUITE 1: _parseExifOrientation Stress Tests');
  console.log('================================================================');

  // 1. All 8 orientations in Little Endian
  for (let o = 1; o <= 8; o++) {
    await runTest(`Parse Little-Endian Orientation ${o}`, () => {
      const buf = makeSyntheticJpeg({ orientation: o, littleEndian: true });
      const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      const res = AttaStorage._parseExifOrientation(ab);
      assert.strictEqual(res, o, `Expected ${o}, got ${res}`);
    });
  }

  // 2. All 8 orientations in Big Endian
  for (let o = 1; o <= 8; o++) {
    await runTest(`Parse Big-Endian Orientation ${o}`, () => {
      const buf = makeSyntheticJpeg({ orientation: o, littleEndian: false });
      const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      const res = AttaStorage._parseExifOrientation(ab);
      assert.strictEqual(res, o, `Expected ${o}, got ${res}`);
    });
  }

  // 3. Out-of-range orientation values
  const invalidOrientations = [0, 9, 10, 255, 65535];
  for (const inv of invalidOrientations) {
    await runTest(`Reject out-of-range orientation ${inv} -> default 1`, () => {
      const buf = makeSyntheticJpeg({ orientation: 1, tagValue: inv, littleEndian: true });
      const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      const res = AttaStorage._parseExifOrientation(ab);
      assert.strictEqual(res, 1, `Expected fallback 1, got ${res}`);
    });
  }

  // 4. Non-JPEG inputs
  const nonJpegInputs = [
    { name: 'Null buffer', buf: null },
    { name: 'Undefined buffer', buf: undefined },
    { name: 'Zero-length ArrayBuffer', buf: new ArrayBuffer(0) },
    { name: '1-byte buffer', buf: Buffer.from([0xFF]).buffer },
    { name: '2-byte non-JPEG buffer', buf: Buffer.from([0x00, 0x00]).buffer },
    { name: '3-byte non-JPEG buffer', buf: Buffer.from([0x89, 0x50, 0x4E]).buffer },
    { name: 'PNG signature', buf: Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]).buffer },
    { name: 'WebP signature', buf: Buffer.from('RIFF....WEBPVP8 ', 'binary').buffer },
    { name: 'GIF signature', buf: Buffer.from('GIF89a.......', 'binary').buffer },
    { name: 'PDF signature', buf: Buffer.from('%PDF-1.4.....', 'binary').buffer },
    { name: 'Plain text', buf: Buffer.from('Hello, world!').buffer }
  ];
  for (const item of nonJpegInputs) {
    await runTest(`Non-JPEG input: ${item.name} -> default 1`, () => {
      const res = AttaStorage._parseExifOrientation(item.buf);
      assert.strictEqual(res, 1, `Expected fallback 1, got ${res}`);
    });
  }

  // 5. Interleaved segments
  await runTest('Interleaved APP0 (JFIF) before APP1 (EXIF)', () => {
    const buf = makeSyntheticJpeg({ orientation: 6, app0Before: true });
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const res = AttaStorage._parseExifOrientation(ab);
    assert.strictEqual(res, 6, `Expected orientation 6, got ${res}`);
  });

  await runTest('Interleaved APP0 + APP2 before APP1 (EXIF)', () => {
    const buf = makeSyntheticJpeg({ orientation: 5, app0Before: true, app2Before: true });
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const res = AttaStorage._parseExifOrientation(ab);
    assert.strictEqual(res, 5, `Expected orientation 5, got ${res}`);
  });

  await runTest('Interleaved XMP APP1 before EXIF APP1', () => {
    const buf = makeSyntheticJpeg({ orientation: 7, xmpBefore: true });
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const res = AttaStorage._parseExifOrientation(ab);
    assert.strictEqual(res, 7, `Expected orientation 7, got ${res}`);
  });

  // 6. IFD with multiple tags
  await runTest('IFD0 with multiple tags (0x0100, 0x0101, then 0x0112)', () => {
    const buf = makeSyntheticJpeg({
      orientation: 8,
      numEntries: 3,
      extraEntries: [
        { tag: 0x0100, val: 1920 },
        { tag: 0x0101, val: 1080 }
      ]
    });
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const res = AttaStorage._parseExifOrientation(ab);
    assert.strictEqual(res, 8, `Expected orientation 8, got ${res}`);
  });

  await runTest('IFD0 without tag 0x0112 -> default 1', () => {
    const buf = makeSyntheticJpeg({
      orientation: 1,
      tagId: 0x0100,
      numEntries: 1
    });
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const res = AttaStorage._parseExifOrientation(ab);
    assert.strictEqual(res, 1, `Expected fallback 1, got ${res}`);
  });

  // 7. Corrupted & Adversarial Headers
  await runTest('Corrupted EXIF magic (not Exif\\0\\0)', () => {
    const buf = makeSyntheticJpeg({
      orientation: 3,
      exifMagic: [0x46, 0x61, 0x6B, 0x65, 0x00, 0x00]
    });
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const res = AttaStorage._parseExifOrientation(ab);
    assert.strictEqual(res, 1, `Expected fallback 1, got ${res}`);
  });

  await runTest('Corrupted TIFF endian word (neither II nor MM)', () => {
    const buf = makeSyntheticJpeg({
      orientation: 3,
      tiffEndian: 0x5858
    });
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const res = AttaStorage._parseExifOrientation(ab);
    assert.strictEqual(res, 1, `Expected fallback 1, got ${res}`);
  });

  await runTest('Corrupted TIFF magic (not 42)', () => {
    const buf = makeSyntheticJpeg({
      orientation: 3,
      tiffMagic: 99
    });
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const res = AttaStorage._parseExifOrientation(ab);
    assert.strictEqual(res, 1, `Expected fallback 1, got ${res}`);
  });

  await runTest('Corrupted IFD0 offset pointing out-of-bounds (0x0FFFFFFF)', () => {
    const buf = makeSyntheticJpeg({
      orientation: 3,
      ifd0Offset: 0x0FFFFFFF
    });
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const res = AttaStorage._parseExifOrientation(ab);
    assert.strictEqual(res, 1, `Expected fallback 1, got ${res}`);
  });

  await runTest('Corrupted IFD entry count (65535 entries exceeding buffer)', () => {
    const buf = makeSyntheticJpeg({
      orientation: 3,
      numEntries: 65535
    });
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const res = AttaStorage._parseExifOrientation(ab);
    assert.strictEqual(typeof res, 'number');
  });

  await runTest('Truncated buffer at SOI (2 bytes)', () => {
    const buf = Buffer.from([0xFF, 0xD8]);
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const res = AttaStorage._parseExifOrientation(ab);
    assert.strictEqual(res, 1);
  });

  await runTest('Truncated buffer mid-APP1 marker (3 bytes)', () => {
    const buf = Buffer.from([0xFF, 0xD8, 0xFF]);
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const res = AttaStorage._parseExifOrientation(ab);
    assert.strictEqual(res, 1);
  });

  await runTest('Truncated buffer at APP1 length field (4 bytes)', () => {
    const buf = Buffer.from([0xFF, 0xD8, 0xFF, 0xE1]);
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const res = AttaStorage._parseExifOrientation(ab);
    assert.strictEqual(res, 1);
  });

  await runTest('APP1 length claims 1000 bytes but buffer is 20 bytes', () => {
    const buf = makeSyntheticJpeg({ orientation: 3, app1LengthOverride: 1000, truncateAt: 20 });
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const res = AttaStorage._parseExifOrientation(ab);
    assert.strictEqual(res, 1);
  });

  await runTest('Corrupted non-APP1 segment length < 2 (prevents infinite loop)', () => {
    const buf = makeSyntheticJpeg({ orientation: 3, corruptedMarkerLength: 1 });
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const res = AttaStorage._parseExifOrientation(ab);
    assert.strictEqual(res, 1);
  });

  await runTest('Premature SOS marker (0xFFDA) terminates scan safely', () => {
    const buf = makeSyntheticJpeg({ orientation: 3, insertSOS: true });
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const res = AttaStorage._parseExifOrientation(ab);
    assert.strictEqual(res, 1);
  });

  console.log('\n================================================================');
  console.log('CHALLENGER SUITE 2: Canvas 2D Fallback Geometry');
  console.log('================================================================');

  const W = 800, H = 600;
  for (let o = 1; o <= 8; o++) {
    await runTest(`Canvas 2D Geometry Orientation ${o} bounding box coverage`, () => {
      const geo = simulateCanvasTransform(o, W, H);
      const inBounds = geo.minX === 0 && geo.minY === 0 && geo.maxX === geo.cw && geo.maxY === geo.ch;
      assert.ok(
        inBounds,
        `Orientation ${o} bounding box out of bounds! Canvas: [0..${geo.cw}, 0..${geo.ch}], Actual: [${geo.minX}..${geo.maxX}, ${geo.minY}..${geo.maxY}]`
      );
    });
  }

  console.log('\n================================================================');
  console.log('CHALLENGER SUITE 3: normalizeImageOrientation Contract Tests');
  console.log('================================================================');

  await runTest('normalizeImageOrientation passes non-Blob through untouched', async () => {
    const dummy = { foo: 'bar' };
    const res = await AttaStorage.normalizeImageOrientation.call(AttaStorage, dummy);
    assert.strictEqual(res, dummy);
  });

  await runTest('normalizeImageOrientation returns null for null input', async () => {
    const res = await AttaStorage.normalizeImageOrientation.call(AttaStorage, null);
    assert.strictEqual(res, null);
  });

  console.log('\n================================================================');
  console.log('CHALLENGER SUITE 4: _loadImageFromSource Hook Resilience Tests');
  console.log('================================================================');

  await runTest('_loadImageFromSource handles already-loaded HTMLImageElement', async () => {
    const mockImg = { tagName: 'IMG', complete: true, naturalWidth: 100, naturalHeight: 100 };
    const res = await AttaStorage._loadImageFromSource.call(AttaStorage, mockImg);
    assert.strictEqual(res, mockImg);
  });

  await runTest('_loadImageFromSource throws on null input instead of unhandled crash', async () => {
    let threw = false;
    try {
      await AttaStorage._loadImageFromSource.call(AttaStorage, null);
    } catch (err) {
      threw = true;
      assert.ok(err instanceof Error, 'Threw error on null source');
    }
    assert.ok(threw, 'Expected _loadImageFromSource to reject on null');
  });

  console.log('\n================================================================');
  console.log(`SUMMARY: Total=${totalTests}, Passed=${passedTests}, Failed=${failedTests}`);
  console.log('================================================================');

  if (failedTests > 0) {
    console.error('\nFAILURE DETAILS:');
    failures.forEach(f => console.error(` - ${f.name}: ${f.error}`));
    console.log('\nVERDICT: REJECT');
    process.exit(1);
  } else {
    console.log('\nALL EMPIRICAL CHALLENGER TESTS PASSED.');
    console.log('\nVERDICT: APPROVE');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal unhandled error in test suite:', err);
  process.exit(1);
});
