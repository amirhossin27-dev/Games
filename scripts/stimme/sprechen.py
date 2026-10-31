"""
Joys Stimme: spricht alle Sätze aus scripts/stimme/saetze.json als Tondateien nach public/stimme/.

Stimme: Qwen3-TTS (Apache-2.0), geklont aus scripts/stimme/stimme-4.wav – das ist „Stimme 4, Warmer
Moderator“, die Amir am 31.10.2026 ausgesucht hat. Jede Aufnahme wird danach mit Whisper (small) abgehört.
Passt sie nicht zum Text, wird sie neu gesprochen (bis zu 3 Versuche, der beste bleibt).

Vorbereitung (einmalig, Python 3.10+, ffmpeg):
    pip install qwen-tts torch torchaudio num2words librosa soundfile
Aufruf:
    npx -y tsx scripts/stimme/saetze.ts      # Satzliste aktualisieren
    python scripts/stimme/sprechen.py         # nur fehlende Sätze sprechen

Läuft auch ohne Grafikkarte, braucht dann aber einige Sekunden pro Satz. Bereits vorhandene
Aufnahmen werden übersprungen, das Skript kann also jederzeit abgebrochen und neu gestartet werden.
"""

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import unicodedata

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(ROOT, "public", "stimme")
INDEX = os.path.join(OUT, "index.json")
REF_WAV = os.path.join(HERE, "stimme-4.wav")
REF_TXT = os.path.join(HERE, "stimme-4.txt")
# Ändert sich die Stimme, diese Kennung hochzählen: Dann bekommen alle Dateien neue Namen.
VOICE_ID = "stimme-4"

# Reihenfolge beim Sprechen: Was kleine Kinder zuerst hören, kommt zuerst dran.
PRIORITY = ["joy", "spruch", "name", "sperre", "spielende", "zimmer", "stadt-land-fluss", "anleitung"]


def priority(src: list[str]) -> int:
    best = 99
    for s in src:
        if s in PRIORITY:
            best = min(best, PRIORITY.index(s))
            continue
        tip = s.endswith("-tipp")
        level = int(re.search(r"-(\d)", s).group(1)) if re.search(r"-(\d)", s) else 1
        best = min(best, 10 + level + (10 if tip else 0))
    return best


def clip_id(key: str) -> str:
    return hashlib.sha1(f"{VOICE_ID}|{key}".encode()).hexdigest()[:12]


# ───── Text so aufbereiten, wie er gesprochen werden soll ─────

LETTER_NAMES = {
    "a": "A", "b": "Be", "c": "Ce", "d": "De", "e": "E", "f": "Eff", "g": "Ge", "h": "Ha", "i": "I",
    "j": "Jott", "k": "Ka", "l": "Ell", "m": "Emm", "n": "Enn", "o": "O", "p": "Pe", "q": "Kuh",
    "r": "Err", "s": "Ess", "t": "Te", "u": "U", "v": "Fau", "w": "We", "x": "Ix", "y": "Ypsilon",
    "z": "Zett", "ä": "Ä", "ö": "Ö", "ü": "Ü", "ß": "Eszett",
}


def num_words(n: int) -> str:
    from num2words import num2words

    if n == 100:
        return "hundert"
    return num2words(n, lang="de")


def clock_words(t: str) -> str:
    h, m = (int(x) for x in t.split(":"))
    hw = "ein" if h == 1 else num_words(h)
    return f"{hw} Uhr" if m == 0 else f"{hw} Uhr {num_words(m)}"


def spoken(key: str) -> str:
    """Schlüssel → Text für die Sprachausgabe (Zahlen und Buchstaben ausgeschrieben)."""
    m = re.fullmatch(r"#(\d{1,2}:\d{2}|\d+)([.?]?)", key)
    if m:
        body = clock_words(m.group(1)) if ":" in m.group(1) else num_words(int(m.group(1)))
        if m.group(2):
            body = body[0].upper() + body[1:]
        return body + m.group(2)
    t = key
    t = re.sub(r"\b1 (Minute)\b", r"eine \1", t)
    t = re.sub(r"\b1 (Uhr|Lernspiel)\b", r"ein \1", t)
    t = re.sub(r"\d{1,2}:\d{2}", lambda x: clock_words(x.group(0)), t)
    t = re.sub(r"\d+", lambda x: num_words(int(x.group(0))), t)
    # Einzelne Buchstaben als Buchstabennamen („mit F“ → „mit Eff“)
    t = re.sub(r"(?<![\w])([A-Za-zÄÖÜäöüß])(?![\w])", lambda x: LETTER_NAMES[x.group(1).lower()], t)
    # Wörter in Großbuchstaben (HUND) nicht buchstabieren
    t = re.sub(r"\b([A-ZÄÖÜ]{2,})\b", lambda x: x.group(1).capitalize(), t)
    return t


def norm_words(s: str) -> str:
    s = unicodedata.normalize("NFC", s.lower())
    s = re.sub(r"\d+", lambda x: num_words(int(x.group(0))), s)
    s = re.sub(r"[^a-zäöüß]", "", s)
    return s


def cer(a: str, b: str) -> float:
    a, b = norm_words(a), norm_words(b)
    if not a:
        return 0.0
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1] / len(a)


# ───── Audio ─────

def tidy(wav: np.ndarray, sr: int) -> np.ndarray:
    """Stille vorn und hinten kürzen, Lautstärke angleichen."""
    wav = wav.astype(np.float32)
    frame = int(sr * 0.02)
    if len(wav) > frame * 3:
        rms = np.sqrt(np.convolve(wav**2, np.ones(frame) / frame, mode="same"))
        on = np.where(rms > 10 ** (-42 / 20))[0]
        if len(on):
            a = max(0, on[0] - int(sr * 0.04))
            b = min(len(wav), on[-1] + int(sr * 0.09))
            wav = wav[a:b]
    voiced = wav[np.abs(wav) > 0.01]
    level = np.sqrt(np.mean(voiced**2)) if len(voiced) else 0.0
    if level > 0:
        wav = wav * (10 ** (-19 / 20) / level)
    peak = np.max(np.abs(wav)) if len(wav) else 0
    if peak > 0.89:
        wav = wav * (0.89 / peak)
    fade = min(len(wav) // 4, int(sr * 0.01))
    if fade:
        wav[:fade] *= np.linspace(0, 1, fade)
        wav[-fade:] *= np.linspace(1, 0, fade)
    return wav


def write_mp3(wav: np.ndarray, sr: int, path: str) -> None:
    import soundfile as sf

    with tempfile.NamedTemporaryFile(suffix=".wav") as t:
        sf.write(t.name, wav, sr)
        subprocess.run(
            ["ffmpeg", "-loglevel", "error", "-y", "-i", t.name, "-ac", "1", "-ar", "24000",
             "-codec:a", "libmp3lame", "-b:a", "40k", path],
            check=True,
        )


# ───── Sprechen ─────

class Voice:
    def __init__(self, model: str):
        import torch
        from qwen_tts import Qwen3TTSModel

        torch.set_num_threads(os.cpu_count() or 4)
        dev = "cuda:0" if torch.cuda.is_available() else "cpu"
        dtype = torch.bfloat16 if dev != "cpu" else torch.float32
        self.torch = torch
        self.m = Qwen3TTSModel.from_pretrained(model, device_map=dev, dtype=dtype)
        self.prompt = self.m.create_voice_clone_prompt(ref_audio=REF_WAV, ref_text=open(REF_TXT, encoding="utf8").read().strip())

    def say(self, texts: list[str], seed: int) -> tuple[list[np.ndarray], int]:
        """Wie Qwen3TTSModel.generate_voice_clone, aber die Referenz wird nur mit kurzem Vorlauf
        mit dekodiert (25 Schritte, wie im chunked_decode des Modells). Das spart viel Rechenzeit."""
        m, torch = self.m, self.torch
        n = len(texts)
        items = self.prompt * n
        prompt = m._prompt_items_to_voice_clone_prompt(items)
        ids = m._tokenize_texts([m._build_assistant_text(t) for t in texts])
        ref_ids = [m._tokenize_texts([m._build_ref_text(it.ref_text)])[0] for it in items]
        torch.manual_seed(seed)
        with torch.no_grad():
            codes_list, _ = m.model.generate(
                input_ids=ids, ref_ids=ref_ids, voice_clone_prompt=prompt, languages=["German"] * n,
                non_streaming_mode=False,
                # Obergrenze: 12,5 Schritte pro Sekunde, gut doppelt so lang wie erwartet. Ohne sie läuft
                # ein Satz, der kein Ende findet, minutenlang weiter und füllt den Speicher.
                **m._merge_generate_kwargs(do_sample=True, max_new_tokens=int(12.5 * (2.4 * max(expected_seconds(t) for t in texts) + 1.5))),
            )
            debug(f"gesprochen: {[int(c.shape[0]) for c in codes_list]} Schritte")
            ctx = 25
            ref = prompt["ref_code"][0][-ctx:]
            full = [torch.cat([ref.to(c.device), c], dim=0) for c in codes_list]
            # Einzeln dekodieren: Der Dekoder braucht bei langen Sätzen viel Speicher
            wavs = []
            for c in full:
                part, sr = m.model.speech_tokenizer.decode([{"audio_codes": c}])
                wavs.extend(part)
            debug("dekodiert")
        out = []
        for w, c in zip(wavs, full):
            w = w.float().cpu().numpy() if hasattr(w, "cpu") else np.asarray(w, dtype=np.float32)
            cut = int(ctx / max(int(c.shape[0]), 1) * len(w))
            out.append(w[cut:])
        return out, sr


class Ear:
    def __init__(self):
        import torch
        from transformers import WhisperForConditionalGeneration, WhisperProcessor

        self.torch = torch
        self.proc = WhisperProcessor.from_pretrained("openai/whisper-small")
        self.model = WhisperForConditionalGeneration.from_pretrained("openai/whisper-small", dtype=torch.float32).eval()

    def _transcribe(self, audio: list[np.ndarray]) -> list[str]:
        out: list[str] = []
        for k in range(0, len(audio), 2):
            feat = self.proc(audio[k : k + 2], sampling_rate=16000, return_tensors="pt").input_features
            with self.torch.no_grad():
                ids = self.model.generate(feat, language="german", task="transcribe", max_new_tokens=220)
            out.extend(t.strip() for t in self.proc.batch_decode(ids, skip_special_tokens=True))
        return out

    def check(self, wavs: list[np.ndarray], sr: int, texts: list[str]) -> list[tuple[float, str]]:
        """Fehlerquote und Gehörtes je Satz.

        Whisper rechnet immer mit 30 Sekunden Ton, auch bei einem kurzen Satz. Deshalb werden mehrere
        Sätze mit einer Sekunde Pause hintereinander gehängt und zusammen abgeschrieben. Die Abschrift
        wird dann den Sätzen zugeordnet (split_heard). Wer dabei schlecht abschneidet, wird zur
        Sicherheit noch einmal allein angehört.
        """
        import librosa

        a16 = [librosa.resample(w, orig_sr=sr, target_sr=16000).astype(np.float32) for w in wavs]
        gap = np.zeros(16000, np.float32)
        packs: list[list[int]] = []
        cur: list[int] = []
        dur = 0.0
        for i, w in enumerate(a16):
            d = len(w) / 16000 + 1.0
            if cur and dur + d > 26:
                packs.append(cur)
                cur, dur = [], 0.0
            cur.append(i)
            dur += d
        if cur:
            packs.append(cur)
        heard = self._transcribe([np.concatenate([x for i in p for x in (a16[i], gap)]) for p in packs])
        out: list[tuple[float, str]] = [(0.0, "")] * len(wavs)
        for p, h in zip(packs, heard):
            for i, r in zip(p, split_heard([texts[i] for i in p], h)):
                out[i] = r
        again = [i for i, (e, _) in enumerate(out) if e > 0.2 and len(norm_words(texts[i])) > 6]
        if again:
            for i, h in zip(again, self._transcribe([a16[i] for i in again])):
                e = cer(texts[i], h)
                if e < out[i][0]:
                    out[i] = (e, h)
        return out


def split_heard(refs: list[str], hyp: str) -> list[tuple[float, str]]:
    """Eine Abschrift für mehrere aneinandergehängte Sätze: Buchstaben zuordnen, Fehler je Satz zählen."""
    segs = [norm_words(r) for r in refs]
    a = "".join(segs)
    owner = [k for k, seg in enumerate(segs) for _ in seg]
    b = norm_words(hyp)
    n, m = len(a), len(b)
    d = [list(range(m + 1))]
    for i in range(1, n + 1):
        prev, row, ca = d[-1], [i], a[i - 1]
        for j in range(1, m + 1):
            row.append(min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (ca != b[j - 1])))
        d.append(row)
    err = [0] * len(segs)
    got = [[] for _ in segs]
    i, j = n, m
    while i > 0 or j > 0:
        k = owner[i - 1] if i > 0 else 0
        if i > 0 and j > 0 and d[i][j] == d[i - 1][j - 1] + (a[i - 1] != b[j - 1]):
            err[k] += a[i - 1] != b[j - 1]
            got[k].append(b[j - 1])
            i, j = i - 1, j - 1
        elif i > 0 and d[i][j] == d[i - 1][j] + 1:
            err[k] += 1
            i -= 1
        else:
            err[k] += 1
            got[k].append(b[j - 1])
            j -= 1
    return [(e / len(seg) if seg else 0.0, "".join(reversed(g))) for e, seg, g in zip(err, segs, got)]


def debug(msg: str) -> None:
    if os.environ.get("STIMME_DEBUG"):
        print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def expected_seconds(text: str) -> float:
    return 0.35 + len(text) / 14.0


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="Qwen/Qwen3-TTS-12Hz-1.7B-Base")
    ap.add_argument("--batch", type=int, default=8)
    ap.add_argument("--limit", type=int, default=0, help="höchstens so viele Sätze (zum Testen)")
    ap.add_argument("--tries", type=int, default=3)
    ap.add_argument("--log", default=os.path.join(HERE, "pruefung.jsonl"))
    ap.add_argument("--only", default="", help="nur Sätze aus diesen Quellen, z. B. joy,anleitung")
    args = ap.parse_args()

    os.makedirs(OUT, exist_ok=True)
    wanted = json.load(open(os.path.join(HERE, "saetze.json"), encoding="utf8"))
    index = {"stimme": VOICE_ID, "clips": {}}
    if os.path.exists(INDEX):
        index = json.load(open(INDEX, encoding="utf8"))
    clips = index["clips"]

    todo = [w for w in wanted if not (w["key"] in clips and os.path.exists(os.path.join(OUT, clips[w["key"]] + ".mp3")))]
    if args.only:
        only = set(args.only.split(","))
        todo = [w for w in todo if only & set(w["src"])]
    todo.sort(key=lambda w: (priority(w["src"]), len(spoken(w["key"]))))
    if args.limit:
        todo = todo[: args.limit]
    print(f"{len(wanted)} Sätze, davon fehlen {len(todo)}", flush=True)
    if not todo:
        return

    voice = Voice(args.model)
    ear = Ear()
    log = open(args.log, "a", encoding="utf8")
    t_start = time.time()
    done = 0

    def save_index():
        keep = {w["key"] for w in wanted}
        index["clips"] = {k: v for k, v in sorted(clips.items()) if k in keep}
        tmp = INDEX + ".tmp"
        json.dump(index, open(tmp, "w", encoding="utf8"), ensure_ascii=False, separators=(",", ":"))
        os.replace(tmp, INDEX)

    # Gruppen ähnlicher Länge, damit beim gemeinsamen Rechnen wenig Leerlauf entsteht
    for g in range(0, len(todo), args.batch):
        group = todo[g : g + args.batch]
        texts = [spoken(w["key"]) for w in group]
        best: list[tuple[float, np.ndarray, str] | None] = [None] * len(group)
        pending = list(range(len(group)))
        for attempt in range(args.tries):
            if not pending:
                break
            seed = int(hashlib.sha1(f"{group[pending[0]]['key']}|{attempt}".encode()).hexdigest()[:8], 16)
            wavs, sr = voice.say([texts[i] for i in pending], seed)
            checked = ear.check(wavs, sr, [texts[i] for i in pending])
            debug("gehört")
            still = []
            for i, w, (err, h) in zip(pending, wavs, checked):
                dur = len(w) / sr
                exp = expected_seconds(texts[i])
                # Kurze Bausteine (einzelne Zahlen, Buchstaben) erkennt Whisper oft schlecht: dort zählt nur die Länge
                short = len(norm_words(texts[i])) <= 6
                bad_len = dur > 2.6 * exp + 0.8 or dur < 0.35 * exp
                score = (0 if short else err) + (1 if bad_len else 0)
                if best[i] is None or score < best[i][0]:
                    best[i] = (score, w, h)
                if score > 0.2:
                    still.append(i)
            pending = still
        for i, w in enumerate(group):
            score, wav, heard = best[i]
            cid = clip_id(w["key"])
            write_mp3(tidy(wav, sr), sr, os.path.join(OUT, cid + ".mp3"))
            clips[w["key"]] = cid
            log.write(json.dumps({"key": w["key"], "text": texts[i], "heard": heard, "score": round(score, 3)}, ensure_ascii=False) + "\n")
        log.flush()
        save_index()
        done += len(group)
        rate = (time.time() - t_start) / done
        print(f"{done}/{len(todo)} fertig, {rate:.1f} s pro Satz, noch etwa {rate * (len(todo) - done) / 60:.0f} min", flush=True)


if __name__ == "__main__":
    sys.exit(main())
