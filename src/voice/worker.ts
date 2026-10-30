/**
 * Joys Stimme im Hintergrund: Text → Laute (eSpeak NG, nur Deutsch) → neuronale Piper-Stimme
 * (onnxruntime-web, Wasm) → Audio. Läuft in einem Worker, damit Spiele flüssig bleiben.
 */
import * as ort from 'onnxruntime-web/wasm';
import createPiperPhonemize, { type PiperPhonemizeModule } from './vendor/piper_phonemize.js';

// Im Worker hat `self` dieselbe Form wie ein Worker-Objekt von außen (postMessage, onmessage)
const scope = self as unknown as Worker;

export type ToWorker = { t: 'load'; base: string; file: string } | { t: 'say'; id: number; text: string } | { t: 'cancel'; before: number };

export type FromWorker =
  | { t: 'progress'; loaded: number; total: number }
  | { t: 'ready' }
  | { t: 'error'; message: string }
  | { t: 'audio'; id: number; pcm: Float32Array; rate: number }
  | { t: 'failed'; id: number };

/** Gleicher Name wie in src/voice/joyVoice.ts – dort wird auch geprüft, ob eine Stimme schon geladen ist. */
const CACHE = 'joyboy-voice-v1';

interface VoiceConfig {
  audio: { sample_rate: number };
  inference: { noise_scale: number; length_scale: number; noise_w: number };
  phoneme_id_map: Record<string, number[]>;
}

let phon: PiperPhonemizeModule | null = null;
let lines: string[] = [];
let session: ort.InferenceSession | null = null;
let config: VoiceConfig | null = null;
const queue: { id: number; text: string }[] = [];
let busy = false;
let cancelBefore = 0;

const post = (m: FromWorker, transfer: Transferable[] = []) => scope.postMessage(m, transfer);

/** Aus dem eigenen Cache, sonst laden (mit Fortschritt) und für offline merken. */
async function cachedFile(url: string, progress?: (loaded: number, total: number) => void): Promise<ArrayBuffer> {
  const cache = await caches.open(CACHE).catch(() => null);
  const hit = await cache?.match(url);
  if (hit) return hit.arrayBuffer();
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`${url}: ${res.status}`);
  const total = Number(res.headers.get('content-length')) || 0;
  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    loaded += value.length;
    progress?.(loaded, total);
  }
  const buf = new Uint8Array(loaded);
  let at = 0;
  for (const p of parts) {
    buf.set(p, at);
    at += p.length;
  }
  await cache?.put(url, new Response(buf, { headers: { 'content-type': 'application/octet-stream' } })).catch(() => undefined);
  return buf.buffer;
}

async function load(base: string, file: string) {
  ort.env.wasm.wasmPaths = `${base}ort/`;
  ort.env.wasm.numThreads = 1;
  const [wasm, data, cfg] = await Promise.all([cachedFile(`${base}piper_phonemize.wasm`), cachedFile(`${base}espeak-de.data`), cachedFile(`${base}models/${file}.onnx.json`)]);
  config = JSON.parse(new TextDecoder().decode(cfg)) as VoiceConfig;
  phon ??= await createPiperPhonemize({
    print: (l) => lines.push(l),
    printErr: () => undefined,
    noInitialRun: true,
    wasmBinary: wasm,
    getPreloadedPackage: () => data,
    locateFile: (f) => base + f,
  });
  const model = await cachedFile(`${base}models/${file}.onnx`, (loaded, total) => post({ t: 'progress', loaded, total }));
  session = await ort.InferenceSession.create(model);
  // Einmal vorwärmen – der allererste Satz braucht sonst spürbar länger
  await synth('Hallo.');
}

/** Lautschrift → Zahlen für das Modell (Piper: Anfang, Pause zwischen allen Lauten, Ende) */
function toIds(phonemes: string, map: Record<string, number[]>): number[] {
  // Neuere Modelle kennen zerlegte Zeichen (c + ̧), ältere nur fertige (ç)
  const text = phonemes.normalize('̧' in map ? 'NFD' : 'NFC');
  const ids = [...map['^'], ...map['_']];
  for (const ch of text) {
    const id = map[ch];
    if (id) ids.push(...id, ...map['_']);
  }
  ids.push(...map['$']);
  return ids;
}

async function synth(text: string): Promise<Float32Array> {
  if (!phon || !session || !config) throw new Error('nicht geladen');
  lines = [];
  phon.callMain(['-l', 'de', '--input', JSON.stringify([{ text }]), '--espeak_data', '/espeak-ng-data']);
  const phonemes = lines.map((l) => (JSON.parse(l) as { phonemes: string[] }).phonemes.join('')).join(' ');
  const ids = toIds(phonemes, config.phoneme_id_map);
  const { noise_scale, length_scale, noise_w } = config.inference;
  const out = await session.run({
    input: new ort.Tensor('int64', BigInt64Array.from(ids, BigInt), [1, ids.length]),
    input_lengths: new ort.Tensor('int64', BigInt64Array.from([BigInt(ids.length)]), [1]),
    // Etwas langsamer als normal – Kinder hören so besser zu
    scales: new ort.Tensor('float32', Float32Array.from([noise_scale, length_scale * 1.08, noise_w]), [3]),
  });
  return (out.output.data as Float32Array).slice();
}

async function pump() {
  if (busy) return;
  busy = true;
  while (queue.length) {
    const job = queue.shift()!;
    // Abgebrochen, bevor es losging: Bescheid geben, damit niemand wartet
    if (job.id < cancelBefore) {
      post({ t: 'failed', id: job.id });
      continue;
    }
    try {
      // Schon angefangene Sätze trotzdem liefern – sie landen im Speicher für das nächste Mal
      const pcm = await synth(job.text);
      post({ t: 'audio', id: job.id, pcm, rate: config!.audio.sample_rate }, [pcm.buffer]);
    } catch {
      post({ t: 'failed', id: job.id });
    }
  }
  busy = false;
}

scope.onmessage = (e: MessageEvent<ToWorker>) => {
  const m = e.data;
  if (m.t === 'load') {
    load(m.base, m.file)
      .then(() => post({ t: 'ready' }))
      .catch((err: unknown) => post({ t: 'error', message: String((err as Error)?.message ?? err) }));
  } else if (m.t === 'say') {
    queue.push({ id: m.id, text: m.text });
    void pump();
  } else if (m.t === 'cancel') {
    cancelBefore = Math.max(cancelBefore, m.before);
  }
};
