import { readFile, writeFile, mkdir } from 'node:fs/promises';
import zlib from 'node:zlib';

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
    table[n] = c;
  }
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  return (crc ^ (-1)) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  const crc = crc32(Buffer.concat([typeBuf, data]));
  crcBuf.writeUInt32BE(crc, 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

export function encodePNG(width, height, rgbaBuffer) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // 8-bit depth
  ihdrData.writeUInt8(6, 9); // RGBA (color type 6)
  ihdrData.writeUInt8(0, 10);
  ihdrData.writeUInt8(0, 11);
  ihdrData.writeUInt8(0, 12);
  const ihdr = makeChunk('IHDR', ihdrData);

  const stride = 1 + width * 4;
  const raw = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0; // Filter None
    rgbaBuffer.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = makeChunk('IDAT', zlib.deflateSync(raw));
  const iend = makeChunk('IEND', Buffer.alloc(0));
  return Buffer.concat([sig, ihdr, idat, iend]);
}

export function unfilterPNG(buf) {
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  let offset = 8;
  const idat = [];
  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') idat.push(buf.subarray(offset + 8, offset + 8 + len));
    offset += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = 4;
  const stride = 1 + w * bpp;
  const out = Buffer.alloc(w * h * bpp);

  function paeth(a, b, c) {
    const p = a + b - c;
    const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
  }

  for (let y = 0; y < h; y++) {
    const filter = raw[y * stride];
    const prevRow = (y - 1) * w * bpp;
    const currRow = y * w * bpp;
    const rawOff = y * stride + 1;

    for (let x = 0; x < w * bpp; x++) {
      const val = raw[rawOff + x];
      const a = (x >= bpp) ? out[currRow + x - bpp] : 0;
      const b = (y > 0) ? out[prevRow + x] : 0;
      const c = (y > 0 && x >= bpp) ? out[prevRow + x - bpp] : 0;
      let r = 0;
      if (filter === 0) r = val;
      else if (filter === 1) r = (val + a) & 0xff;
      else if (filter === 2) r = (val + b) & 0xff;
      else if (filter === 3) r = (val + Math.floor((a + b) / 2)) & 0xff;
      else if (filter === 4) r = (val + paeth(a, b, c)) & 0xff;
      out[currRow + x] = r;
    }
  }
  return { w, h, out };
}

async function main() {
  await mkdir('public/brand-assets', { recursive: true });

  const darkMaster = await readFile('public/brand-assets/media_1792436491177.png');
  const orangeMaster = await readFile('public/brand-assets/media_1792436491163.png');
  const whiteMaster = await readFile('public/brand-assets/media_1792436491153.png');

  // Copy standard named master images
  await writeFile('public/brand-assets/vallyron-logo-black-bg.png', darkMaster);
  await writeFile('public/brand-assets/vallyron-logo-orange-bg.png', orangeMaster);

  const { w, h, out } = unfilterPNG(darkMaster);

  // Full Logo Lockup Crop: minX 319, maxX 757, minY 317, maxY 749
  const pad = 40;
  const minX = Math.max(0, 319 - pad);
  const maxX = Math.min(w - 1, 757 + pad);
  const minY = Math.max(0, 317 - pad);
  const maxY = Math.min(h - 1, 749 + pad);
  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;

  const darkLogoBuf = Buffer.alloc(cropW * cropH * 4);
  const whiteLogoBuf = Buffer.alloc(cropW * cropH * 4);
  const orangeLogoBuf = Buffer.alloc(cropW * cropH * 4);

  for (let y = 0; y < cropH; y++) {
    for (let x = 0; x < cropW; x++) {
      const srcX = minX + x;
      const srcY = minY + y;
      const srcIdx = (srcY * w + srcX) * 4;
      const dstIdx = (y * cropW + x) * 4;
      const lum = Math.round(0.299 * out[srcIdx] + 0.587 * out[srcIdx+1] + 0.114 * out[srcIdx+2]);

      // Dark logo (#111111) with alpha
      darkLogoBuf[dstIdx] = 17;
      darkLogoBuf[dstIdx+1] = 17;
      darkLogoBuf[dstIdx+2] = 17;
      darkLogoBuf[dstIdx+3] = lum;

      // White logo (#FFFFFF) with alpha
      whiteLogoBuf[dstIdx] = 255;
      whiteLogoBuf[dstIdx+1] = 255;
      whiteLogoBuf[dstIdx+2] = 255;
      whiteLogoBuf[dstIdx+3] = lum;

      // Orange logo (#F45D22) with alpha
      orangeLogoBuf[dstIdx] = 244;
      orangeLogoBuf[dstIdx+1] = 93;
      orangeLogoBuf[dstIdx+2] = 34;
      orangeLogoBuf[dstIdx+3] = lum;
    }
  }

  await writeFile('public/brand-assets/vallyron-logo-dark.png', encodePNG(cropW, cropH, darkLogoBuf));
  await writeFile('public/brand-assets/vallyron-logo-white.png', encodePNG(cropW, cropH, whiteLogoBuf));
  await writeFile('public/brand-assets/vallyron-logo-orange.png', encodePNG(cropW, cropH, orangeLogoBuf));

  // Generate Beige / Sand Background 1024x1024 logo (#DDD5CB background)
  const beige1024 = Buffer.alloc(1024 * 1024 * 4);
  for (let i = 0; i < 1024 * 1024; i++) {
    beige1024[i * 4] = 0xdd;
    beige1024[i * 4 + 1] = 0xd5;
    beige1024[i * 4 + 2] = 0xcb;
    beige1024[i * 4 + 3] = 0xff;
  }
  // Composite dark logo onto beige background
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const srcIdx = (y * w + x) * 4;
      const dstIdx = (y * 1024 + x) * 4;
      const lum = Math.round(0.299 * out[srcIdx] + 0.587 * out[srcIdx+1] + 0.114 * out[srcIdx+2]);
      const alpha = lum / 255;
      if (alpha > 0) {
        beige1024[dstIdx] = Math.round(17 * alpha + 0xdd * (1 - alpha));
        beige1024[dstIdx+1] = Math.round(17 * alpha + 0xd5 * (1 - alpha));
        beige1024[dstIdx+2] = Math.round(17 * alpha + 0xcb * (1 - alpha));
      }
    }
  }
  await writeFile('public/brand-assets/vallyron-logo-beige-bg.png', encodePNG(1024, 1024, beige1024));

  // Generate Pure White Background 1024x1024 logo
  const white1024 = Buffer.alloc(1024 * 1024 * 4);
  for (let i = 0; i < 1024 * 1024; i++) {
    white1024[i * 4] = 0xff;
    white1024[i * 4 + 1] = 0xff;
    white1024[i * 4 + 2] = 0xff;
    white1024[i * 4 + 3] = 0xff;
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const srcIdx = (y * w + x) * 4;
      const dstIdx = (y * 1024 + x) * 4;
      const lum = Math.round(0.299 * out[srcIdx] + 0.587 * out[srcIdx+1] + 0.114 * out[srcIdx+2]);
      const alpha = lum / 255;
      if (alpha > 0) {
        white1024[dstIdx] = Math.round(17 * alpha + 255 * (1 - alpha));
        white1024[dstIdx+1] = Math.round(17 * alpha + 255 * (1 - alpha));
        white1024[dstIdx+2] = Math.round(17 * alpha + 255 * (1 - alpha));
      }
    }
  }
  await writeFile('public/brand-assets/vallyron-logo-white-bg.png', encodePNG(1024, 1024, white1024));

  // Isolated Monogram VR Crop: minX 334, maxX 701, minY 317, maxY 566
  const mPad = 16;
  const mMinX = Math.max(0, 334 - mPad);
  const mMaxX = Math.min(w - 1, 701 + mPad);
  const mMinY = Math.max(0, 317 - mPad);
  const mMaxY = Math.min(h - 1, 566 + mPad);
  const mCropW = mMaxX - mMinX + 1;
  const mCropH = mMaxY - mMinY + 1;

  const markDark = Buffer.alloc(mCropW * mCropH * 4);
  const markWhite = Buffer.alloc(mCropW * mCropH * 4);
  const markOrange = Buffer.alloc(mCropW * mCropH * 4);

  for (let y = 0; y < mCropH; y++) {
    for (let x = 0; x < mCropW; x++) {
      const srcIdx = ((mMinY + y) * w + (mMinX + x)) * 4;
      const dstIdx = (y * mCropW + x) * 4;
      const lum = Math.round(0.299 * out[srcIdx] + 0.587 * out[srcIdx+1] + 0.114 * out[srcIdx+2]);

      markDark[dstIdx] = 17;
      markDark[dstIdx+1] = 17;
      markDark[dstIdx+2] = 17;
      markDark[dstIdx+3] = lum;

      markWhite[dstIdx] = 255;
      markWhite[dstIdx+1] = 255;
      markWhite[dstIdx+2] = 255;
      markWhite[dstIdx+3] = lum;

      markOrange[dstIdx] = 244;
      markOrange[dstIdx+1] = 93;
      markOrange[dstIdx+2] = 34;
      markOrange[dstIdx+3] = lum;
    }
  }

  await writeFile('public/brand-assets/vallyron-mark-dark.png', encodePNG(mCropW, mCropH, markDark));
  await writeFile('public/brand-assets/vallyron-mark-white.png', encodePNG(mCropW, mCropH, markWhite));
  await writeFile('public/brand-assets/vallyron-mark-orange.png', encodePNG(mCropW, mCropH, markOrange));

  // Generate smooth vector path for VR monogram
  const mW = 368, mH = 250;
  const grid = Array.from({length: mH}, () => new Uint8Array(mW));

  for (let y = 0; y < mH; y++) {
    for (let x = 0; x < mW; x++) {
      const srcX = 334 + x;
      const srcY = 317 + y;
      const idx = (srcY * w + srcX) * 4;
      grid[y][x] = out[idx] > 115 ? 1 : 0;
    }
  }

  function traceBoundary(isInsideFn) {
    let startX = -1, startY = -1;
    for (let y = 0; y < mH; y++) {
      for (let x = 0; x < mW; x++) {
        if (isInsideFn(x, y)) {
          startX = x;
          startY = y;
          break;
        }
      }
      if (startX !== -1) break;
    }
    if (startX === -1) return [];

    const dirs = [
      [1, 0], [1, 1], [0, 1], [-1, 1],
      [-1, 0], [-1, -1], [0, -1], [1, -1]
    ];

    const contour = [];
    let currX = startX, currY = startY;
    let dir = 7;

    contour.push([currX, currY]);

    let steps = 0;
    while (steps < 20000) {
      steps++;
      let found = false;
      let nextDir = (dir + 5) % 8;
      for (let i = 0; i < 8; i++) {
        const checkDir = (nextDir + i) % 8;
        const nx = currX + dirs[checkDir][0];
        const ny = currY + dirs[checkDir][1];
        if (nx >= 0 && nx < mW && ny >= 0 && ny < mH && isInsideFn(nx, ny)) {
          currX = nx;
          currY = ny;
          dir = checkDir;
          found = true;
          break;
        }
      }
      if (!found) break;
      if (currX === startX && currY === startY) break;
      contour.push([currX, currY]);
    }
    return contour;
  }

  const vPolygon = "M 0 0 L 68.5 0 L 134.5 166 L 104.5 248 Z";
  const stemPolygon = "M 173 0 L 231.5 0 L 231.5 242 L 173 242 Z";
  const rContour = traceBoundary((x, y) => grid[y][x] === 1 && x >= 245);

  const smoothedR = [];
  const N = rContour.length;
  for (let i = 0; i < N; i++) {
    let sumX = 0, sumY = 0;
    const k = 2;
    for (let j = -k; j <= k; j++) {
      const idx = (i + j + N) % N;
      sumX += rContour[idx][0];
      sumY += rContour[idx][1];
    }
    smoothedR.push([+(sumX / (2 * k + 1)).toFixed(1), +(sumY / (2 * k + 1)).toFixed(1)]);
  }

  function rdp(points, epsilon) {
    if (points.length <= 2) return points;
    let maxDist = 0;
    let index = 0;
    const [x1, y1] = points[0];
    const [x2, y2] = points[points.length - 1];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;

    for (let i = 1; i < points.length - 1; i++) {
      const [x, y] = points[i];
      let dist = 0;
      if (lenSq === 0) {
        dist = Math.hypot(x - x1, y - y1);
      } else {
        const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lenSq));
        const projX = x1 + t * dx;
        const projY = y1 + t * dy;
        dist = Math.hypot(x - projX, y - projY);
      }
      if (dist > maxDist) {
        maxDist = dist;
        index = i;
      }
    }

    if (maxDist > epsilon) {
      const rec1 = rdp(points.slice(0, index + 1), epsilon);
      const rec2 = rdp(points.slice(index), epsilon);
      return rec1.slice(0, -1).concat(rec2);
    } else {
      return [points[0], points[points.length - 1]];
    }
  }

  const rSimplified = rdp(smoothedR, 0.45);
  const rPath = `M ${rSimplified[0][0]} ${rSimplified[0][1]} ` + rSimplified.slice(1).map(([x,y]) => `L ${x} ${y}`).join(' ') + ' Z';
  const markD = `${vPolygon} ${stemPolygon} ${rPath}`;

  const markSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 368 250" fill="currentColor" aria-hidden="true"><path d="${markD}" fill-rule="evenodd"/></svg>`;
  await writeFile('public/brand-assets/vallyron-mark.svg', markSvg);
  await writeFile('public/brand-mark.svg', markSvg);

  // Favicon SVG with rounded background and smooth official monogram
  const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#111111"/><svg x="10" y="15" width="44" height="34" viewBox="0 0 368 250" fill="#FAFAF8"><path d="${markD}" fill-rule="evenodd"/></svg></svg>`;
  await writeFile('public/favicon.svg', faviconSvg);

  // Full brand lockup SVG with smooth monogram and crisp typography
  const fullLogoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 440 434" fill="currentColor" aria-label="Vallyron Technologies">
    <svg x="36" y="0" width="368" height="250" viewBox="0 0 368 250">
      <path d="${markD}" fill-rule="evenodd"/>
    </svg>
    <text x="220" y="348" text-anchor="middle" font-family="'Poppins', 'Arial', sans-serif" font-weight="700" font-size="28" letter-spacing="13">VALLYRON</text>
    <line x1="0" y1="380" x2="440" y2="380" stroke="currentColor" stroke-width="2.5"/>
    <text x="220" y="426" text-anchor="middle" font-family="'Poppins', 'Arial', sans-serif" font-weight="700" font-size="19" letter-spacing="10">TECHNOLOGIES</text>
  </svg>`;
  await writeFile('public/brand-assets/vallyron-logo.svg', fullLogoSvg);

  console.log('Brand asset generation complete!');
}

main().catch(err => {
  console.error('Failed to generate brand assets:', err);
  process.exit(1);
});
