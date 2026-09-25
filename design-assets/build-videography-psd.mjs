import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { execFileSync } from "node:child_process";

const root = "/Users/cathyzhang/Documents/Codex/2026-07-20/hi-2/outputs/portfolio-home";
const outDir = path.join(root, "design-assets");
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "videography-psd-"));
const W = 1440;
const H = 900;

function be16(n) {
  const b = Buffer.alloc(2);
  b.writeUInt16BE(n >>> 0);
  return b;
}

function be16s(n) {
  const b = Buffer.alloc(2);
  b.writeInt16BE(n);
  return b;
}

function be32(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n >>> 0);
  return b;
}

function be32s(n) {
  const b = Buffer.alloc(4);
  b.writeInt32BE(n);
  return b;
}

function rgba(hex, alpha = 255) {
  const value = hex.replace("#", "");
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
    alpha,
  ];
}

function blank(width, height) {
  return { width, height, data: new Uint8Array(width * height * 4) };
}

function solid(width, height, color) {
  const image = blank(width, height);
  for (let i = 0; i < width * height; i++) image.data.set(color, i * 4);
  return image;
}

function parsePNG(file) {
  const buffer = fs.readFileSync(file);
  if (buffer.subarray(1, 4).toString() !== "PNG") throw new Error(`Not a PNG: ${file}`);
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString();
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    offset += length + 12;
  }
  if (bitDepth !== 8 || interlace !== 0 || ![0, 2, 4, 6].includes(colorType)) {
    throw new Error(`Unsupported PNG format: depth=${bitDepth}, type=${colorType}, interlace=${interlace}`);
  }
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const recon = Buffer.alloc(stride * height);
  let source = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[source++];
    const row = y * stride;
    for (let x = 0; x < stride; x++) {
      const value = raw[source++];
      const left = x >= channels ? recon[row + x - channels] : 0;
      const up = y > 0 ? recon[row - stride + x] : 0;
      const upLeft = y > 0 && x >= channels ? recon[row - stride + x - channels] : 0;
      let result;
      if (filter === 0) result = value;
      else if (filter === 1) result = (value + left) & 255;
      else if (filter === 2) result = (value + up) & 255;
      else if (filter === 3) result = (value + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        result = (value + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft)) & 255;
      } else throw new Error(`Unsupported PNG filter ${filter}`);
      recon[row + x] = result;
    }
  }
  const out = new Uint8Array(width * height * 4);
  for (let i = 0, p = 0; i < width * height; i++) {
    if (colorType === 6) {
      out.set(recon.subarray(p, p + 4), i * 4);
      p += 4;
    } else if (colorType === 2) {
      out.set([recon[p], recon[p + 1], recon[p + 2], 255], i * 4);
      p += 3;
    } else if (colorType === 4) {
      out.set([recon[p], recon[p], recon[p], recon[p + 1]], i * 4);
      p += 2;
    } else {
      out.set([recon[p], recon[p], recon[p], 255], i * 4);
      p += 1;
    }
  }
  return { width, height, data: out };
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const content = Buffer.concat([typeBuffer, data]);
  return Buffer.concat([be32(data.length), content, be32(crc32(content))]);
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function writePNG(file, image) {
  const rows = [];
  for (let y = 0; y < image.height; y++) {
    rows.push(Buffer.from([0]));
    rows.push(Buffer.from(image.data.buffer, image.data.byteOffset + y * image.width * 4, image.width * 4));
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(image.width, 0);
  ihdr.writeUInt32BE(image.height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return fs.writeFileSync(
    file,
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      pngChunk("IHDR", ihdr),
      pngChunk("IDAT", zlib.deflateSync(Buffer.concat(rows), { level: 6 })),
      pngChunk("IEND", Buffer.alloc(0)),
    ])
  );
}

function imageInfo(file) {
  const output = execFileSync("/usr/bin/sips", ["-g", "pixelWidth", "-g", "pixelHeight", file], { encoding: "utf8" });
  const width = Number(output.match(/pixelWidth:\s*(\d+)/)?.[1]);
  const height = Number(output.match(/pixelHeight:\s*(\d+)/)?.[1]);
  return { width, height };
}

function coverImage(relativePath, targetW, targetH, grayscale = false) {
  const source = path.join(root, relativePath);
  const sourceInfo = imageInfo(source);
  const sourceRatio = sourceInfo.width / sourceInfo.height;
  const targetRatio = targetW / targetH;
  let cropW = sourceInfo.width;
  let cropH = sourceInfo.height;
  if (sourceRatio > targetRatio) cropW = Math.round(sourceInfo.height * targetRatio);
  else cropH = Math.round(sourceInfo.width / targetRatio);
  const file = path.join(tempDir, `cover-${Math.random().toString(36).slice(2)}.png`);
  execFileSync("/usr/bin/sips", [
    "--cropToHeightWidth",
    String(cropH),
    String(cropW),
    "--resampleHeightWidth",
    String(targetH),
    String(targetW),
    "-s",
    "format",
    "png",
    source,
    "--out",
    file,
  ], { stdio: "ignore" });
  const image = parsePNG(file);
  if (grayscale) {
    for (let i = 0; i < image.data.length; i += 4) {
      const gray = Math.round(image.data[i] * 0.299 + image.data[i + 1] * 0.587 + image.data[i + 2] * 0.114);
      image.data[i] = image.data[i + 1] = image.data[i + 2] = gray;
    }
  }
  return image;
}

function rotateImage(image, degrees) {
  if (!degrees) return image;
  const angle = (degrees * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const outW = Math.ceil(Math.abs(image.width * cos) + Math.abs(image.height * sin));
  const outH = Math.ceil(Math.abs(image.height * cos) + Math.abs(image.width * sin));
  const out = blank(outW, outH);
  const sxCenter = (image.width - 1) / 2;
  const syCenter = (image.height - 1) / 2;
  const dxCenter = (outW - 1) / 2;
  const dyCenter = (outH - 1) / 2;
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const dx = x - dxCenter;
      const dy = y - dyCenter;
      const sx = Math.round(dx * cos + dy * sin + sxCenter);
      const sy = Math.round(-dx * sin + dy * cos + syCenter);
      if (sx >= 0 && sx < image.width && sy >= 0 && sy < image.height) {
        const si = (sy * image.width + sx) * 4;
        const di = (y * outW + x) * 4;
        out.data.set(image.data.subarray(si, si + 4), di);
      }
    }
  }
  return out;
}

function textImage(text, x, baseline, size, options = {}) {
  const {
    family = "Times New Roman",
    style = "normal",
    weight = "normal",
    fill = "#11110f",
    anchor = "start",
    letterSpacing = 0,
  } = options;
  const glyphs = {
    A:["01110","10001","10001","11111","10001","10001","10001"],B:["11110","10001","10001","11110","10001","10001","11110"],
    C:["01111","10000","10000","10000","10000","10000","01111"],D:["11110","10001","10001","10001","10001","10001","11110"],
    E:["11111","10000","10000","11110","10000","10000","11111"],F:["11111","10000","10000","11110","10000","10000","10000"],
    G:["01111","10000","10000","10111","10001","10001","01111"],H:["10001","10001","10001","11111","10001","10001","10001"],
    I:["11111","00100","00100","00100","00100","00100","11111"],J:["00111","00010","00010","00010","10010","10010","01100"],
    K:["10001","10010","10100","11000","10100","10010","10001"],L:["10000","10000","10000","10000","10000","10000","11111"],
    M:["10001","11011","10101","10101","10001","10001","10001"],N:["10001","11001","10101","10011","10001","10001","10001"],
    O:["01110","10001","10001","10001","10001","10001","01110"],P:["11110","10001","10001","11110","10000","10000","10000"],
    Q:["01110","10001","10001","10001","10101","10010","01101"],R:["11110","10001","10001","11110","10100","10010","10001"],
    S:["01111","10000","10000","01110","00001","00001","11110"],T:["11111","00100","00100","00100","00100","00100","00100"],
    U:["10001","10001","10001","10001","10001","10001","01110"],V:["10001","10001","10001","10001","10001","01010","00100"],
    W:["10001","10001","10001","10101","10101","10101","01010"],X:["10001","10001","01010","00100","01010","10001","10001"],
    Y:["10001","10001","01010","00100","00100","00100","00100"],Z:["11111","00001","00010","00100","01000","10000","11111"],
    "0":["01110","10001","10011","10101","11001","10001","01110"],"1":["00100","01100","00100","00100","00100","00100","01110"],
    "2":["01110","10001","00001","00010","00100","01000","11111"],"3":["11110","00001","00001","01110","00001","00001","11110"],
    "4":["00010","00110","01010","10010","11111","00010","00010"],"5":["11111","10000","10000","11110","00001","00001","11110"],
    "6":["01110","10000","10000","11110","10001","10001","01110"],"7":["11111","00001","00010","00100","01000","01000","01000"],
    "8":["01110","10001","10001","01110","10001","10001","01110"],"9":["01110","10001","10001","01111","00001","00001","01110"],
    "/":["00001","00010","00010","00100","01000","01000","10000"],"-":["00000","00000","00000","11111","00000","00000","00000"],
    ":":["00000","00100","00100","00000","00100","00100","00000"],"↔":["00100","01000","11111","01000","00100","00000","00000"],
    " ":["000","000","000","000","000","000","000"],
  };
  const baseScaleX = Math.max(1, size / 12);
  const baseScaleY = Math.max(1, size / 7);
  const chars = [...text];
  const metrics = chars.map((character) => {
    const isLower = character >= "a" && character <= "z";
    const scale = isLower ? 0.78 : 1;
    const glyph = glyphs[character.toUpperCase()] || glyphs[" "];
    let min = glyph[0].length;
    let max = -1;
    for (const row of glyph) for (let c = 0; c < row.length; c++) if (row[c] === "1") { min = Math.min(min, c); max = Math.max(max, c); }
    const columns = max >= min ? max - min + 1 : 3;
    return { character, glyph, min: max >= min ? min : 0, columns, scale, advance: columns * baseScaleX * scale + baseScaleX + letterSpacing };
  });
  const totalWidth = Math.max(1, Math.ceil(metrics.reduce((sum, item) => sum + item.advance, 0) - baseScaleX));
  const totalHeight = Math.max(1, Math.ceil(size * 1.12));
  const image = blank(totalWidth + Math.ceil(size * 0.2), totalHeight);
  const color = rgba(fill);
  let cursor = 0;
  for (const metric of metrics) {
    const sx = baseScaleX * metric.scale;
    const sy = baseScaleY * metric.scale;
    const glyphHeight = 7 * sy;
    const top = totalHeight - glyphHeight;
    for (let row = 0; row < 7; row++) {
      for (let column = 0; column < metric.columns; column++) {
        if (metric.glyph[row][metric.min + column] !== "1") continue;
        const italicShift = style === "italic" ? (6 - row) * sx * 0.34 : 0;
        const startX = Math.round(cursor + column * sx + italicShift);
        const endX = Math.min(image.width, Math.ceil(cursor + (column + 1) * sx + italicShift));
        const startY = Math.round(top + row * sy);
        const endY = Math.min(image.height, Math.ceil(top + (row + 1) * sy));
        for (let py = startY; py < endY; py++) for (let px = startX; px < endX; px++) image.data.set(color, (py * image.width + px) * 4);
      }
    }
    cursor += metric.advance;
  }
  image.left = Math.round(anchor === "end" ? x - totalWidth : anchor === "middle" ? x - totalWidth / 2 : x);
  image.top = Math.round(baseline - totalHeight);
  return image;
}

function cropTransparent(image) {
  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (image.data[(y * image.width + x) * 4 + 3] > 0) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  if (maxX < minX) return { ...blank(1, 1), left: 0, top: 0 };
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const out = blank(width, height);
  for (let y = 0; y < height; y++) {
    const start = ((minY + y) * image.width + minX) * 4;
    out.data.set(image.data.subarray(start, start + width * 4), y * width * 4);
  }
  out.left = minX;
  out.top = minY;
  return out;
}

function rectImage(width, height, color) {
  return solid(Math.max(1, Math.round(width)), Math.max(1, Math.round(height)), color);
}

function orbitArcImage() {
  const out = blank(W, H);
  const centerX = -489.6;
  const centerY = 492;
  const rx = 1209.6;
  const ry = 359;
  const color = rgba("#6f6d68", 95);
  for (let t = -1.20; t <= 1.20; t += 0.0008) {
    const x = Math.round(centerX + Math.cos(t) * rx);
    const y = Math.round(centerY + Math.sin(t) * ry);
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        if (x + ox >= 0 && x + ox < W && y + oy >= 0 && y + oy < H) {
          out.data.set(color, ((y + oy) * W + x + ox) * 4);
        }
      }
    }
  }
  return cropTransparent(out);
}

const layers = [];

function addLayer(name, image, left = 0, top = 0, opacity = 255) {
  layers.push({ name, image, left: Math.round(left), top: Math.round(top), opacity: Math.round(opacity) });
}

function addTextLayer(name, text, x, baseline, size, options = {}) {
  const image = textImage(text, x, baseline, size, options);
  addLayer(name, image, image.left ?? 0, image.top ?? 0);
}

addLayer("01 Background - Warm Beige", solid(W, H, rgba("#f4f3ef")), 0, 0);
addLayer("02 Navigation - Divider Line", rectImage(1370, 1, rgba("#5f5e5a", 158)), 35, 82);
addTextLayer("03 Navigation Text - Home", "Home", 66, 61, 22);
addTextLayer("04 Navigation Text - Photography", "Photography", 358, 61, 22);
addTextLayer("05 Navigation Text - Videography", "Videography", 690, 61, 22, { weight: "bold" });
addTextLayer("06 Navigation Text - Graphic Design", "Graphic Design", 970, 61, 22);
addTextLayer("07 Navigation Text - About", "About", 1327, 61, 22, { anchor: "end" });

const arc = orbitArcImage();
addLayer("08 Element - Orbit Line", arc, arc.left, arc.top);

const films = [
  ["Surveillance", "assets/videography/surveillance/poster.jpg"],
  ["Bad Film", "assets/videography/bad-film/cover.jpg"],
  ["White Christmas", "assets/videography/white-christmas/cover.jpg"],
  ["Roaming", "assets/videography/roaming/cover.jpg"],
  ["Kinoeyes", "assets/videography/kinoeyes/cover.jpg"],
  ["Loading", "assets/videography/loading/still-01.jpg"],
  ["Escape", "assets/videography/escape/still-01.jpg"],
];
const step = (Math.PI * 2) / films.length;
const filmLayers = [];
for (let index = 0; index < films.length; index++) {
  const angle = index * step;
  const depth = (Math.cos(angle) + 1) / 2;
  const centerX = -489.6 + Math.cos(angle) * 1209.6;
  const centerY = 492 + Math.sin(angle) * 359;
  const scale = 0.58 + depth * 0.86;
  const width = Math.round(244.8 * scale);
  const height = Math.round(width * 0.75);
  let image = coverImage(films[index][1], width, height, index !== 0);
  image = rotateImage(image, Math.sin(angle) * -6);
  filmLayers.push({
    name: `Film Cover ${String(index + 1).padStart(2, "0")} - ${films[index][0]}`,
    image,
    left: centerX - image.width / 2,
    top: centerY - image.height / 2,
    opacity: Math.round((0.22 + depth * 0.78) * 255),
    depth,
  });
}
filmLayers.sort((a, b) => a.depth - b.depth).forEach((layer) => addLayer(layer.name, layer.image, layer.left, layer.top, layer.opacity));

addTextLayer("16 Active Project - Category", "FICTIONAL SHORT FILM", 53, 440, 10, { family: "Arial", letterSpacing: 1.4 });
addTextLayer("17 Active Project - Title", "Surveillance", 53, 503, 58, { style: "italic" });
addTextLayer("18 Active Project - Runtime", "01:07", 53, 539, 10, { family: "Arial", letterSpacing: 1.4 });

const projectNames = ["SURVEILLANCE", "BAD FILM", "WHITE CHRISTMAS", "ROAMING", "KINOEYES", "LOADING", "ESCAPE"];
for (let i = 0; i < projectNames.length; i++) {
  addTextLayer(`Project Index ${String(i + 1).padStart(2, "0")} - ${projectNames[i]}`, projectNames[i], 1386, 129 + i * 18, 10, {
    family: "Arial",
    fill: i === 0 ? "#11110f" : "#aaa9a5",
    anchor: "end",
    letterSpacing: 0.8,
  });
}
addTextLayer("26 Project Index - Counter", "01  /  07", 1386, 277, 10, { family: "Arial", anchor: "end", letterSpacing: 1.2 });
addTextLayer("27 Interaction Hint - Arrow", "↔", 1167, 864, 15);
addTextLayer("28 Interaction Hint - Text", "DRAG OR SCROLL TO EXPLORE", 1190, 863, 10, { family: "Arial", letterSpacing: 1.2 });

function packBits(row) {
  const out = [];
  let i = 0;
  while (i < row.length) {
    let run = 1;
    while (i + run < row.length && run < 128 && row[i + run] === row[i]) run++;
    if (run >= 3) {
      out.push(257 - run, row[i]);
      i += run;
      continue;
    }
    const start = i;
    i += run;
    while (i < row.length && i - start < 128) {
      run = 1;
      while (i + run < row.length && run < 128 && row[i + run] === row[i]) run++;
      if (run >= 3) break;
      i += run;
    }
    const length = i - start;
    out.push(length - 1);
    for (let j = start; j < i; j++) out.push(row[j]);
  }
  return Buffer.from(out);
}

function channelData(layer, channelIndex) {
  const { width, height, data } = layer.image;
  const rows = [];
  const lengths = [];
  const row = Buffer.alloc(width);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) row[x] = data[(y * width + x) * 4 + channelIndex];
    const packed = packBits(row);
    rows.push(packed);
    lengths.push(be16(packed.length));
  }
  return Buffer.concat([be16(1), ...lengths, ...rows]);
}

function pascalName(name) {
  const clean = Buffer.from(name.slice(0, 255), "ascii");
  const raw = Buffer.concat([Buffer.from([clean.length]), clean]);
  const pad = (4 - (raw.length % 4)) % 4;
  return Buffer.concat([raw, Buffer.alloc(pad)]);
}

function buildPSD() {
  const layerRecords = [];
  const pixelData = [];
  for (const layer of layers) {
    const width = layer.image.width;
    const height = layer.image.height;
    const top = layer.top;
    const left = layer.left;
    const channels = [
      [-1, channelData(layer, 3)],
      [0, channelData(layer, 0)],
      [1, channelData(layer, 1)],
      [2, channelData(layer, 2)],
    ];
    const channelInfo = channels.map(([id, data]) => Buffer.concat([be16s(id), be32(data.length)]));
    const name = pascalName(layer.name);
    const extra = Buffer.concat([be32(0), be32(0), name]);
    const record = Buffer.concat([
      be32s(top),
      be32s(left),
      be32s(top + height),
      be32s(left + width),
      be16(channels.length),
      ...channelInfo,
      Buffer.from("8BIMnorm", "ascii"),
      Buffer.from([layer.opacity, 0, 0, 0]),
      be32(extra.length),
      extra,
    ]);
    layerRecords.push(record);
    channels.forEach(([, data]) => pixelData.push(data));
  }
  let layerInfo = Buffer.concat([be16s(layers.length), ...layerRecords, ...pixelData]);
  if (layerInfo.length % 2) layerInfo = Buffer.concat([layerInfo, Buffer.alloc(1)]);
  const layerMask = Buffer.concat([be32(layerInfo.length), layerInfo, be32(0)]);

  const composite = solid(W, H, rgba("#000000", 0));
  for (const layer of layers) {
    const opacity = layer.opacity / 255;
    for (let y = 0; y < layer.image.height; y++) {
      const dy = layer.top + y;
      if (dy < 0 || dy >= H) continue;
      for (let x = 0; x < layer.image.width; x++) {
        const dx = layer.left + x;
        if (dx < 0 || dx >= W) continue;
        const si = (y * layer.image.width + x) * 4;
        const di = (dy * W + dx) * 4;
        const sa = (layer.image.data[si + 3] / 255) * opacity;
        if (sa <= 0) continue;
        const da = composite.data[di + 3] / 255;
        const outA = sa + da * (1 - sa);
        for (let c = 0; c < 3; c++) {
          composite.data[di + c] = Math.round((layer.image.data[si + c] * sa + composite.data[di + c] * da * (1 - sa)) / outA);
        }
        composite.data[di + 3] = Math.round(outA * 255);
      }
    }
  }

  const planes = [];
  for (let c = 0; c < 4; c++) {
    const plane = Buffer.alloc(W * H);
    for (let i = 0; i < W * H; i++) plane[i] = composite.data[i * 4 + c];
    planes.push(plane);
  }

  const header = Buffer.concat([
    Buffer.from("8BPS", "ascii"),
    be16(1),
    Buffer.alloc(6),
    be16(4),
    be32(H),
    be32(W),
    be16(8),
    be16(3),
  ]);
  const psd = Buffer.concat([
    header,
    be32(0),
    be32(0),
    be32(layerMask.length),
    layerMask,
    be16(0),
    ...planes,
  ]);
  return { psd, composite };
}

const { psd, composite } = buildPSD();
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "Cathy-Zhang-Videography-Layout.psd"), psd);
writePNG(path.join(outDir, "Cathy-Zhang-Videography-Layout-preview.png"), composite);
fs.rmSync(tempDir, { recursive: true, force: true });
console.log(`Created ${layers.length} layers, ${W}x${H}, ${(psd.length / 1024 / 1024).toFixed(1)} MB`);
