import { readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(process.cwd(), '.tmp-tests');
const testsDir = resolve(root, 'tests');

function findTests(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...findTests(p));
    else if (name.endsWith('.test.js')) out.push(p);
  }
  return out;
}

async function main() {
  const harnessUrl = pathToFileURL(resolve(testsDir, 'test-harness.js')).href;
  const harness = await import(harnessUrl);
  const files = findTests(testsDir);
  for (const f of files) {
    await import(pathToFileURL(f).href);
  }
  const cases = harness.cases ?? [];
  let passed = 0;
  let failed = 0;
  for (const c of cases) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await c.fn();
      console.log(`✔ ${c.name}`);
      passed++;
    } catch (err) {
      console.error(`✘ ${c.name}:`, err?.message ?? err);
      failed++;
    }
  }
  console.log(`\nCore tests: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error('Runner crashed:', e);
  process.exit(1);
});

