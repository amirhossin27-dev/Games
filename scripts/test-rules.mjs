// Prüft database.rules.json gegen den Firebase-Emulator: Wer darf was lesen und schreiben?
// Aufruf: npm run test:rules (startet den Emulator, braucht Java). Läuft schon ein Emulator,
// geht auch: node scripts/test-rules.mjs
import { readFileSync } from 'node:fs';
const rulesPath = new URL('../database.rules.json', import.meta.url);
const BASE = `http://${process.env.FIREBASE_DATABASE_EMULATOR_HOST ?? '127.0.0.1:9000'}`;
const NS = 'joyboy-test';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
// Der Emulator prüft die Unterschrift nicht – ein Schlüssel ohne Unterschrift reicht.
const tok = (uid) => `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ user_id: uid, sub: uid, aud: 'joyboy', iss: 'https://securetoken.google.com/joyboy', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, firebase: { sign_in_provider: 'anonymous' } })}.`;
const SV = { '.sv': 'timestamp' };
async function req(method, path, uid, body) {
  const url = `${BASE}/${path}.json?ns=${NS}${uid ? `&auth=${tok(uid)}` : ''}`;
  const res = await fetch(url, { method, body: body === undefined ? undefined : JSON.stringify(body) });
  return { ok: res.ok, status: res.status, body: await res.text() };
}
let fails = 0;
async function expect(name, p, ok) {
  const r = await p;
  const pass = r.ok === ok;
  if (!pass) fails++;
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${ok ? 'erlaubt ' : 'verboten'} ${name}${pass ? '' : ` → ${r.status} ${r.body.slice(0, 120)}`}`);
}
// Regeln laden
const rules = readFileSync(rulesPath, 'utf8');
const r = await fetch(`${BASE}/.settings/rules.json?ns=${NS}`, { method: 'PUT', headers: { Authorization: 'Bearer owner' }, body: rules });
console.log('Regeln geladen:', r.status, (await r.text()).slice(0, 200));
await fetch(`${BASE}/.json?ns=${NS}`, { method: 'DELETE', headers: { Authorization: 'Bearer owner' } });

const C = 'abc123';
const person = (name) => ({ name, avatar: 'fuchs', color: '#F6D3B8', at: SV });
const info = { host: 'h', game: 'vier', level: 1, status: 'lobby', robos: 0, round: 0, at: SV };

console.log('\n— Zimmer (bestehende Regeln) —');
await expect('Gastgeber öffnet Zimmer', req('PUT', `rooms/${C}`, 'h', { info, seats: { h: person('Lena') } }), true);
await expect('Gast klingelt', req('PATCH', `rooms/${C}/seats/g`, 'g', person('Ben')), true);
await expect('Fremder klingelt auch', req('PATCH', `rooms/${C}/seats/s`, 's', person('Sam')), true);
await expect('Gast liest die Tür', req('GET', `rooms/${C}/info`, 'g'), true);
await expect('Gast liest noch nicht das ganze Zimmer', req('GET', `rooms/${C}`, 'g'), false);
await expect('Gastgeber lässt rein und merkt sich den Gast (known)', req('PATCH', `rooms/${C}/info`, 'h', { 'allowed/g': 1, 'denied/g': null, 'known/g': true, at: SV }), true);
await expect('Gast liest jetzt das ganze Zimmer', req('GET', `rooms/${C}`, 'g'), true);
await expect('Gast setzt „spielt kurz allein“', req('PATCH', `rooms/${C}/seats/g`, 'g', { solo: true }), true);

console.log('\n— Chat —');
const msg = (by, t, extra = {}) => ({ by, ...person(by === 'h' ? 'Lena' : by === 'g' ? 'Ben' : 'Sam'), t, ...extra });
await expect('Gast schreibt „Hallo Lena!“', req('PUT', `rooms/${C}/chat/m1`, 'g', msg('g', 'Hallo Lena!')), true);
await expect('Gastgeber schickt fertigen Satz', req('PUT', `rooms/${C}/chat/m2`, 'h', msg('h', 'Gut gemacht! 👍', { q: 5 })), true);
await expect('„Das ist extra schwer“ geht', req('PUT', `rooms/${C}/chat/m3`, 'g', msg('g', 'Das ist extra schwer')), true);
await expect('Schimpfwort', req('PUT', `rooms/${C}/chat/m4`, 'g', msg('g', 'du bist dumm')), false);
await expect('Schimpfwort mit Punkten', req('PUT', `rooms/${C}/chat/m5`, 'g', msg('g', 'A.r.s.c.h')), false);
await expect('Telefonnummer mit Leerzeichen', req('PUT', `rooms/${C}/chat/m6`, 'g', msg('g', '0176 12 34 56')), false);
await expect('E-Mail', req('PUT', `rooms/${C}/chat/m7`, 'g', msg('g', 'ben@web.de')), false);
await expect('Link', req('PUT', `rooms/${C}/chat/m8`, 'g', msg('g', 'www.spiele')), false);
await expect('Frage nach Adresse', req('PUT', `rooms/${C}/chat/m9`, 'g', msg('g', 'Wo wohnst du?')), false);
await expect('zu lang', req('PUT', `rooms/${C}/chat/m10`, 'g', msg('g', 'a'.repeat(61))), false);
await expect('unter fremdem Namen', req('PUT', `rooms/${C}/chat/m11`, 'g', msg('h', 'Ich bin Lena')), false);
await expect('Kind vor der Tür schreibt', req('PUT', `rooms/${C}/chat/m12`, 's', msg('s', 'Hallo')), false);
await expect('Kind vor der Tür liest den Chat', req('GET', `rooms/${C}/chat`, 's'), false);
await expect('eigene Nachricht nachträglich ändern', req('PUT', `rooms/${C}/chat/m1`, 'g', msg('g', 'geändert')), false);
await expect('Gast löscht fremde Nachricht', req('DELETE', `rooms/${C}/chat/m2`, 'g'), false);
await expect('Gastgeber räumt alte Nachrichten weg', req('PATCH', `rooms/${C}/chat`, 'h', { m1: null, m3: null }), true);

console.log('\n— Online-Punkt —');
await expect('Kind meldet sich online mit Zimmer', req('PUT', 'presence/h', 'h', { on: true, room: C, st: 'lobby', game: 'vier', at: SV }), true);
await expect('Spielfreund liest den Online-Punkt', req('GET', 'presence/h', 'g'), true);
await expect('niemand kann alle auflisten', req('GET', 'presence', 'g'), false);
await expect('fremdes Konto schreibt', req('PUT', 'presence/h', 'g', { on: true, at: SV }), false);
await expect('unbekanntes Feld', req('PUT', 'presence/g', 'g', { on: true, at: SV, name: 'x' }), false);
await expect('kaputter Zimmer-Code', req('PUT', 'presence/g', 'g', { on: true, room: 'xyz', at: SV }), false);
await expect('Zeit in der Zukunft', req('PUT', 'presence/g', 'g', { on: true, at: Date.now() + 3_600_000 }), false);
await expect('App zu (PATCH on: false)', req('PATCH', 'presence/h', 'h', { on: false, at: SV }), true);
await expect('ohne Anmeldung lesen', req('GET', 'presence/h', null), false);

console.log('\n— Einladungen —');
const inv = { code: C, game: 'vier', ...person('Lena') };
await expect('Gastgeber lädt Freund ein', req('PUT', 'invites/f/h', 'h', inv), true);
await expect('Freund liest seine Einladungen', req('GET', 'invites/f', 'f'), true);
await expect('andere lesen fremde Einladungen', req('GET', 'invites/f', 'g'), false);
await expect('Einladung im fremden Namen', req('PUT', 'invites/f/g', 'h', inv), false);
await expect('Empfänger fälscht Einladung', req('PUT', 'invites/f/h', 'f', inv), false);
await expect('sich selbst einladen', req('PUT', 'invites/h/h', 'h', inv), false);
await expect('unpassender Name', req('PUT', 'invites/f/h', 'h', { ...inv, name: 'insta_lena' }), false);
await expect('Empfänger löscht die Einladung', req('DELETE', 'invites/f/h', 'f'), true);

console.log('\n— Zimmer wieder öffnen —');
await expect('Gast geht (Platz löschen)', req('DELETE', `rooms/${C}/seats/g`, 'g'), true);
await expect('Gastgeber gibt den Platz frei', req('PATCH', `rooms/${C}/info`, 'h', { 'allowed/g': null, at: SV }), true);
await expect('Gastgeber schließt', req('PATCH', `rooms/${C}/info`, 'h', { status: 'closed', at: SV }), true);
await expect('Fremder kann das geschlossene Zimmer nicht übernehmen', req('PUT', `rooms/${C}`, 's', { info: { ...info, host: 's' }, seats: { s: person('Sam') } }), false);
await expect('Gast kann es nicht wieder öffnen', req('PATCH', `rooms/${C}/info`, 'g', { status: 'lobby', at: SV }), false);
await expect('Gastgeber öffnet es wieder (gleicher Code)', req('PATCH', `rooms/${C}/info`, 'h', { status: 'lobby', allowed: null, denied: null, at: SV }), true);
await expect('Gast klingelt wieder', req('PATCH', `rooms/${C}/seats/g`, 'g', person('Ben')), true);
const known = await req('GET', `rooms/${C}/info/known`, 'h');
console.log(`     known nach dem Wiederöffnen: ${known.body}`);
await expect('Gastgeber lässt ihn ohne Fragen rein', req('PATCH', `rooms/${C}/info`, 'h', { 'allowed/g': 1, 'known/g': true, at: SV }), true);
await expect('Gast ist wieder drin', req('GET', `rooms/${C}`, 'g'), true);

console.log(fails ? `\n${fails} FEHLER` : '\nAlles wie erwartet.');
process.exit(fails ? 1 : 0);
