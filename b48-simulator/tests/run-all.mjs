// Punct de intrare pentru `node --test tests/` (Node 22 rezolvă directorul prin tests/package.json → main).
// Importă toate fișierele *.test.mjs din acest folder; `node --test` (fără argumente) le descoperă și direct.
import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
for (const f of readdirSync(dir).filter((x) => x.endsWith('.test.mjs')).sort()) {
  await import(pathToFileURL(join(dir, f)).href);
}
