/**
 * ATTA DocStudio Pro — Mesin Lengkap Fitur Scanner & PDF (Offline-First)
 * Produk dari ATTA NATION
 *
 * Mengintegrasikan seluruh fitur dari repositori GitHub:
 * 1. smart_scanner_app (atta-smartscanner-pro):
 *    - Homography 4-Corner Perspective Warp & Auto Edge Detection
 *    - Stitch Kartu ID / KTP Depan & Belakang ke 1 Lembar A4
 *    - Rotasi Gambar 90/180/270 Derajat
 *    - Analisis Heuristik Offline (Deteksi KTP/Kwitansi/Surat, Ekstrak NIK, Email, No HP, Tanggal, Rupiah)
 * 2. PDF_New (atta-pdf-studio-pro):
 *    - Pisahkan PDF (Split per rentang halaman)
 *    - Hapus Halaman PDF (Remove pages)
 *    - Susun & Putar Halaman PDF (Organize & Rotate pages)
 *    - Nomor Halaman Otomatis (Header / Footer)
 *    - Potong Margin PDF (Crop PDF margins)
 *    - Bubuhkan Tanda Tangan langsung ke Halaman PDF (Stamp e-Sign)
 *    - Konversi Word (.docx), Excel (.xlsx), CSV (.csv), TXT (.txt) ke PDF A4 (via JSZip + XML parser)
 *    - Ekstrak Teks PDF & Konversi ke Word (.doc), Excel (.csv), Markdown (.md), Teks (.txt)
 *    - Samarkan Info Rahasia (Redact PDF)
 *    - Kunci Berkas dengan PIN & Perbaiki Struktur PDF (Repair PDF)
 *    - Bandingkan 2 Dokumen PDF (Compare PDF & Text Diff)
 *    - Ringkasan Eksekutif Lokal & Integrasi Gemini AI Opsional (Ringkas & Terjemahkan)
 */

const L = (id, en) => (typeof currentLang !== 'undefined' && currentLang === 'en' ? en : id);

const AttaToolsEngine = {
  /* ==========================================================================
   * A. PARSER RENTANG HALAMAN (Port dari PageRangeParser di PDF_New)
   * ========================================================================== */
  parsePageRanges(rangeStr, maxPages) {
    const raw = String(rangeStr || '').trim();
    if (!raw) {
      return [];
    }
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
    const ranges = [];

    for (const part of parts) {
      if (part.includes('-')) {
        const [startStr, endStr] = part.split('-').map((s) => s.trim());
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        if (isNaN(start) || isNaN(end) || start < 1 || end < start || start > maxPages) {
          continue;
        }
        const clampedEnd = Math.min(maxPages, end);
        const group = [];
        for (let p = start; p <= clampedEnd; p++) {
          group.push(p - 1);
        }
        if (group.length > 0) ranges.push(group);
      } else {
        const single = parseInt(part, 10);
        if (!isNaN(single) && single >= 1 && single <= maxPages) {
          ranges.push([single - 1]);
        }
      }
    }
    return ranges;
  },

  parseFlatPageIndices(rangeStr, maxPages) {
    const groups = this.parsePageRanges(rangeStr, maxPages);
    const flat = [];
    for (const g of groups) {
      for (const idx of g) {
        if (!flat.includes(idx)) flat.push(idx);
      }
    }
    return flat;
  },

  /* ==========================================================================
   * B. HOMOGRAPHY 4-TITIK & DETEKSI TEPI DOKUMEN (Port dari HomographyService)
   * ========================================================================== */
  detectDocumentCornersDetailed(sourceEl) {
    const defaultQuad = [
      { x: 0.08, y: 0.08 },
      { x: 0.92, y: 0.08 },
      { x: 0.92, y: 0.92 },
      { x: 0.08, y: 0.92 }
    ];
    try {
      const iw = sourceEl.videoWidth || sourceEl.naturalWidth || sourceEl.width || 1;
      const ih = sourceEl.videoHeight || sourceEl.naturalHeight || sourceEl.height || 1;
      if (iw < 16 || ih < 16) return { corners: defaultQuad, confidence: 0 };

      const w = Math.min(288, Math.max(64, Math.round(iw)));
      const h = Math.max(64, Math.round((ih / Math.max(1, iw)) * w));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return { corners: defaultQuad, confidence: 0 };
      ctx.drawImage(sourceEl, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h).data;
      canvas.width = canvas.height = 0;

      const total = w * h;
      const lum = new Float32Array(total);
      const chroma = new Float32Array(total);
      const dil = new Float32Array(total);
      const blur = new Float32Array(total);

      // 1) Luminance + Color Saturation extraction (adaptasi Lab L + HSV S dari HomographyService)
      const borderLums = [];
      const margin = Math.max(5, Math.round(Math.min(w, h) * 0.06));
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i4 = (y * w + x) * 4;
          const r = data[i4], g = data[i4 + 1], b = data[i4 + 2];
          const l = 0.299 * r + 0.587 * g + 0.114 * b;
          const idx = y * w + x;
          lum[idx] = l;
          chroma[idx] = Math.max(r, g, b) - Math.min(r, g, b);
          if (y < margin || y >= h - margin || x < margin || x >= w - margin) {
            if (((x + y) & 1) === 0) borderLums.push(l);
          }
        }
      }
      borderLums.sort((a, b) => a - b);
      const bgMedianLum = borderLums.length ? borderLums[Math.floor(borderLums.length * 0.5)] : 110;

      // 2) Morphological CLOSE 5x5 pada Luminance untuk menghapus tulisan/tinta agar tidak menipu deteksi tepi kertas
      for (let y = 2; y < h - 2; y++) {
        const row = y * w;
        for (let x = 2; x < w - 2; x++) {
          let mx = 0;
          for (let dy = -2; dy <= 2; dy++) {
            const rOff = (y + dy) * w + x;
            for (let dx = -2; dx <= 2; dx++) {
              const v = lum[rOff + dx];
              if (v > mx) mx = v;
            }
          }
          dil[row + x] = mx;
        }
      }
      for (let y = 2; y < h - 2; y++) {
        const row = y * w;
        for (let x = 2; x < w - 2; x++) {
          let mn = 255;
          for (let dy = -2; dy <= 2; dy++) {
            const rOff = (y + dy) * w + x;
            for (let dx = -2; dx <= 2; dx++) {
              const v = dil[rOff + dx];
              if (v < mn) mn = v;
            }
          }
          blur[row + x] = mn;
        }
      }

      // 3) 3x3 Gaussian pass atas hasil morphological close agar kontur kertas halus
      for (let y = 3; y < h - 3; y++) {
        const row = y * w;
        for (let x = 3; x < w - 3; x++) {
          const idx = row + x;
          dil[idx] = (
            blur[idx - w - 1] + 2 * blur[idx - w] + blur[idx - w + 1] +
            2 * blur[idx - 1] + 4 * blur[idx] + 2 * blur[idx + 1] +
            blur[idx + w - 1] + 2 * blur[idx + w] + blur[idx + w + 1]
          ) * 0.0625;
        }
      }

      // 4) Dual-channel Sobel gradient (Luma closed + Chroma saturation)
      const grad = new Float32Array(total);
      const hist = new Uint32Array(256);
      let interiorCount = 0;
      for (let y = 4; y < h - 4; y++) {
        const row = y * w;
        for (let x = 4; x < w - 4; x++) {
          const idx = row + x;
          const gxL =
            -dil[idx - w - 1] + dil[idx - w + 1] -
            2 * dil[idx - 1] + 2 * dil[idx + 1] -
            dil[idx + w - 1] + dil[idx + w + 1];
          const gyL =
            -dil[idx - w - 1] - 2 * dil[idx - w] - dil[idx - w + 1] +
            dil[idx + w - 1] + 2 * dil[idx + w] + dil[idx + w + 1];
          const gxC =
            -chroma[idx - w - 1] + chroma[idx - w + 1] -
            2 * chroma[idx - 1] + 2 * chroma[idx + 1] -
            chroma[idx + w - 1] + chroma[idx + w + 1];
          const gyC =
            -chroma[idx - w - 1] - 2 * chroma[idx - w] - chroma[idx - w + 1] +
            chroma[idx + w - 1] + 2 * chroma[idx + w] + chroma[idx + w + 1];
          const g = Math.min(255, Math.max(Math.hypot(gxL, gyL) * 0.36, Math.hypot(gxC, gyC) * 0.28));
          grad[idx] = g;
          hist[g | 0]++;
          interiorCount++;
        }
      }

      const percentileGrad = (pct) => {
        const target = interiorCount * pct;
        let acc = 0;
        for (let v = 0; v < 256; v++) {
          acc += hist[v];
          if (acc >= target) return v;
        }
        return 40;
      };
      const highThresh = Math.max(22, percentileGrad(0.86));
      const lowThresh = Math.max(10, Math.round(highThresh * 0.45));

      const edgeMap = new Uint8Array(total);
      const bfsQueue = [];
      for (let y = 3; y < h - 3; y++) {
        for (let x = 3; x < w - 3; x++) {
          const idx = y * w + x;
          if (grad[idx] >= highThresh) {
            edgeMap[idx] = 2;
            bfsQueue.push(idx);
          } else if (grad[idx] >= lowThresh) {
            edgeMap[idx] = 1;
          }
        }
      }
      // Link weak edges connected to strong edges (hysteresis)
      for (let q = 0; q < bfsQueue.length; q++) {
        const cur = bfsQueue[q];
        const cx = cur % w;
        const cy = (cur / w) | 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx < 2 || nx >= w - 2 || ny < 2 || ny >= h - 2) continue;
            const nIdx = ny * w + nx;
            if (edgeMap[nIdx] === 1) {
              edgeMap[nIdx] = 2;
              bfsQueue.push(nIdx);
            }
          }
        }
      }

      // Helper: Andrew's Monotone Chain Convex Hull + RDP simplification + 4-corner ordering
      const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
      const convexHull = (pts) => {
        if (pts.length < 4) return pts;
        const sorted = pts.slice().sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
        const lower = [];
        for (const p of sorted) {
          while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
            lower.pop();
          }
          lower.push(p);
        }
        const upper = [];
        for (let i = sorted.length - 1; i >= 0; i--) {
          const p = sorted[i];
          while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
            upper.pop();
          }
          upper.push(p);
        }
        upper.pop();
        lower.pop();
        return lower.concat(upper);
      };

      const pointSegDist = (p, a, b) => {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq < 1e-6) return Math.hypot(p.x - a.x, p.y - a.y);
        const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
        return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
      };

      const rdpClosed = (poly, eps) => {
        const rdp = (pts) => {
          if (pts.length <= 2) return pts;
          let maxD = 0, idx = 0;
          for (let i = 1; i < pts.length - 1; i++) {
            const d = pointSegDist(pts[i], pts[0], pts[pts.length - 1]);
            if (d > maxD) { maxD = d; idx = i; }
          }
          if (maxD > eps) {
            const l = rdp(pts.slice(0, idx + 1));
            const r = rdp(pts.slice(idx));
            return l.slice(0, -1).concat(r);
          }
          return [pts[0], pts[pts.length - 1]];
        };
        if (poly.length <= 4) return poly;
        // Split at farthest pair of vertices for closed-loop invariance
        let farA = 0, farB = Math.floor(poly.length / 2), bestD = -1;
        for (let i = 0; i < poly.length; i++) {
          const j = (i + Math.floor(poly.length / 2)) % poly.length;
          const d = Math.hypot(poly[i].x - poly[j].x, poly[i].y - poly[j].y);
          if (d > bestD) { bestD = d; farA = i; farB = j; }
        }
        const a1 = farA < farB ? poly.slice(farA, farB + 1) : poly.slice(farA).concat(poly.slice(0, farB + 1));
        const a2 = farA < farB ? poly.slice(farB).concat(poly.slice(0, farA + 1)) : poly.slice(farB, farA + 1);
        const s1 = rdp(a1);
        const s2 = rdp(a2);
        return s1.slice(0, -1).concat(s2.slice(0, -1));
      };

      const orderQuad = (pts) => {
        if (!pts || pts.length < 4) return null;
        let q = pts;
        if (q.length > 4) {
          // Pick 4 diagonal-extreme vertices (TL, TR, BR, BL)
          let tl = q[0], tr = q[0], br = q[0], bl = q[0];
          for (const p of q) {
            if (p.x + p.y < tl.x + tl.y) tl = p;
            if (p.x - p.y > tr.x - tr.y) tr = p;
            if (p.x + p.y > br.x + br.y) br = p;
            if (p.y - p.x > bl.y - bl.x) bl = p;
          }
          q = [tl, tr, br, bl];
        } else {
          // Order arbitrary 4 vertices around centroid
          const cx = (q[0].x + q[1].x + q[2].x + q[3].x) / 4;
          const cy = (q[0].y + q[1].y + q[2].y + q[3].y) / 4;
          const sorted = q.slice().sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
          // Rotate array so TL (min x+y) is first
          let tlIdx = 0;
          for (let i = 1; i < 4; i++) {
            if (sorted[i].x + sorted[i].y < sorted[tlIdx].x + sorted[tlIdx].y) tlIdx = i;
          }
          q = [sorted[tlIdx], sorted[(tlIdx + 1) % 4], sorted[(tlIdx + 2) % 4], sorted[(tlIdx + 3) % 4]];
        }
        // Reject degenerate / self-intersecting / collapsed quads
        const uniq = new Set(q.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`));
        if (uniq.size < 4) return null;
        return q;
      };

      const scoreCandidateQuad = (rawQuad) => {
        if (!rawQuad || rawQuad.length !== 4) return null;
        const norm = rawQuad.map((p) => ({
          x: Math.max(0.01, Math.min(0.99, p.x / w)),
          y: Math.max(0.01, Math.min(0.99, p.y / h))
        }));
        const area = Math.abs(
          0.5 * (
            norm[0].x * norm[1].y - norm[1].x * norm[0].y +
            norm[1].x * norm[2].y - norm[2].x * norm[1].y +
            norm[2].x * norm[3].y - norm[3].x * norm[2].y +
            norm[3].x * norm[0].y - norm[0].x * norm[3].y
          )
        );
        if (area < 0.12 || area > 0.92) return null;

        // Edge lengths & interior angles check
        let minSide = Infinity;
        for (let i = 0; i < 4; i++) {
          const a = norm[i], b = norm[(i + 1) % 4], c = norm[(i + 2) % 4];
          const side = Math.hypot(b.x - a.x, b.y - a.y);
          if (side < minSide) minSide = side;
          const v1x = a.x - b.x, v1y = a.y - b.y;
          const v2x = c.x - b.x, v2y = c.y - b.y;
          const cos = (v1x * v2x + v1y * v2y) / Math.max(1e-6, Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y));
          const angDeg = Math.acos(Math.max(-1, Math.min(1, cos))) * (180 / Math.PI);
          if (angDeg < 38 || angDeg > 145) return null;
        }
        if (minSide < 0.18) return null;

        // Edge gradient support score: measure how strongly Sobel edges align along the 4 sides
        let edgeHits = 0;
        let samples = 0;
        for (let i = 0; i < 4; i++) {
          const p0 = rawQuad[i], p1 = rawQuad[(i + 1) % 4];
          const steps = 20;
          for (let s = 1; s < steps; s++) {
            const t = s / steps;
            const sx = Math.round(p0.x + (p1.x - p0.x) * t);
            const sy = Math.round(p0.y + (p1.y - p0.y) * t);
            let localMax = 0;
            for (let dy = -2; dy <= 2; dy++) {
              for (let dx = -2; dx <= 2; dx++) {
                const xx = sx + dx, yy = sy + dy;
                if (xx >= 1 && xx < w - 1 && yy >= 1 && yy < h - 1) {
                  const g = grad[yy * w + xx];
                  if (g > localMax) localMax = g;
                }
              }
            }
            if (localMax >= lowThresh) edgeHits++;
            samples++;
          }
        }
        const edgeSupport = edgeHits / Math.max(1, samples);
        const conf = Math.max(0.25, Math.min(0.96, edgeSupport * 0.72 + Math.min(0.28, area * 0.35)));
        return { corners: norm, confidence: conf };
      };

      const candidates = [];

      // Candidate A: Strong Sobel connected components -> Convex Hull -> RDP quad
      const visited = new Uint8Array(total);
      let bestCompPts = [];
      for (let y = 4; y < h - 4; y++) {
        for (let x = 4; x < w - 4; x++) {
          const start = y * w + x;
          if (edgeMap[start] !== 2 || visited[start]) continue;
          const comp = [];
          const stack = [start];
          visited[start] = 1;
          let minX = x, maxX = x, minY = y, maxY = y;
          while (stack.length) {
            const cur = stack.pop();
            const cx = cur % w;
            const cy = (cur / w) | 0;
            if ((comp.length & 1) === 0 || stack.length < 40) comp.push({ x: cx, y: cy });
            if (cx < minX) minX = cx; if (cx > maxX) maxX = cx;
            if (cy < minY) minY = cy; if (cy > maxY) maxY = cy;
            for (let dy = -2; dy <= 2; dy++) {
              for (let dx = -2; dx <= 2; dx++) {
                if (!dx && !dy) continue;
                const nx = cx + dx, ny = cy + dy;
                if (nx < 3 || nx >= w - 3 || ny < 3 || ny >= h - 3) continue;
                const nIdx = ny * w + nx;
                if (edgeMap[nIdx] === 2 && !visited[nIdx]) {
                  visited[nIdx] = 1;
                  stack.push(nIdx);
                }
              }
            }
          }
          const spanW = (maxX - minX) / w;
          const spanH = (maxY - minY) / h;
          if (comp.length >= 24 && spanW > 0.25 && spanH > 0.25 && (comp.length > bestCompPts.length)) {
            bestCompPts = comp;
          }
        }
      }

      if (bestCompPts.length >= 16) {
        const hull = convexHull(bestCompPts);
        const perim = Math.min(w, h) * 0.045;
        let simplified = hull;
        for (const factor of [0.6, 1.0, 1.5, 2.2]) {
          const r = rdpClosed(hull, perim * factor);
          if (r.length >= 4 && r.length <= 8) {
            simplified = r;
            if (r.length === 4) break;
          }
        }
        const ordered = orderQuad(simplified);
        const scored = scoreCandidateQuad(ordered);
        if (scored) candidates.push(scored);
      }

      // Candidate B: Paper-region segmentation (clean/bright vs background median) + Convex Hull + RDP
      const paperPts = [];
      const fgMask = new Uint8Array(total);
      for (let y = 3; y < h - 3; y++) {
        for (let x = 3; x < w - 3; x++) {
          const idx = y * w + x;
          const i4 = idx * 4;
          const r = data[i4], g = data[i4 + 1], b = data[i4 + 2];
          const sat = Math.max(r, g, b) - Math.min(r, g, b);
          if ((lum[idx] > bgMedianLum + 14 && lum[idx] > 108) || (sat < 42 && lum[idx] > bgMedianLum + 8)) {
            fgMask[idx] = 1;
          }
        }
      }
      // Keep only interior points with >= 3 foreground neighbors to reject thin tile grout noise
      for (let y = 4; y < h - 4; y += 2) {
        for (let x = 4; x < w - 4; x += 2) {
          const idx = y * w + x;
          if (!fgMask[idx]) continue;
          const n = fgMask[idx - 1] + fgMask[idx + 1] + fgMask[idx - w] + fgMask[idx + w];
          if (n >= 3) paperPts.push({ x, y });
        }
      }
      if (paperPts.length >= 25) {
        const hull = convexHull(paperPts);
        const r = rdpClosed(hull, Math.min(w, h) * 0.055);
        const ordered = orderQuad(r.length >= 4 ? r : hull);
        const scored = scoreCandidateQuad(ordered);
        if (scored) candidates.push(scored);
      }

      if (!candidates.length) {
        return { corners: defaultQuad, confidence: 0.15 };
      }

      candidates.sort((a, b) => b.confidence - a.confidence);
      const best = candidates[0];
      return {
        corners: best.corners.map((c) => ({ x: Number(c.x.toFixed(3)), y: Number(c.y.toFixed(3)) })),
        confidence: best.confidence
      };
    } catch (_) {
      return { corners: defaultQuad, confidence: 0 };
    }
  },

  detectDocumentCornersFromImage(imgEl) {
    return this.detectDocumentCornersDetailed(imgEl).corners;
  },

  /**
   * Estimasi rasio & ukuran kertas asli (Zhang & He 2002) — Port dari HomographyService APK
   */
  _PAPER_RATIOS: {
    A4: 297 / 210,
    F4: 330 / 215,
    Letter: 279.4 / 215.9,
    Legal: 355.6 / 215.9,
    'Kartu ID': 85.6 / 54,
    A5: 210 / 148
  },

  _perspectiveRatio(pts, imgW, imgH) {
    const u0 = imgW / 2;
    const v0 = imgH / 2;
    const vec = (p) => [p.x - u0, p.y - v0, 1];
    const cross = (a, b) => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0]
    ];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

    const m1 = vec(pts[0]), m2 = vec(pts[1]), m3 = vec(pts[3]), m4 = vec(pts[2]);
    const den2 = dot(cross(m2, m4), m3);
    const den3 = dot(cross(m3, m4), m2);
    if (Math.abs(den2) < 1e-9 || Math.abs(den3) < 1e-9) return null;
    const k2 = dot(cross(m1, m4), m3) / den2;
    const k3 = dot(cross(m1, m4), m2) / den3;
    const n2 = [k2 * m2[0] - m1[0], k2 * m2[1] - m1[1], k2 * m2[2] - m1[2]];
    const n3 = [k3 * m3[0] - m1[0], k3 * m3[1] - m1[1], k3 * m3[2] - m1[2]];
    const f = 0.8 * Math.max(imgW, imgH);
    const f2 = f * f;
    const a = (n2[0] * n2[0] + n2[1] * n2[1]) / f2 + n2[2] * n2[2];
    const b = (n3[0] * n3[0] + n3[1] * n3[1]) / f2 + n3[2] * n3[2];
    if (a <= 0 || b <= 0) return null;
    const r = Math.sqrt(a / b);
    return Number.isFinite(r) ? r : null;
  },

  estimateDocumentSize(ptsPx, imgW, imgH, autoPaper = true, maxDim = 1600) {
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const measuredW = Math.max(1, dist(ptsPx[0], ptsPx[1]), dist(ptsPx[3], ptsPx[2]));
    const measuredH = Math.max(1, dist(ptsPx[0], ptsPx[3]), dist(ptsPx[1], ptsPx[2]));
    let ratio = measuredW / measuredH;
    let paperName = null;

    if (autoPaper) {
      const r = this._perspectiveRatio(ptsPx, imgW, imgH);
      if (r && r > 0.2 && r < 5) ratio = r;
      let bestErr = 0.05;
      for (const [name, hw] of Object.entries(this._PAPER_RATIOS)) {
        for (const cand of [1 / hw, hw]) {
          const err = Math.abs(ratio / cand - 1);
          if (err < bestErr) {
            bestErr = err;
            paperName = name;
            ratio = cand;
          }
        }
      }
    }

    let w = measuredW;
    let h = w / Math.max(0.2, ratio);
    if (h < measuredH) {
      const s = measuredH / Math.max(1, h);
      w *= s;
      h *= s;
    }
    const over = Math.max(w, h) / maxDim;
    if (over > 1) {
      w /= over;
      h /= over;
    }
    return {
      width: Math.max(100, Math.round(w)),
      height: Math.max(100, Math.round(h)),
      paperName
    };
  },

  /**
   * Transformasi Perspektif 4 Titik (Homography Inverse Mapping) di Sisi Klien
   * cornersNorm = [{x,y} TL, {x,y} TR, {x,y} BR, {x,y} BL] dalam rentang 0..1
   */
  warpPerspectiveImage(imgEl, cornersNorm, rotationDeg = 0, filter = 'magic', quality = 0.82, opts = {}) {
    const srcW = imgEl.naturalWidth || imgEl.width;
    const srcH = imgEl.naturalHeight || imgEl.height;

    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = srcW;
    srcCanvas.height = srcH;
    const srcCtx = srcCanvas.getContext('2d');
    srcCtx.drawImage(imgEl, 0, 0);
    const srcData = srcCtx.getImageData(0, 0, srcW, srcH).data;

    const pts = cornersNorm.map((p) => ({
      x: Math.max(0, Math.min(srcW - 1, p.x * srcW)),
      y: Math.max(0, Math.min(srcH - 1, p.y * srcH))
    }));

    const autoPaper = !opts || opts.autoPaper !== false;
    const est = this.estimateDocumentSize(pts, srcW, srcH, autoPaper, 1600);
    const dstW = est.width;
    const dstH = est.height;

    const dstCanvas = document.createElement('canvas');
    dstCanvas.width = dstW;
    dstCanvas.height = dstH;
    const dstCtx = dstCanvas.getContext('2d');
    const outImg = dstCtx.createImageData(dstW, dstH);
    const dstData = outImg.data;

    // Bilinear interpolation dari 4 titik sudut (tl, tr, br, bl)
    const [tl, tr, br, bl] = pts;
    for (let y = 0; y < dstH; y++) {
      const v = y / Math.max(1, dstH - 1);
      const leftX = tl.x + (bl.x - tl.x) * v;
      const leftY = tl.y + (bl.y - tl.y) * v;
      const rightX = tr.x + (br.x - tr.x) * v;
      const rightY = tr.y + (br.y - tr.y) * v;

      for (let x = 0; x < dstW; x++) {
        const u = x / Math.max(1, dstW - 1);
        const sx = Math.min(srcW - 1, Math.max(0, Math.round(leftX + (rightX - leftX) * u)));
        const sy = Math.min(srcH - 1, Math.max(0, Math.round(leftY + (rightY - leftY) * u)));

        const sIdx = (sy * srcW + sx) * 4;
        const dIdx = (y * dstW + x) * 4;

        dstData[dIdx] = srcData[sIdx];
        dstData[dIdx + 1] = srcData[sIdx + 1];
        dstData[dIdx + 2] = srcData[sIdx + 2];
        dstData[dIdx + 3] = 255;
      }
    }

    dstCtx.putImageData(outImg, 0, 0);

    // Terapkan seluruh 7 filter pemindai secara konsisten lewat AttaStorage
    if (filter && filter !== 'original') {
      if (typeof AttaStorage !== 'undefined' && typeof AttaStorage.applyFilterToCanvas === 'function') {
        AttaStorage.applyFilterToCanvas(dstCtx, dstW, dstH, filter);
      } else {
        const tmp = dstCtx.getImageData(0, 0, dstW, dstH);
        const d = tmp.data;
        for (let i = 0; i < d.length; i += 4) {
          if (filter === 'bw') {
            const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
            const val = lum > 138 ? 255 : lum < 85 ? 0 : Math.round((lum - 85) * 4.8);
            d[i] = d[i + 1] = d[i + 2] = val;
          } else if (filter === 'gray') {
            const lum = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
            d[i] = d[i + 1] = d[i + 2] = lum;
          }
        }
        dstCtx.putImageData(tmp, 0, 0);
      }
    }

    // Terapkan rotasi jika diminta (90, 180, 270)
    const normRot = ((rotationDeg % 360) + 360) % 360;
    let finalCanvas = dstCanvas;
    if (normRot !== 0) {
      finalCanvas = document.createElement('canvas');
      if (normRot === 90 || normRot === 270) {
        finalCanvas.width = dstH;
        finalCanvas.height = dstW;
      } else {
        finalCanvas.width = dstW;
        finalCanvas.height = dstH;
      }
      const rCtx = finalCanvas.getContext('2d');
      rCtx.translate(finalCanvas.width / 2, finalCanvas.height / 2);
      rCtx.rotate((normRot * Math.PI) / 180);
      rCtx.drawImage(dstCanvas, -dstW / 2, -dstH / 2);
    }

    return {
      dataUrl: finalCanvas.toDataURL('image/jpeg', quality),
      width: finalCanvas.width,
      height: finalCanvas.height,
      paperName: est.paperName || null
    };
  },

  /* ==========================================================================
   * C. STITCH KARTU ID / KTP DEPAN & BELAKANG KE 1 LEMBAR A4
   *    (Port dari HomographyService.stitchIdCard di smart_scanner_app)
   * ========================================================================== */
  async stitchIdCardFrontBack(frontFile, backFile, filterMode = 'magic') {
    const frontProcessed = await AttaStorage.compressAndFilterImage(frontFile, {
      maxDimension: 1200,
      quality: 0.88,
      filter: filterMode
    });
    const backProcessed = await AttaStorage.compressAndFilterImage(backFile, {
      maxDimension: 1200,
      quality: 0.88,
      filter: filterMode
    });

    const loadImg = (url) =>
      new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = url;
      });

    const [fImg, bImg] = await Promise.all([
      loadImg(frontProcessed.dataUrl),
      loadImg(backProcessed.dataUrl)
    ]);

    const pageW = 1240;
    const pageH = 1754;
    const canvas = document.createElement('canvas');
    canvas.width = pageW;
    canvas.height = pageH;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, pageW, pageH);

    const drawCardInBox = (img, boxY) => {
      const boxW = 720;
      const boxH = 460;
      const scale = Math.min(boxW / img.width, boxH / img.height);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const x = Math.round((pageW - w) / 2);
      const y = Math.round(boxY + (boxH - h) / 2);

      ctx.strokeStyle = '#C9CFD5';
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 4, y - 4, w + 8, h + 8);
      ctx.drawImage(img, x, y, w, h);
    };

    drawCardInBox(fImg, 240);
    drawCardInBox(bImg, 960);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.86);
    const { PDFDocument } = window.PDFLib;
    const pdfDoc = await PDFDocument.create();
    const jpg = await pdfDoc.embedJpg(dataUrl);
    const page = pdfDoc.addPage([595.28, 841.89]);
    page.drawImage(jpg, { x: 0, y: 0, width: 595.28, height: 841.89 });
    const pdfBytes = await pdfDoc.save();

    return {
      pdfBlob: new Blob([pdfBytes], { type: 'application/pdf' }),
      thumbnailDataUrl: dataUrl
    };
  },

  /* ==========================================================================
   * D. ALAT MANIPULASI PDF LENGKAP (Port dari PdfEngineService di PDF_New)
   * ========================================================================== */

  /** 1. Pisahkan PDF (Split) */
  async splitPdfByRangeString(pdfFile, rangeStr) {
    const { PDFDocument } = window.PDFLib;
    const ab = await pdfFile.arrayBuffer();
    const srcDoc = await PDFDocument.load(ab, { ignoreEncryption: true });
    const totalPages = srcDoc.getPageCount();
    const ranges = this.parsePageRanges(rangeStr, totalPages);

    if (ranges.length === 0) {
      throw new Error(`Masukkan nomor halaman antara 1 sampai ${totalPages}, misal 1-2, 4.`);
    }

    const baseName = (pdfFile.name || 'Dokumen').replace(/\.pdf$/i, '');
    const outputs = [];

    for (let i = 0; i < ranges.length; i++) {
      const r = ranges[i];
      const outDoc = await PDFDocument.create();
      const copied = await outDoc.copyPages(srcDoc, r);
      copied.forEach((p) => outDoc.addPage(p));
      const bytes = await outDoc.save();
      const label = r.length === 1 ? `Hal ${r[0] + 1}` : `Hal ${r[0] + 1}-${r[r.length - 1] + 1}`;
      outputs.push({
        name: `${baseName} (${label}).pdf`,
        blob: new Blob([bytes], { type: 'application/pdf' }),
        pageCount: r.length
      });
    }
    return outputs;
  },

  /** 2. Hapus Halaman PDF (Remove Pages) */
  async removePagesFromPdf(pdfFile, rangeStr) {
    const { PDFDocument } = window.PDFLib;
    const ab = await pdfFile.arrayBuffer();
    const srcDoc = await PDFDocument.load(ab, { ignoreEncryption: true });
    const total = srcDoc.getPageCount();
    const toRemove = this.parseFlatPageIndices(rangeStr, total);

    if (toRemove.length === 0) {
      throw new Error(`Pilih nomor halaman yang valid antara 1 sampai ${total}.`);
    }
    if (toRemove.length >= total) {
      throw new Error('Sisakan minimal 1 halaman di dalam dokumen PDF.');
    }

    const keepIndices = [];
    for (let i = 0; i < total; i++) {
      if (!toRemove.includes(i)) keepIndices.push(i);
    }

    const outDoc = await PDFDocument.create();
    const copied = await outDoc.copyPages(srcDoc, keepIndices);
    copied.forEach((p) => outDoc.addPage(p));
    const bytes = await outDoc.save();
    return {
      blob: new Blob([bytes], { type: 'application/pdf' }),
      keptCount: keepIndices.length,
      removedCount: toRemove.length
    };
  },

  /** 3. Susun Ulang & Putar Halaman PDF (Organize & Rotate) */
  async organizeAndRotatePdf(pdfFile, orderStr, extraRotationDeg = 0) {
    const { PDFDocument, degrees } = window.PDFLib;
    const ab = await pdfFile.arrayBuffer();
    const srcDoc = await PDFDocument.load(ab, { ignoreEncryption: true });
    const total = srcDoc.getPageCount();

    let orderIndices = [];
    if (orderStr && orderStr.trim().length > 0) {
      orderIndices = this.parseFlatPageIndices(orderStr, total);
      if (orderIndices.length === 0) {
        throw new Error(`Nomor halaman tidak valid. Masukkan angka antara 1 sampai ${total}.`);
      }
    } else {
      orderIndices = Array.from({ length: total }, (_, i) => i);
    }

    const outDoc = await PDFDocument.create();
    const copied = await outDoc.copyPages(srcDoc, orderIndices);
    for (const page of copied) {
      if (extraRotationDeg !== 0) {
        const currentRot = page.getRotation().angle || 0;
        page.setRotation(degrees((currentRot + extraRotationDeg) % 360));
      }
      outDoc.addPage(page);
    }

    const bytes = await outDoc.save();
    return {
      blob: new Blob([bytes], { type: 'application/pdf' }),
      pageCount: copied.length
    };
  },

  /** 4. Nomor Halaman Otomatis (Page Numbers) */
  async addPageNumbersToPdf(pdfFile, position = 'bottom', formatStr = 'Halaman {page} dari {total}') {
    const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
    const ab = await pdfFile.arrayBuffer();
    const pdfDoc = await PDFDocument.load(ab, { ignoreEncryption: true });
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const pages = pdfDoc.getPages();
    const total = pages.length;

    for (let i = 0; i < total; i++) {
      const page = pages[i];
      const { width, height } = page.getSize();
      const rawText = formatStr.replace('{page}', String(i + 1)).replace('{total}', String(total));
      const text = rawText.replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');
      const fontSize = 10;
      const textWidth = font.widthOfTextAtSize(text, fontSize);
      const x = (width - textWidth) / 2;
      const y = position === 'top' ? height - 26 : 20;

      page.drawText(text, {
        x,
        y,
        size: fontSize,
        font,
        color: rgb(0.33, 0.38, 0.43)
      });
    }

    const bytes = await pdfDoc.save();
    return {
      blob: new Blob([bytes], { type: 'application/pdf' }),
      pageCount: total
    };
  },

  /** 5. Potong Margin PDF (Crop PDF) */
  async cropPdfMargins(pdfFile, marginPt = 28) {
    const { PDFDocument } = window.PDFLib;
    const ab = await pdfFile.arrayBuffer();
    const pdfDoc = await PDFDocument.load(ab, { ignoreEncryption: true });
    const pages = pdfDoc.getPages();

    for (const page of pages) {
      const { width, height } = page.getSize();
      const m = Math.min(marginPt, Math.min(width, height) * 0.22);
      page.setCropBox(m, m, width - m * 2, height - m * 2);
      page.setMediaBox(m, m, width - m * 2, height - m * 2);
    }

    const bytes = await pdfDoc.save();
    return {
      blob: new Blob([bytes], { type: 'application/pdf' }),
      pageCount: pages.length
    };
  },

  /** 6. Bubuhkan Tanda Tangan ke Halaman PDF (mendukung posisi bebas geser-ukur maupun preset) */
  async stampSignatureToPdf(pdfFile, sigPngDataUrl, pageModeOrPlacement = 'last', position = 'bottom_right') {
    const { PDFDocument, degrees } = window.PDFLib;
    const ab = await pdfFile.arrayBuffer();
    const pdfDoc = await PDFDocument.load(ab, { ignoreEncryption: true });
    const pngImage = await pdfDoc.embedPng(sigPngDataUrl);
    const pages = pdfDoc.getPages();
    const total = pages.length;

    const isCustom = pageModeOrPlacement && typeof pageModeOrPlacement === 'object';
    let targetIndices = [];
    if (isCustom) {
      if (pageModeOrPlacement.applyAll) {
        targetIndices = pages.map((_, idx) => idx);
      } else if (Array.isArray(pageModeOrPlacement.targetPages) && pageModeOrPlacement.targetPages.length) {
        targetIndices = pageModeOrPlacement.targetPages.filter((idx) => idx >= 0 && idx < total);
      } else {
        const singleIdx = Math.max(0, Math.min(total - 1, Number(pageModeOrPlacement.pageIndex) || 0));
        targetIndices = [singleIdx];
      }
    } else {
      targetIndices =
        pageModeOrPlacement === 'all'
          ? pages.map((_, idx) => idx)
          : pageModeOrPlacement === 'first'
          ? [0]
          : [total - 1];
    }

    const userRotations = (isCustom && pageModeOrPlacement.userRotations)
      ? { ...pageModeOrPlacement.userRotations }
      : {};
    if (isCustom && typeof pageModeOrPlacement.userRotationDeg === 'number' && pageModeOrPlacement.userRotationDeg !== 0) {
      if (pageModeOrPlacement.applyAll) {
        for (let pIdx = 0; pIdx < total; pIdx++) {
          userRotations[pIdx] = (((Number(userRotations[pIdx]) || 0) + pageModeOrPlacement.userRotationDeg) % 360 + 360) % 360;
        }
      } else {
        const targetIdx = Math.max(0, Math.min(total - 1, Number(pageModeOrPlacement.pageIndex) || 0));
        userRotations[targetIdx] = (((Number(userRotations[targetIdx]) || 0) + pageModeOrPlacement.userRotationDeg) % 360 + 360) % 360;
      }
    }

    // Persist any user rotations applied during interactive placement to the saved PDF
    if (userRotations && typeof userRotations === 'object') {
      for (let pIdx = 0; pIdx < total; pIdx++) {
        const extraRot = Number(userRotations[pIdx]) || 0;
        if (extraRot !== 0) {
          const initRot = pages[pIdx].getRotation().angle || 0;
          const finalRot = (((initRot + extraRot) % 360) + 360) % 360;
          pages[pIdx].setRotation((degrees || window.PDFLib.degrees)(finalRot));
        }
      }
    }

    for (const idx of targetIndices) {
      const page = pages[idx];
      const { width, height } = page.getSize();
      const aspect = pngImage.height / Math.max(1, pngImage.width);

      const rot = (((page.getRotation().angle || 0) % 360) + 360) % 360;
      const visualW = (rot === 90 || rot === 270) ? height : width;
      const visualH = (rot === 90 || rot === 270) ? width : height;

      let drawW;
      let drawH;
      let vx;
      let vy;

      if (isCustom) {
        const widthNorm = Math.min(0.8, Math.max(0.1, Number(pageModeOrPlacement.widthNorm) || 0.3));
        drawW = visualW * widthNorm;
        drawH = drawW * aspect;
        const xNorm = Math.min(0.95, Math.max(0.01, Number(pageModeOrPlacement.xNorm) || 0.5));
        const yNorm = Math.min(0.95, Math.max(0.01, Number(pageModeOrPlacement.yNorm) || 0.72));
        vx = Math.max(6, Math.min(visualW - drawW - 6, xNorm * visualW));
        vy = Math.max(6, Math.min(visualH - drawH - 6, yNorm * visualH));
      } else {
        drawW = Math.min(150, visualW * 0.38);
        drawH = drawW * aspect;
        const margin = 38;
        vy = Math.max(6, visualH - drawH - margin);
        if (position === 'bottom_left') {
          vx = margin;
        } else if (position === 'bottom_center') {
          vx = Math.max(6, (visualW - drawW) / 2);
        } else {
          vx = Math.max(6, visualW - drawW - margin);
        }
      }

      let pdfX;
      let pdfY;
      let rotateAngle;

      switch (rot) {
        case 0:
          pdfX = vx;
          pdfY = height - vy - drawH;
          rotateAngle = 0;
          break;
        case 90:
          pdfX = vy + drawH;
          pdfY = vx;
          rotateAngle = 90;
          break;
        case 180:
          pdfX = width - vx;
          pdfY = vy + drawH;
          rotateAngle = 180;
          break;
        case 270:
          pdfX = width - vy - drawH;
          pdfY = height - vx;
          rotateAngle = 270;
          break;
      }

      page.drawImage(pngImage, {
        x: pdfX,
        y: pdfY,
        width: drawW,
        height: drawH,
        rotate: (degrees || window.PDFLib.degrees)(rotateAngle)
      });
    }

    const bytes = await pdfDoc.save();
    return {
      blob: new Blob([bytes], { type: 'application/pdf' }),
      pageCount: total
    };
  },

  /** 7. Samarkan Informasi Rahasia / Redact PDF */
  async redactPdfByBand(pdfFile, areaBand = 'middle', labelText = 'DIREDAKSI PERMANEN') {
    const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
    const ab = await pdfFile.arrayBuffer();
    const pdfDoc = await PDFDocument.load(ab, { ignoreEncryption: true });
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const pages = pdfDoc.getPages();

    // Bersihkan metadata dokumen
    pdfDoc.setTitle('');
    pdfDoc.setAuthor('');
    pdfDoc.setSubject('');
    pdfDoc.setKeywords([]);

    for (const page of pages) {
      const { width, height } = page.getSize();
      let boxY = height * 0.46;
      let boxH = 58;
      if (areaBand === 'top') {
        boxY = height * 0.76;
        boxH = 64;
      } else if (areaBand === 'bottom') {
        boxY = height * 0.14;
        boxH = 64;
      }

      page.drawRectangle({
        x: 44,
        y: boxY,
        width: width - 88,
        height: boxH,
        color: rgb(0.09, 0.12, 0.17)
      });

      page.drawText(labelText, {
        x: 58,
        y: boxY + boxH / 2 - 4,
        size: 10,
        font,
        color: rgb(0.98, 0.98, 0.97)
      });
    }

    const bytes = await pdfDoc.save();
    return {
      blob: new Blob([bytes], { type: 'application/pdf' }),
      pageCount: pages.length
    };
  },

  /** 8. Perbaiki Struktur PDF (Repair PDF) */
  async repairPdfFile(pdfFile) {
    const { PDFDocument } = window.PDFLib;
    const ab = await pdfFile.arrayBuffer();
    const brokenDoc = await PDFDocument.load(ab, {
      ignoreEncryption: true,
      updateMetadata: false
    });
    const cleanDoc = await PDFDocument.create();
    const indices = brokenDoc.getPageIndices();
    const copied = await cleanDoc.copyPages(brokenDoc, indices);
    copied.forEach((p) => cleanDoc.addPage(p));

    const bytes = await cleanDoc.save({ useObjectStreams: false });
    return {
      blob: new Blob([bytes], { type: 'application/pdf' }),
      pageCount: copied.length
    };
  },

  /* ==========================================================================
   * E. KONVERSI DOKUMEN OFFICE (.DOCX, .XLSX, .CSV, .TXT) KE PDF OFFLINE
   *    (Port dari DocumentConvertService di PDF_New menggunakan JSZip + XML)
   * ========================================================================== */
  async convertOfficeDocumentToPdf(file) {
    const name = file.name || 'Dokumen';
    const ext = (name.split('.').pop() || '').toLowerCase();
    let paragraphs = [];
    let tables = [];

    if (ext === 'docx') {
      const zip = await JSZip.loadAsync(file);
      const docXmlFile = zip.file('word/document.xml');
      if (!docXmlFile) {
        throw new Error('Isi dokumen Word (.docx) tidak ditemukan.');
      }
      const xmlText = await docXmlFile.async('string');
      const xmlDoc = new DOMParser().parseFromString(xmlText, 'application/xml');

      const body = xmlDoc.getElementsByTagName('w:body')[0] || xmlDoc.documentElement;
      for (const child of Array.from(body.childNodes)) {
        if (child.nodeName === 'w:p') {
          const tNodes = child.getElementsByTagName('w:t');
          const line = Array.from(tNodes).map((n) => n.textContent || '').join('');
          if (line.trim()) paragraphs.push(line.trim());
        } else if (child.nodeName === 'w:tbl') {
          const rows = [];
          const trNodes = child.getElementsByTagName('w:tr');
          for (const tr of Array.from(trNodes)) {
            const cells = [];
            const tcNodes = tr.getElementsByTagName('w:tc');
            for (const tc of Array.from(tcNodes)) {
              const tNodes = tc.getElementsByTagName('w:t');
              cells.push(Array.from(tNodes).map((n) => n.textContent || '').join(' ').trim());
            }
            if (cells.length > 0) rows.push(cells);
          }
          if (rows.length > 0) tables.push(rows);
        }
      }
    } else if (ext === 'xlsx') {
      const zip = await JSZip.loadAsync(file);
      const shared = [];
      const sharedEntry = zip.file('xl/sharedStrings.xml');
      if (sharedEntry) {
        const sXml = await sharedEntry.async('string');
        const sDoc = new DOMParser().parseFromString(sXml, 'application/xml');
        const siList = sDoc.getElementsByTagName('si');
        for (const si of Array.from(siList)) {
          const tList = si.getElementsByTagName('t');
          shared.push(Array.from(tList).map((t) => t.textContent || '').join(''));
        }
      }

      const sheetNames = Object.keys(zip.files)
        .filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(k) || (k.startsWith('xl/worksheets/') && k.endsWith('.xml')))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

      if (!sheetNames.length) {
        throw new Error('Lembar kerja Excel (.xlsx) tidak ditemukan.');
      }

      for (const sPath of sheetNames) {
        const sheetEntry = zip.file(sPath);
        if (!sheetEntry) continue;
        const sheetXml = await sheetEntry.async('string');
        const sheetDoc = new DOMParser().parseFromString(sheetXml, 'application/xml');
        const rowNodes = sheetDoc.getElementsByTagName('row');
        const rows = [];

        for (const rNode of Array.from(rowNodes)) {
          const cNodes = rNode.getElementsByTagName('c');
          const rowCells = [];
          for (const c of Array.from(cNodes)) {
            const type = c.getAttribute('t');
            const vNode = c.getElementsByTagName('v')[0];
            const rawVal = vNode ? vNode.textContent || '' : '';
            if (type === 's') {
              const idx = parseInt(rawVal, 10);
              rowCells.push(!isNaN(idx) && shared[idx] !== undefined ? shared[idx] : rawVal);
            } else if (type === 'inlineStr') {
              const tNodes = c.getElementsByTagName('t');
              rowCells.push(Array.from(tNodes).map((t) => t.textContent || '').join(''));
            } else {
              rowCells.push(rawVal);
            }
          }
          if (rowCells.some((val) => val.trim() !== '')) {
            rows.push(rowCells);
          }
        }
        if (rows.length > 0) {
          if (sheetNames.length > 1) {
            const sheetShort = sPath.split('/').pop().replace(/\.xml$/i, '');
            paragraphs.push(`[${sheetShort}]`);
          }
          tables.push(rows);
        }
      }
    } else if (ext === 'csv') {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      const sep = (lines[0] || '').split(';').length > (lines[0] || '').split(',').length ? ';' : ',';
      const rows = lines.map((line) => line.split(sep).map((cell) => cell.replace(/^"|"$/g, '').trim()));
      if (rows.length > 0) tables.push(rows);
    } else {
      const text = await file.text();
      paragraphs = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    }

    if (paragraphs.length === 0 && tables.length === 0) {
      throw new Error('Dokumen tidak memiliki teks atau tabel yang dapat dikonversi.');
    }

    return this.renderBlocksToPdfBlob(name.replace(/\.[^/.]+$/, ''), paragraphs, tables);
  },

  async renderBlocksToPdfBlob(title, paragraphs, tables) {
    const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
    const pdfDoc = await PDFDocument.create();
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const pageW = 595.28;
    const pageH = 841.89;
    const margin = 44;
    const usableW = pageW - margin * 2;

    let page = pdfDoc.addPage([pageW, pageH]);
    let y = pageH - margin;

    const sanitizeAscii = (str) =>
      String(str || '')
        .replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ')
        .trim();

    const ensureSpace = (needed) => {
      if (y - needed < margin) {
        page = pdfDoc.addPage([pageW, pageH]);
        y = pageH - margin;
      }
    };

    // Judul Dokumen
    page.drawText(sanitizeAscii(title).slice(0, 65) || 'Dokumen Konversi', {
      x: margin,
      y: y - 16,
      size: 15,
      font: fontBold,
      color: rgb(0.09, 0.12, 0.17)
    });
    y -= 28;
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageW - margin, y },
      thickness: 1,
      color: rgb(0.79, 0.82, 0.85)
    });
    y -= 18;

    // Render Paragraf dengan Word-Wrap
    for (const para of paragraphs) {
      const clean = sanitizeAscii(para);
      if (!clean) continue;
      const words = clean.split(/\s+/);
      let line = '';
      for (const w of words) {
        const test = line ? `${line} ${w}` : w;
        if (fontReg.widthOfTextAtSize(test, 10.5) > usableW) {
          ensureSpace(16);
          page.drawText(line, { x: margin, y, size: 10.5, font: fontReg, color: rgb(0.09, 0.12, 0.17) });
          y -= 15;
          line = w;
        } else {
          line = test;
        }
      }
      if (line) {
        ensureSpace(16);
        page.drawText(line, { x: margin, y, size: 10.5, font: fontReg, color: rgb(0.09, 0.12, 0.17) });
        y -= 18;
      }
    }

    // Render Tabel Grid
    for (const table of tables) {
      if (!table.length) continue;
      const colCount = Math.min(8, Math.max(...table.map((r) => r.length)));
      if (colCount <= 0) continue;
      const colW = usableW / colCount;
      const rowH = 20;

      for (let rIdx = 0; rIdx < table.length; rIdx++) {
        ensureSpace(rowH + 6);
        const row = table[rIdx];
        const isHeader = rIdx === 0;

        if (isHeader) {
          page.drawRectangle({
            x: margin,
            y: y - rowH + 4,
            width: usableW,
            height: rowH,
            color: rgb(0.93, 0.95, 0.96)
          });
        }

        for (let cIdx = 0; cIdx < colCount; cIdx++) {
          const maxChars = Math.max(12, Math.floor((colW - 8) / 4.4));
          const cellText = sanitizeAscii(row[cIdx] || '').slice(0, maxChars);
          const cellX = margin + cIdx * colW;
          page.drawRectangle({
            x: cellX,
            y: y - rowH + 4,
            width: colW,
            height: rowH,
            borderColor: rgb(0.79, 0.82, 0.85),
            borderWidth: 0.6
          });
          page.drawText(cellText, {
            x: cellX + 4,
            y: y - 10,
            size: 8.5,
            font: isHeader ? fontBold : fontReg,
            color: rgb(0.09, 0.12, 0.17)
          });
        }
        y -= rowH;
      }
      y -= 14;
    }

    const bytes = await pdfDoc.save();
    return {
      blob: new Blob([bytes], { type: 'application/pdf' }),
      pageCount: pdfDoc.getPageCount()
    };
  },

  /* ==========================================================================
   * F. EKSTRAKSI TEKS PDF OFFLINE & KONVERSI KE WORD / EXCEL / MARKDOWN
   * ========================================================================== */
  /** OCR Offline di APK (via Google ML Kit) pada Blob/File/DataURL gambar */
  async runOfflineOcrOnBlob(blobOrUrl) {
    const bridge = typeof window !== 'undefined' ? window.AttaNativeAndroid : null;
    if (!bridge || typeof bridge.recognizeTextFromImage !== 'function') {
      return { text: '', paragraphs: [], lines: [], unsupportedOffline: true };
    }

    let dataUrl = '';
    if (typeof blobOrUrl === 'string') {
      dataUrl = blobOrUrl;
    } else {
      dataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onerror = reject;
        r.onload = (ev) => resolve(ev.target.result);
        r.readAsDataURL(blobOrUrl);
      });
    }

    // Perkecil bila gambar terlalu raksasa agar transfer cepat & tetap tajam untuk OCR
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = dataUrl;
    });
    const maxDim = 1600;
    let w = img.naturalWidth || img.width;
    let h = img.naturalHeight || img.height;
    let sendDataUrl = dataUrl;
    if (w > maxDim || h > maxDim || !String(dataUrl).startsWith('data:image/jpeg')) {
      const s = Math.min(1, maxDim / Math.max(w, h));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(w * s));
      c.height = Math.max(1, Math.round(h * s));
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      sendDataUrl = c.toDataURL('image/jpeg', 0.9);
      c.width = c.height = 0;
    }

    return new Promise((resolve) => {
      window.__attaOcrPending = window.__attaOcrPending || {};
      window.__onAttaOcrResult =
        window.__onAttaOcrResult ||
        function (cbId, jsonStr) {
          const fn = window.__attaOcrPending && window.__attaOcrPending[cbId];
          if (fn) {
            delete window.__attaOcrPending[cbId];
            try {
              fn(JSON.parse(jsonStr || '{}'));
            } catch (_) {
              fn({ text: '', paragraphs: [], lines: [] });
            }
          }
        };
      const cbId = 'ocr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      const timer = setTimeout(() => {
        if (window.__attaOcrPending && window.__attaOcrPending[cbId]) {
          delete window.__attaOcrPending[cbId];
          resolve({ text: '', paragraphs: [], lines: [] });
        }
      }, 25000);
      window.__attaOcrPending[cbId] = (res) => {
        clearTimeout(timer);
        resolve(res || { text: '', paragraphs: [], lines: [] });
      };
      bridge.recognizeTextFromImage(sendDataUrl, cbId);
    });
  },

  async extractTextFromPdfBlob(blob, fallbackName = '', options = {}) {
    // Utamakan pdf.js (akurat untuk font tertanam & stream terkompresi)
    if (window.AttaPdfRender) {
      try {
        const res = await window.AttaPdfRender.extractText(blob);
        if (res && typeof res.text === 'string' && res.text.trim().length > 0) {
          return res.text.trim();
        }
      } catch (_) {
        /* lanjut ke pembaca cadangan di bawah */
      }
    }
    const ab = await blob.arrayBuffer();
    const rawBytes = new Uint8Array(ab);
    const bytesToLatin1 = (u8) => {
      let s = '';
      const step = 8192;
      for (let i = 0; i < u8.length; i += step) {
        s += String.fromCharCode.apply(null, u8.subarray(i, i + step));
      }
      return s;
    };
    const rawStr = bytesToLatin1(rawBytes);

    const extractedChunks = [];

    const decodeHexToken = (hexStr) => {
      const cleanHex = hexStr.replace(/\s+/g, '');
      if (cleanHex.length < 2) return '';
      let out = '';
      for (let i = 0; i + 1 < cleanHex.length; i += 2) {
        const code = parseInt(cleanHex.substr(i, 2), 16);
        if (!isNaN(code) && code >= 32 && code <= 255) {
          out += String.fromCharCode(code);
        }
      }
      return out.trim();
    };

    // 1. Ekstrak blok teks di antara BT .. ET (mendukung literal (...) dan hex <...>)
    const parseBtEt = (contentStr) => {
      const btRegex = /BT([\s\S]*?)ET/g;
      let match;
      while ((match = btRegex.exec(contentStr)) !== null) {
        const block = match[1];
        const lineParts = [];

        const strRegex = /\((?:\\.|[^\\()])*\)|<([0-9A-Fa-f\s]{2,})>/g;
        let sMatch;
        while ((sMatch = strRegex.exec(block)) !== null) {
          if (sMatch[1]) {
            const decodedHex = decodeHexToken(sMatch[1]);
            if (decodedHex) lineParts.push(decodedHex);
          } else {
            const token = sMatch[0]
              .slice(1, -1)
              .replace(/\\n/g, '\n')
              .replace(/\\r/g, ' ')
              .replace(/\\\(/g, '(')
              .replace(/\\\)/g, ')')
              .replace(/\\\\/g, '\\');
            if (token.trim()) lineParts.push(token.trim());
          }
        }
        if (lineParts.length > 0) {
          extractedChunks.push(lineParts.join(' '));
        }
      }
    };

    parseBtEt(rawStr);

    // 2. Dekompresi stream FlateDecode dengan penanganan error asinkron yang aman
    if (typeof DecompressionStream !== 'undefined') {
      const tryDecompress = async (chunk, format) => {
        try {
          const ds = new DecompressionStream(format);
          const decompressedStream = new Blob([chunk]).stream().pipeThrough(ds);
          const buf = await new Response(decompressedStream).arrayBuffer();
          return bytesToLatin1(new Uint8Array(buf));
        } catch (_) {
          return null;
        }
      };

      const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
      let stMatch;
      let streamCount = 0;
      while ((stMatch = streamRegex.exec(rawStr)) !== null && streamCount < 30) {
        streamCount++;
        const binStr = stMatch[1];
        if (binStr.length < 4 || binStr.length > 500000) continue;
        const chunk = new Uint8Array(binStr.length);
        for (let i = 0; i < binStr.length; i++) {
          chunk[i] = binStr.charCodeAt(i) & 0xff;
        }
        const inflated =
          (await tryDecompress(chunk, 'deflate')) ||
          (await tryDecompress(chunk, 'deflate-raw'));
        if (inflated) {
          parseBtEt(inflated);
        }
      }
    }

    const cleaned = extractedChunks
      .map((c) => c.replace(/[^\x20-\x7E\xA0-\xFF\n]/g, ' ').replace(/\s+/g, ' ').trim())
      .filter((c) => c.length > 1);

    if (cleaned.length > 0) {
      return Array.from(new Set(cleaned)).join('\n');
    }

    // Fallback OCR offline di dalam APK Android bila PDF berasal dari hasil scan kamera
    if (
      options.allowOcr !== false &&
      typeof window !== 'undefined' &&
      window.AttaNativeAndroid &&
      typeof window.AttaNativeAndroid.recognizeTextFromImage === 'function' &&
      window.AttaPdfRender &&
      typeof window.AttaPdfRender.exportPagesAsJpegs === 'function'
    ) {
      try {
        const rendered = await window.AttaPdfRender.exportPagesAsJpegs(blob, {
          scale: 1.6,
          quality: 0.86,
          maxPages: 12
        });
        const ocrChunks = [];
        for (const pg of rendered.pages || []) {
          const ocrRes = await this.runOfflineOcrOnBlob(pg.blob);
          if (ocrRes && ocrRes.text && ocrRes.text.trim()) {
            ocrChunks.push(ocrRes.text.trim());
          }
        }
        if (ocrChunks.length > 0) {
          return ocrChunks.join('\n\n');
        }
      } catch (_) {}
    }

    return '';
  },

  /** Ekstrak teks dari berkas Office (.docx, .xlsx) atau teks (.txt, .csv, .md) secara lokal */
  async extractTextFromOfficeFile(fileOrBlob, fileName = '') {
    const ext = (String(fileName || fileOrBlob?.name || '').split('.').pop() || '').toLowerCase();
    if (ext === 'docx') {
      const zip = await JSZip.loadAsync(fileOrBlob);
      const docXmlFile = zip.file('word/document.xml');
      if (!docXmlFile) throw new Error('Isi dokumen Word (.docx) tidak ditemukan.');
      const xmlText = await docXmlFile.async('string');
      const xmlDoc = new DOMParser().parseFromString(xmlText, 'application/xml');
      const pNodes = Array.from(xmlDoc.getElementsByTagName('w:p'));
      const lines = [];
      for (const p of pNodes) {
        const tNodes = Array.from(p.getElementsByTagName('w:t'));
        const line = tNodes.map((n) => n.textContent || '').join('').trim();
        if (line) lines.push(line);
      }
      return lines.join('\n');
    }
    if (ext === 'xlsx') {
      const zip = await JSZip.loadAsync(fileOrBlob);
      const sharedStrings = [];
      const sharedFile = zip.file('xl/sharedStrings.xml');
      if (sharedFile) {
        const sharedXml = await sharedFile.async('string');
        const sharedDoc = new DOMParser().parseFromString(sharedXml, 'application/xml');
        const siNodes = Array.from(sharedDoc.getElementsByTagName('si'));
        for (const si of siNodes) {
          const tNodes = Array.from(si.getElementsByTagName('t'));
          sharedStrings.push(tNodes.map((t) => t.textContent || '').join(''));
        }
      }
      const sheetFile =
        zip.file('xl/worksheets/sheet1.xml') ||
        Object.values(zip.files).find((f) => f.name.startsWith('xl/worksheets/sheet') && f.name.endsWith('.xml'));
      if (!sheetFile) throw new Error('Lembar kerja Excel (.xlsx) tidak ditemukan.');
      const sheetXml = await sheetFile.async('string');
      const sheetDoc = new DOMParser().parseFromString(sheetXml, 'application/xml');
      const rowNodes = Array.from(sheetDoc.getElementsByTagName('row'));
      const rows = [];
      for (const rNode of rowNodes) {
        const cNodes = Array.from(rNode.getElementsByTagName('c'));
        const vals = cNodes
          .map((c) => {
            const type = c.getAttribute('t');
            const vNode = c.getElementsByTagName('v')[0];
            const isNode = c.getElementsByTagName('is')[0];
            if (type === 's' && vNode) {
              const idx = parseInt(vNode.textContent || '0', 10);
              return sharedStrings[idx] || '';
            }
            if (type === 'inlineStr' && isNode) return isNode.textContent || '';
            return vNode ? vNode.textContent || '' : '';
          })
          .map((v) => v.trim())
          .filter(Boolean);
        if (vals.length > 0) rows.push(vals.join(' | '));
      }
      return rows.join('\n');
    }
    return await fileOrBlob.text();
  },

  /** Dokumen Word (.docx) asli: satu paragraf per baris teks */
  async buildDocxBlob(text, title) {
    const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const para = (t, bold = false) =>
      `<w:p><w:r>${bold ? '<w:rPr><w:b/><w:sz w:val="32"/></w:rPr>' : ''}<w:t xml:space="preserve">${esc(t)}</w:t></w:r></w:p>`;
    const body = [para(title, true)]
      .concat(String(text || '').split(/\r?\n/).map((l) => para(l)))
      .join('');
    const zip = new JSZip();
    zip.file(
      '[Content_Types].xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'
    );
    zip.file(
      '_rels/.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
    );
    zip.file(
      'word/document.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>`
    );
    return zip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
  },

  /** Dokumen Word (.docx) asli: menyisipkan halaman foto pindaian + teks OCR opsional */
  async buildDocxFromImages(pages, title = 'Dokumen Pindai', ocrTexts = []) {
    const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const para = (t, bold = false) =>
      `<w:p><w:r>${bold ? '<w:rPr><w:b/><w:sz w:val="28"/></w:rPr>' : ''}<w:t xml:space="preserve">${esc(t)}</w:t></w:r></w:p>`;

    const zip = new JSZip();
    const relEntries = [];
    const bodyParts = [para(title, true)];
    let hasPng = false;
    let hasJpg = false;

    for (let i = 0; i < pages.length; i++) {
      const pg = pages[i];
      const isPng = pg.mimeType === 'image/png' || (pg.dataUrl && pg.dataUrl.startsWith('data:image/png'));
      const ext = isPng ? 'png' : 'jpg';
      if (isPng) hasPng = true;
      else hasJpg = true;

      const mediaName = `page_${i + 1}.${ext}`;
      const rId = `rImg${i + 1}`;
      relEntries.push(
        `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${mediaName}"/>`
      );

      let imgBytes;
      if (pg.blob) {
        imgBytes = await pg.blob.arrayBuffer();
      } else {
        const b64 = String(pg.dataUrl || '').split(',')[1] || '';
        const bin = atob(b64);
        const u8 = new Uint8Array(bin.length);
        for (let k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k);
        imgBytes = u8;
      }
      zip.file(`word/media/${mediaName}`, imgBytes);

      const cx = 5600000;
      const aspect = (pg.height || 1400) / Math.max(1, pg.width || 1000);
      const cy = Math.min(7900000, Math.max(1500000, Math.round(cx * aspect)));
      const docPrId = i + 1;
      bodyParts.push(
        `<w:p><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${docPrId}" name="Halaman ${docPrId}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/picture/2006/picture"><pic:nvPicPr><pic:cNvPr id="${docPrId}" name="${mediaName}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`
      );

      const pageText = ocrTexts[i];
      if (pageText && String(pageText).trim()) {
        bodyParts.push(para(`--- Teks Halaman ${i + 1} ---`, true));
        for (const line of String(pageText).split(/\r?\n/)) {
          if (line.trim()) bodyParts.push(para(line.trim()));
        }
      }
    }

    const mediaDefaults = [
      hasJpg ? '<Default Extension="jpg" ContentType="image/jpeg"/>' : '',
      hasPng ? '<Default Extension="png" ContentType="image/png"/>' : ''
    ].join('');

    zip.file(
      '[Content_Types].xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${mediaDefaults}<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`
    );
    zip.file(
      '_rels/.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
    );
    zip.file(
      'word/_rels/document.xml.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relEntries.join('')}</Relationships>`
    );
    zip.file(
      'word/document.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/picture/2006/picture"><w:body>${bodyParts.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/></w:sectPr></w:body></w:document>`
    );
    return zip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
  },

  /** PDF multi-halaman dengan pilihan ukuran kertas (A4, Letter, Fit) & lapisan teks OCR tak terlihat */
  async buildMultiImagePdfWithOptions(pages, { pageSize = 'a4', ocrPages = [] } = {}) {
    const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
    const pdfDoc = await PDFDocument.create();
    const font = ocrPages && ocrPages.length ? await pdfDoc.embedFont(StandardFonts.Helvetica) : null;

    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      const isPng = p.mimeType === 'image/png' || (p.dataUrl && p.dataUrl.startsWith('data:image/png'));
      const img = isPng ? await pdfDoc.embedPng(p.dataUrl) : await pdfDoc.embedJpg(p.dataUrl);

      let pageW = 595.28;
      let pageH = 841.89;
      let margin = 24;
      if (pageSize === 'auto') {
        if ((p.width || 1) > (p.height || 1) * 1.08) {
          pageW = 841.89;
          pageH = 595.28;
        }
      } else if (pageSize === 'letter') {
        pageW = 612;
        pageH = 792;
      } else if (pageSize === 'fit') {
        pageW = 595.28;
        pageH = Math.max(200, Math.round(pageW * ((p.height || 1400) / Math.max(1, p.width || 1000))));
        margin = 0;
      }

      const page = pdfDoc.addPage([pageW, pageH]);
      const scale = Math.min((pageW - margin * 2) / p.width, (pageH - margin * 2) / p.height);
      const w = p.width * scale;
      const h = p.height * scale;
      const drawX = (pageW - w) / 2;
      const drawY = (pageH - h) / 2;
      page.drawImage(img, { x: drawX, y: drawY, width: w, height: h });

      const ocrPage = ocrPages && ocrPages[i];
      if (font && ocrPage && Array.isArray(ocrPage.lines)) {
        for (const ln of ocrPage.lines) {
          if (!ln || !ln.text) continue;
          const clean = String(ln.text).replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ').trim();
          if (!clean) continue;
          const boxH = Math.max(6, (ln.h || 0.02) * h);
          const fontSize = Math.min(24, Math.max(6, boxH * 0.82));
          const x = drawX + (ln.x || 0) * w;
          const y = drawY + h - ((ln.y || 0) + (ln.h || 0.02)) * h;
          try {
            page.drawText(clean, {
              x: Math.max(0, Math.min(pageW - 10, x)),
              y: Math.max(4, Math.min(pageH - 4, y)),
              size: fontSize,
              font,
              color: rgb(0, 0, 0),
              opacity: 0
            });
          } catch (_) {}
        }
      }
    }

    const bytes = await pdfDoc.save();
    return new Blob([bytes], { type: 'application/pdf' });
  },

  convertTextToOutputBlob(text, title, format = 'md') {
    const cleanTitle = (title || 'Dokumen').replace(/\.[^/.]+$/, '');

    if (format === 'doc' || format === 'docx') {
      return { ext: '.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', build: true };
    }

    if (format === 'csv') {
      const rows = text
        .split(/\r?\n/)
        .filter((l) => l.trim().length > 0)
        .map((line, i) => `${i + 1};"${line.replace(/"/g, '""')}"`);
      const csvContent = `Baris;Isi Teks Dokumen\n${rows.join('\n')}`;
      return {
        ext: '.csv',
        mime: 'text/csv',
        blob: new Blob([csvContent], { type: 'text/csv;charset=utf-8' })
      };
    }

    if (format === 'md') {
      const mdContent = this.convertToMarkdownLocally(text, cleanTitle);
      return {
        ext: '.md',
        mime: 'text/markdown',
        blob: new Blob([mdContent], { type: 'text/markdown;charset=utf-8' })
      };
    }

    return {
      ext: '.txt',
      mime: 'text/plain',
      blob: new Blob([text], { type: 'text/plain;charset=utf-8' })
    };
  },

  /* ==========================================================================
   * G. ANALISIS DOKUMEN HEURISTIK OFFLINE, RINGKASAN & GEMINI AI
   *    (Port dari AIAnalysisService di smart_scanner_app & AiIntelligenceService di PDF_New)
   * ========================================================================== */
  analyzeDocumentLocally(text) {
    const raw = String(text || '');
    const lower = raw.toLowerCase();

    let category = 'Dokumen Umum / Surat';
    if (
      lower.includes('nik') ||
      lower.includes('kartu tanda penduduk') ||
      lower.includes('gol. darah') ||
      lower.includes('rt/rw') ||
      lower.includes('ktp')
    ) {
      category = 'Kartu Identitas (KTP)';
    } else if (
      lower.includes('invoice') ||
      lower.includes('tagihan') ||
      lower.includes('jatuh tempo') ||
      lower.includes('faktur')
    ) {
      category = 'Faktur / Tagihan';
    } else if (
      lower.includes('kwitansi') ||
      lower.includes('kembalian') ||
      lower.includes('kasir') ||
      lower.includes('tunai') ||
      lower.includes('lunas') ||
      lower.includes('rp ')
    ) {
      category = 'Kwitansi / Bukti Pembayaran';
    } else if (
      lower.includes('perjanjian') ||
      lower.includes('pihak pertama') ||
      lower.includes('pihak kedua') ||
      lower.includes('pasal ') ||
      lower.includes('kontrak')
    ) {
      category = 'Kontrak / Perjanjian';
    } else if (
      lower.includes('surat keterangan') ||
      lower.includes('kepada yth') ||
      lower.includes('perihal') ||
      lower.includes('nomor:') ||
      lower.includes('dengan hormat')
    ) {
      category = 'Surat Resmi';
    }

    const nikMatches = Array.from(new Set(raw.match(/\b\d{16}\b/g) || []));
    const npwpMatches = Array.from(new Set(raw.match(/\b\d{2}\.\d{3}\.\d{3}\.\d-\d{3}\.\d{3}\b/g) || []));
    const emailMatches = Array.from(
      new Set(raw.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi) || [])
    );
    const phoneMatches = Array.from(new Set(raw.match(/(?:\+?62|0)[89]\d{7,11}\b/g) || []));
    const dateMatches = Array.from(
      new Set(
        raw.match(
          /\b\d{1,2}[-/\s](?:\d{1,2}|Jan(?:uari)?|Feb(?:ruari)?|Mar(?:et)?|Apr(?:il)?|Mei|Jun(?:i)?|Jul(?:i)?|Agu(?:stus)?|Sep(?:tember)?|Okt(?:ober)?|Nov(?:ember)?|Des(?:ember)?)[-/\s]\d{2,4}\b/gi
        ) || []
      )
    );
    const moneyMatches = Array.from(
      new Set(raw.match(/\b(?:Rp\.?|IDR)\s?\d{1,3}(?:[.,]\d{3})+(?:,\d{2})?\b/gi) || [])
    );

    const docNoMatches = [];
    const docNoRegex = /(?:Nomor|No\.?|Invoice|Ref)\s*[:#-]?\s*([A-Z0-9][A-Z0-9./-]{3,34})/gi;
    let m;
    while ((m = docNoRegex.exec(raw)) !== null && docNoMatches.length < 4) {
      if (/\d/.test(m[1])) docNoMatches.push(m[1].trim());
    }

    let subject = '';
    const subjMatch = raw.match(/(?:Perihal|Hal|Subject)\s*:\s*([^\r\n]{3,90})/i);
    if (subjMatch && subjMatch[1]) {
      subject = subjMatch[1].trim();
    }

    const words = raw.split(/\s+/).filter(Boolean);

    return {
      category,
      wordCount: words.length,
      charCount: raw.length,
      subject,
      docNumbers: Array.from(new Set(docNoMatches)),
      niks: nikMatches,
      npwps: npwpMatches,
      emails: emailMatches,
      phones: phoneMatches,
      dates: dateMatches,
      amounts: moneyMatches
    };
  },

  summarizeTextLocally(text) {
    const info = this.analyzeDocumentLocally(text);
    const lines = String(text || '')
      .split(/\r?\n/)
      .map((l) => l.replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    const catMap = {
      'Dokumen Umum / Surat': 'General document / letter',
      'Kartu Identitas (KTP)': 'ID card',
      'Faktur / Tagihan': 'Invoice / bill',
      'Kwitansi / Bukti Pembayaran': 'Receipt / proof of payment',
      'Kontrak / Perjanjian': 'Contract / agreement',
      'Surat Resmi': 'Official letter'
    };

    const out = [];
    out.push(`${L('Kategori Terdeteksi', 'Detected category')}: ${L(info.category, catMap[info.category] || info.category)}`);
    out.push(L(`Statistik: ${info.wordCount} kata, ${info.charCount} karakter`, `Stats: ${info.wordCount} words, ${info.charCount} characters`));

    if (info.subject) out.push(`${L('Perihal / Subjek', 'Subject')}: ${info.subject}`);
    if (info.docNumbers.length > 0) out.push(`${L('Nomor Dokumen', 'Document numbers')}: ${info.docNumbers.join(', ')}`);
    if (info.amounts.length > 0) out.push(`${L('Nominal Terdeteksi', 'Amounts')}: ${info.amounts.join(', ')}`);
    if (info.dates.length > 0) out.push(`${L('Tanggal Penting', 'Dates')}: ${info.dates.join(', ')}`);
    if (info.phones.length > 0) out.push(`${L('Nomor Telepon', 'Phone numbers')}: ${info.phones.join(', ')}`);
    if (info.emails.length > 0) out.push(`${L('Alamat Email', 'Email addresses')}: ${info.emails.join(', ')}`);
    if (info.niks.length > 0) out.push(`${L('Nomor Identitas (16 digit)', 'ID numbers (16 digits)')}: ${info.niks.join(', ')}`);
    if (info.npwps.length > 0) out.push(`NPWP: ${info.npwps.join(', ')}`);

    out.push('');
    out.push(L('Ringkasan Isi:', 'Summary:'));

    // Pilih kalimat/baris paling informatif (bukan sekadar 6 baris kop surat di awal)
    const cueRegex = /\b(bahwa|bertujuan|menyatakan|total|jumlah|pembayaran|tagihan|kesimpulan|berlaku|wajib|setuju|hasil|tanggal|sebesar|menerangkan|keputusan|summary|total|amount|therefore|agreed)\b/i;
    const scored = lines.map((line, idx) => {
      let score = 0;
      if (line.length >= 28 && line.length <= 220) score += 3;
      else if (line.length > 220) score += 1;
      if (cueRegex.test(line)) score += 4;
      if (/\b(?:Rp\.?|IDR|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\b/i.test(line)) score += 3;
      if (idx === 0 && line.length >= 10 && line.length <= 90) score += 2;
      if (/^(jl\.|jalan|telp|fax|email|website|http|www\.)/i.test(line)) score -= 5;
      return { line, idx, score };
    });

    const nonBoilerplate = scored.filter((item) => item.score >= 0);
    const pool = nonBoilerplate.length > 0 ? nonBoilerplate : scored;
    const picked = pool
      .slice()
      .sort((a, b) => b.score - a.score || a.idx - b.idx)
      .slice(0, 6)
      .sort((a, b) => a.idx - b.idx)
      .map((item) => item.line);

    for (const l of picked) {
      out.push(`- ${l}`);
    }
    return out.join('\n');
  },

  convertToMarkdownLocally(text, title = 'Dokumen Terstruktur') {
    const lines = String(text || '').split(/\r?\n/);
    const out = [`# ${title}`, ''];
    for (const raw of lines) {
      const trimmed = raw.trim();
      if (!trimmed) {
        out.push('');
        continue;
      }
      if (trimmed.length < 45 && !trimmed.endsWith('.')) {
        out.push(`## ${trimmed}`);
      } else {
        out.push(trimmed);
      }
    }
    return out.join('\n');
  },

  lastAnalysisMeta: { source: 'local', notice: '' },

  async processWithGeminiOrLocal({ text, mode = 'summarize', targetLang = 'Inggris', apiKey = '', allowExternal = false }) {
    const key = (apiKey || '').trim();
    if (!key || !allowExternal) {
      this.lastAnalysisMeta = { source: 'local', notice: '' };
      if (mode === 'translate') {
        if (key && !allowExternal) {
          return L(
            'Centang persetujuan pengiriman teks ke Google Gemini terlebih dahulu untuk menerjemahkan dokumen, atau gunakan mode Ringkasan untuk analisis lokal di perangkat.',
            'Check the consent box to send text to Google Gemini before translating, or use Summary mode for local on-device analysis.'
          );
        }
        return L(
          'Terjemahan butuh kunci API Gemini. Isi kuncinya di atas, atau pilih mode ringkasan untuk analisis di HP.',
          'Translation needs a Gemini API key. Enter it above, or choose summary mode to analyze on your phone.'
        );
      }
      if (mode === 'markdown') {
        return this.convertToMarkdownLocally(text);
      }
      return this.summarizeTextLocally(text);
    }

    const prompt =
      mode === 'translate'
        ? `Terjemahkan teks dokumen berikut secara akurat dan rapi ke bahasa ${targetLang}:\n\n${text.slice(0, 30000)}`
        : mode === 'markdown'
        ? `Ubah teks dokumen berikut menjadi format Markdown (.md) yang terstruktur:\n\n${text.slice(0, 30000)}`
        : `Buatkan ringkasan, poin penting, dan rincian entitas (tanggal, nominal, nama) dalam ${L('Bahasa Indonesia', 'English')} dari dokumen berikut:\n\n${text.slice(0, 30000)}`;

    const endpoint =
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
    let res;
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
    } catch (_) {
      this.lastAnalysisMeta = { source: 'local', notice: 'offline_fallback' };
      return `${L('Gemini tidak bisa dihubungi (tidak ada internet). Hasil di bawah dibuat di HP.', 'Gemini could not be reached (no internet). The result below was made on your phone.')}\n\n${this.summarizeTextLocally(text)}`;
    }

    if (!res.ok) {
      this.lastAnalysisMeta = { source: 'local', notice: 'api_error_fallback' };
      const reason = res.status === 400 || res.status === 403 ? L('kunci API tidak valid', 'invalid API key') : `${L('kode', 'code')} ${res.status}`;
      return `${L('Gemini menolak permintaan', 'Gemini rejected the request')} (${reason}). ${L('Hasil di bawah dibuat di HP.', 'The result below was made on your phone.')}\n\n${this.summarizeTextLocally(text)}`;
    }
    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const reply = parts.map((p) => p.text || '').join('\n').trim();
    if (!reply) {
      this.lastAnalysisMeta = { source: 'local', notice: 'empty_fallback' };
      return `${L('Gemini tidak mengembalikan jawaban. Hasil di bawah dibuat di HP.', 'Gemini returned no answer. The result below was made on your phone.')}\n\n${this.summarizeTextLocally(text)}`;
    }
    this.lastAnalysisMeta = { source: 'gemini', notice: '' };
    return reply;
  },

  /* ==========================================================================
   * H. BANDINGKAN 2 DOKUMEN PDF (Port dari ComparePdfScreen & TextDiff)
   * ========================================================================== */
  async compareTwoPdfFiles(fileA, fileB) {
    const { PDFDocument } = window.PDFLib;
    const [abA, abB] = await Promise.all([fileA.arrayBuffer(), fileB.arrayBuffer()]);
    const [docA, docB] = await Promise.all([
      PDFDocument.load(abA, { ignoreEncryption: true }),
      PDFDocument.load(abB, { ignoreEncryption: true })
    ]);

    const [textA, textB] = await Promise.all([
      this.extractTextFromPdfBlob(fileA, fileA.name || 'Dokumen A'),
      this.extractTextFromPdfBlob(fileB, fileB.name || 'Dokumen B')
    ]);

    const linesA = textA.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    const linesB = textB.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);

    const setA = new Set(linesA);
    const setB = new Set(linesB);

    const added = linesB.filter((x) => !setA.has(x));
    const removed = linesA.filter((x) => !setB.has(x));
    const sameCount = linesA.filter((x) => setB.has(x)).length;

    const report = [
      `Berkas A: ${fileA.name || 'Dokumen A'} (${docA.getPageCount()} halaman, ${Math.round(fileA.size / 1024)} KB)`,
      `Berkas B: ${fileB.name || 'Dokumen B'} (${docB.getPageCount()} halaman, ${Math.round(fileB.size / 1024)} KB)`,
      `Baris identik: ${sameCount} baris`,
      `Baris baru di Berkas B: ${added.length} baris`,
      `Baris yang dihapus dari Berkas A: ${removed.length} baris`
    ];

    if (linesA.length === 0 && linesB.length === 0) {
      report.push('', 'Catatan: Kedua PDF berisi gambar hasil pindaian tanpa lapisan teks yang bisa dibandingkan baris demi baris.');
    } else if (linesA.length === 0 || linesB.length === 0) {
      report.push('', 'Catatan: Salah satu PDF berisi gambar pindaian tanpa lapisan teks.');
    }

    if (added.length > 0) {
      report.push('', 'Contoh Penambahan di Berkas B:');
      added.slice(0, 4).forEach((l) => report.push(`+ ${l}`));
    }
    if (removed.length > 0) {
      report.push('', 'Contoh Penghapusan dari Berkas A:');
      removed.slice(0, 4).forEach((l) => report.push(`- ${l}`));
    }

    return report.join('\n');
  }
};

window.AttaToolsEngine = AttaToolsEngine;
