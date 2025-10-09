#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import { dirname, resolve } from 'node:path';

async function main() {
  const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), '..');
  const srcPng = resolve(repoRoot, 'public/assets/cursors/lantern-pointer.png');
  const outIco = resolve(repoRoot, 'public/favicon.ico');
  const outSvg = resolve(repoRoot, 'public/favicon.svg');
  const sizeArg = process.argv.find((a) => a === '--size') ? Number(process.argv[process.argv.indexOf('--size') + 1]) : undefined;

  const png = await fs.readFile(srcPng);
  if (!isPng(png)) {
    throw new Error('Source is not a PNG: ' + srcPng);
  }

  const { width, height } = readPngSize(png);
  const target = Number.isFinite(sizeArg) && sizeArg > 0 ? Math.floor(sizeArg) : width;
  const wField = target >= 256 ? 0 : Math.min(255, target);
  const hField = target >= 256 ? 0 : Math.min(255, target);

  const ICONDIR_SIZE = 6;
  const ICONDIRENTRY_SIZE = 16;
  const imageOffset = ICONDIR_SIZE + ICONDIRENTRY_SIZE;

  const header = Buffer.alloc(ICONDIR_SIZE + ICONDIRENTRY_SIZE);
  let o = 0;
  header.writeUInt16LE(0, o); o += 2; // reserved
  header.writeUInt16LE(1, o); o += 2; // type: 1 = icon
  header.writeUInt16LE(1, o); o += 2; // count
  header.writeUInt8(wField, o++); // width
  header.writeUInt8(hField, o++); // height
  header.writeUInt8(0, o++); // colorCount
  header.writeUInt8(0, o++); // reserved
  header.writeUInt16LE(1, o); o += 2; // planes
  header.writeUInt16LE(32, o); o += 2; // bitCount
  header.writeUInt32LE(png.length, o); o += 4; // bytesInRes
  header.writeUInt32LE(imageOffset, o); o += 4; // imageOffset

  const ico = Buffer.concat([header, png]);
  await fs.writeFile(outIco, ico);
  console.log('[favicon] generated ico', { out: outIco, src: `${width}x${height}`, iconDirSize: `${wField || 256}x${hField || 256}`, bytes: ico.length });

  // Optionally generate an SVG wrapper if explicitly requested
  if (process.argv.includes('--svg')) {
    const b64 = png.toString('base64');
    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" width="',
      String(target),
      '" height="',
      String(target),
      '" viewBox="0 0 ',
      String(width),
      ' ',
      String(height),
      '" shape-rendering="crispEdges">',
      '<image href="data:image/png;base64,',
      b64,
      '" width="',
      String(width),
      '" height="',
      String(height),
      '" style="image-rendering: pixelated"/>',
      '</svg>'
    ].join('');
    await fs.writeFile(outSvg, svg, 'utf8');
    console.log('[favicon] generated svg', { out: outSvg, target });
  } else {
    // Do not overwrite a hand-crafted SVG
    try {
      await fs.access(outSvg);
      console.log('[favicon] kept existing svg', { out: outSvg });
    } catch {
      // no-op
    }
  }
}

function isPng(buf) {
  const sig = '89504e470d0a1a0a';
  return buf.subarray(0, 8).toString('hex') === sig;
}

function readPngSize(buf) {
  // PNG IHDR chunk is after 8-byte signature: 4 bytes length, 4 bytes 'IHDR', then width, height (big-endian)
  const ihdrOffset = 8 + 4 + 4; // skip sig + length + type
  const width = buf.readUInt32BE(ihdrOffset);
  const height = buf.readUInt32BE(ihdrOffset + 4);
  return { width, height };
}

main().catch((err) => {
  console.error('[favicon] generation failed', err);
  process.exit(1);
});
