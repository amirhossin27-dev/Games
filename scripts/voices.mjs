// Bereitet Joys eigene Stimme vor (läuft vor `npm run dev` / `npm run build` und in GitHub Actions).
//   node scripts/voices.mjs ort     → onnxruntime-web (Wasm) nach public/voice/ort kopieren
//   node scripts/voices.mjs models  → Piper-Stimmen nach public/voice/models laden (mit Prüfsumme)
// Beide Ordner sind nicht im Git, sie werden beim Bauen erzeugt.
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'voice');

// Feste Version von https://huggingface.co/rhasspy/piper-voices (beide Stimmen CC0)
const REV = 'b4e358ffcb232591bf73a540e70f7de528e4174a';
const FILES = {
  'de_DE-kerstin-low.onnx': ['de/de_DE/kerstin/low', 'd352a7641892cebf2903859af94e9ba81a141110215fe3943bcda7f7da401b7a'],
  'de_DE-kerstin-low.onnx.json': ['de/de_DE/kerstin/low', '56e708556b7b9b7a53c4f8957e021421e69f11a600962bba554cffbe72cf2d47'],
  'de_DE-thorsten-medium.onnx': ['de/de_DE/thorsten/medium', '7e64762d8e5118bb578f2eea6207e1a35a8e0c30595010b666f983fc87bb7819'],
  'de_DE-thorsten-medium.onnx.json': ['de/de_DE/thorsten/medium', '974adee790533adb273a1ac88f49027d2a1b8f0f2cf4905954a4791e79264e85'],
};

const sha = (buf) => createHash('sha256').update(buf).digest('hex');

function ort() {
  const dir = join(out, 'ort');
  mkdirSync(dir, { recursive: true });
  for (const f of ['ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm']) copyFileSync(join(root, 'node_modules', 'onnxruntime-web', 'dist', f), join(dir, f));
}

async function models() {
  const dir = join(out, 'models');
  mkdirSync(dir, { recursive: true });
  for (const [name, [path, hash]] of Object.entries(FILES)) {
    const file = join(dir, name);
    if (existsSync(file) && sha(readFileSync(file)) === hash) continue;
    const url = `https://huggingface.co/rhasspy/piper-voices/resolve/${REV}/${path}/${name}`;
    console.log(`Lade ${name} …`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (sha(buf) !== hash) throw new Error(`Prüfsumme passt nicht: ${name}`);
    writeFileSync(file, buf);
  }
}

const what = process.argv[2] ?? 'all';
if (what === 'ort' || what === 'all') ort();
if (what === 'models' || what === 'all') await models();
