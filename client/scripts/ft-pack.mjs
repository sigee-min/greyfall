#!/usr/bin/env node
// Pack per-task JSONL into a combined JSONL per split, preserving meta.task.
// Usage: node scripts/ft-pack.mjs [baseDir=docs/fine-tuning/data/v1] [outDir=docs/fine-tuning/data/v1/packed]

import fs from 'fs';
import path from 'path';

const BASE = process.argv[2] || 'docs/fine-tuning/data/v1';
const OUT = process.argv[3] || path.join(BASE, 'packed');

function listTaskFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl')).map((f) => path.join(dir, f));
}

function packSplit(split) {
  const inDir = path.join(BASE, split);
  const outDir = OUT;
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${split}.jsonl`);
  const out = fs.createWriteStream(outFile, { encoding: 'utf8' });
  let count = 0;
  for (const file of listTaskFiles(inDir)) {
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
    for (const line of lines) { out.write(line.trim() + '\n'); count += 1; }
  }
  out.end();
  console.log(`[pack] ${split}: ${count} lines -> ${outFile}`);
}

for (const split of ['train','valid','test']) packSplit(split);

