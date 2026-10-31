// Baut database.rules.json. Die Namens- und Chat-Prüfung steht dort ausgeschrieben, weil die Regeln
// der Firebase-Datenbank keine Variablen kennen. Die Wortlisten kommen aus src/lib/names.ts und src/lib/chat.ts.
// Aufruf: npm run rules – danach den Inhalt in der Firebase-Konsole unter „Regeln“ einfügen.
// Ein Test in src/__tests__/online.test.ts prüft, ob die Datei zur Wortliste passt.
import { readFileSync, writeFileSync } from 'node:fs';

const names = readFileSync(new URL('../src/lib/names.ts', import.meta.url), 'utf8');
const list = (name) => [...names.match(new RegExp(`export const ${name}[^=]*= \\[([^\\]]*)\\]`, 's'))[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
const bad = list('BAD_WORDS');
const animals = [...names.match(/export const ANIMALS[^=]*= \[(.*?)\];/s)[1].matchAll(/kind: '([a-z]+)'/g)].map((m) => m[1]);
const chat = readFileSync(new URL('../src/lib/chat.ts', import.meta.url), 'utf8');
const chatWords = [...chat.match(/export const CHAT_WORDS[^=]*= \[([^\]]*)\]/s)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
const chatMax = Number(chat.match(/export const CHAT_MAX = (\d+);/)[1]);
const chatLinks = [...chat.match(/const LINKS = \[([^\]]*)\]/s)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);

const nameOk = (n) => {
  const low = `${n}.val().toLowerCase()`;
  const folded = `${low}.replace(' ', '').replace('.', '').replace('-', '').replace('_', '')`;
  return [
    `${n}.isString()`,
    `${n}.val().length >= 1`,
    `${n}.val().length <= 16`,
    `!${n}.val().matches(/^.*[0-9]{4}.*$/)`,
    ...['@', 'http', 'www'].map((w) => `!${low}.contains('${w}')`),
    ...bad.map((w) => `!${folded}.contains('${w}')`),
  ].join(' && ');
};
// Chat: wie lib/chat.ts – keine langen Zahlen (auch mit Leerzeichen, Punkten, Strichen dazwischen),
// keine Links und E-Mails, keine Schimpfwörter und keine Fragen nach Adresse oder Nummer.
// Bei den Wörtern bleiben die Leerzeichen stehen, sonst wäre „das extra“ ein Schimpfwort.
const textOk = (t) => {
  const low = `${t}.val().toLowerCase()`;
  const words = `${low}.replace('.', '').replace('-', '').replace('_', '').replace('/', '')`;
  const digits = `${words}.replace(' ', '')`;
  return [
    `${t}.isString()`,
    `${t}.val().length >= 1`,
    `${t}.val().length <= ${chatMax}`,
    `!${digits}.matches(/^.*[0-9]{4}.*$/)`,
    ...chatLinks.map((w) => `!${low}.contains('${w}')`),
    ...[...bad, ...chatWords].map((w) => `!${words}.contains('${w}')`),
  ].join(' && ');
};
const avatarOk = (a) => `(${animals.map((x) => `${a}.val() === '${x}'`).join(' || ')})`;
const colorOk = (d) => `(!${d}.hasChild('color') || ${d}.child('color').val().matches(/^#[0-9a-fA-F]{6}$/))`;
const person = (d) => [`${d}.hasChildren(['name', 'avatar', 'at'])`, nameOk(`${d}.child('name')`), avatarOk(`${d}.child('avatar')`), colorOk(d)].join(' && ');

const room = "rooms/' + $code + '";
const isHost = `root.child('${room}/info/host').val() === auth.uid`;
const isIn = `(${isHost} || root.child('${room}/info/allowed/' + auth.uid).exists())`;
const code6 = (c) => `${c}.isString() && ${c}.val().matches(/^[0-9a-f]{6}$/)`;
const rules = {
  rules: {
    profiles: {
      $uid: {
        public: {
          '.read': 'auth != null',
          '.write': 'auth != null && auth.uid === $uid',
          '.validate': person('newData'),
        },
        private: {
          '.read': 'auth != null && auth.uid === $uid',
          '.write': 'auth != null && auth.uid === $uid',
          '.validate': 'newData.isString() && newData.val().length <= 100000',
        },
        $other: { '.validate': false },
      },
    },
    // Wer gerade online ist (und in welchem Zimmer) – lesen kann es nur, wer das Konto kennt
    presence: {
      $uid: {
        '.read': 'auth != null',
        '.write': 'auth != null && auth.uid === $uid',
        '.validate': "newData.hasChildren(['at']) && newData.child('at').isNumber() && newData.child('at').val() <= now",
        on: { '.validate': 'newData.isBoolean()' },
        room: { '.validate': code6('newData') },
        st: { '.validate': "newData.val() === 'lobby' || newData.val() === 'playing'" },
        game: { '.validate': 'newData.isString() && newData.val().length <= 20' },
        at: { '.validate': true },
        $other: { '.validate': false },
      },
    },
    // Einladungen: invites/<Empfänger>/<Absender> – nur der Empfänger liest, nur der Absender schreibt
    invites: {
      $uid: {
        '.read': 'auth != null && auth.uid === $uid',
        $from: {
          '.write': 'auth != null && (auth.uid === $from || (auth.uid === $uid && !newData.exists()))',
          '.validate': `$from !== $uid && ${person('newData')} && ${code6("newData.child('code')")} && newData.child('game').isString() && newData.child('game').val().length <= 20 && newData.child('at').val() <= now`,
        },
      },
    },
    rooms: {
      $code: {
        // Ganzes Zimmer: nur Gastgeber und reingelassene Kinder
        '.read': "auth != null && $code.matches(/^[0-9a-f]{6}$/) && (data.child('info/host').val() === auth.uid || data.child('info/allowed/' + auth.uid).exists())",
        '.write': "auth != null && $code.matches(/^[0-9a-f]{6}$/) && (!data.child('info').exists() || data.child('info/at').val() < now - 7200000)",
        info: {
          // Wer geklingelt hat, sieht, ob er reindarf
          '.read': "auth != null && data.parent().child('seats/' + auth.uid).exists()",
          '.write': `auth != null && data.exists() && (data.child('host').val() === auth.uid || (data.child('allowed/' + auth.uid).exists() && root.child('${room}/seats/' + auth.uid).exists() && (!root.child('${room}/seats/' + data.child('host').val()).exists() || root.child('${room}/seats/' + data.child('host').val() + '/at').val() < now - 20000)))`,
          '.validate': "newData.hasChildren(['host', 'game', 'status', 'at']) && newData.child('host').val() === auth.uid && newData.child('at').val() <= now",
        },
        seats: {
          $uid: {
            '.read': "auth != null && (auth.uid === $uid || ($uid === data.parent().parent().child('info/host').val() && data.parent().child(auth.uid).exists()))",
            '.write': `auth != null && auth.uid === $uid && root.child('${room}/info').exists()`,
            '.validate': `$uid === auth.uid && ${person('newData')} && newData.child('at').val() <= now`,
          },
        },
        // Chat: nur wer drin ist; neue Nachrichten nur unter eigenem Namen, wegräumen darf der Gastgeber
        chat: {
          $id: {
            '.write': `auth != null && ${isIn} && ((!data.exists() && newData.exists()) || (${isHost} && !newData.exists()))`,
            '.validate': `newData.child('by').val() === auth.uid && ${person('newData')} && ${textOk("newData.child('t')")} && (!newData.hasChild('q') || newData.child('q').isNumber()) && newData.child('at').val() <= now`,
          },
        },
        state: {
          '.write': `auth != null && root.child('${room}/info/host').val() === auth.uid`,
          '.validate': "newData.hasChildren(['seq', 'st']) && newData.child('seq').isNumber() && newData.child('st').isString() && newData.child('st').val().length <= 65536",
        },
        $other: { '.validate': false },
      },
    },
  },
};

writeFileSync(new URL('../database.rules.json', import.meta.url), `${JSON.stringify(rules, null, 2)}\n`);
console.log(`database.rules.json geschrieben (${bad.length} Wörter, ${chatWords.length} Chat-Wörter, ${animals.length} Tiere)`);
