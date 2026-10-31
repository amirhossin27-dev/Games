// Baut database.rules.json. Die Namensprüfung steht dort ausgeschrieben, weil die Regeln der
// Firebase-Datenbank keine Variablen kennen. Die Wortliste kommt aus src/lib/names.ts.
// Aufruf: npm run rules – danach den Inhalt in der Firebase-Konsole unter „Regeln“ einfügen.
// Ein Test in src/__tests__/online.test.ts prüft, ob die Datei zur Wortliste passt.
import { readFileSync, writeFileSync } from 'node:fs';

const names = readFileSync(new URL('../src/lib/names.ts', import.meta.url), 'utf8');
const list = (name) => [...names.match(new RegExp(`export const ${name}[^=]*= \\[([^\\]]*)\\]`, 's'))[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
const bad = list('BAD_WORDS');
const animals = [...names.match(/export const ANIMALS[^=]*= \[(.*?)\];/s)[1].matchAll(/kind: '([a-z]+)'/g)].map((m) => m[1]);

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
const avatarOk = (a) => `(${animals.map((x) => `${a}.val() === '${x}'`).join(' || ')})`;
const colorOk = (d) => `(!${d}.hasChild('color') || ${d}.child('color').val().matches(/^#[0-9a-fA-F]{6}$/))`;
const person = (d) => [`${d}.hasChildren(['name', 'avatar', 'at'])`, nameOk(`${d}.child('name')`), avatarOk(`${d}.child('avatar')`), colorOk(d)].join(' && ');

const room = "rooms/' + $code + '";
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
console.log(`database.rules.json geschrieben (${bad.length} Wörter, ${animals.length} Tiere)`);
