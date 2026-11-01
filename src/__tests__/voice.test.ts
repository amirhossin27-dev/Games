import { describe, expect, it } from 'vitest';
import { makeTask, type Subject } from '../learn/tasks';
import { lockSpeech, tipSpeech } from '../lib/speechtexts';
import { compose, neededKeys, planVoice, sentences, voiceKey } from '../lib/voiceplan';
import index from '../../public/stimme/index.json';

describe('Joys Stimme: welche Aufnahme gehört zu welchem Text', () => {
  it('schreibt Texte einheitlich (Gedankenstrich, Pünktchen, Emoji, Rechenzeichen)', () => {
    expect(voiceKey('Hallo! Ich bin Joy. Wie heißt du – und welches Tier bist du?')).toBe('Hallo! Ich bin Joy. Wie heißt du, und welches Tier bist du?');
    expect(voiceKey('Ich verbinde mich mit dem Spielzimmer …')).toBe('Ich verbinde mich mit dem Spielzimmer');
    expect(voiceKey('Super gespielt! 🎉')).toBe('Super gespielt!');
    expect(voiceKey('„Ich kann das noch nicht“ heißt: Bald kannst du es!')).toBe('Ich kann das noch nicht heißt: Bald kannst du es!');
    expect(voiceKey('Wie viel ist 3 + 4?')).toBe('Wie viel ist 3 plus 4?');
  });

  it('teilt Texte in Sätze', () => {
    expect(sentences('Richtig ist 7. Zähl von 4 aus 3 weiter.')).toEqual(['Richtig ist 7.', 'Zähl von 4 aus 3 weiter.']);
    expect(sentences('  ')).toEqual([]);
  });

  it('baut Rechenaufgaben und Uhrzeiten aus Bausteinen', () => {
    expect(compose('Wie viel ist 42 minus 2?')).toEqual(['Wie viel ist', '#42', 'minus', '#2?']);
    expect(compose('Richtig ist 10:50.')).toEqual(['Richtig ist', '#10:50.']);
    expect(compose('Zähl von 42 aus 2 zurück.')).toEqual(['Zähl von', '#42', 'aus', '#2', 'zurück.']);
    expect(compose('Kein Satz mit Zahl.')).toBeNull();
  });

  it('nimmt den ganzen Satz, wenn es ihn gibt, sonst die Bausteine', () => {
    const whole = new Set(['Wie viel ist 3 plus 4?']);
    expect(planVoice('Wie viel ist 3 plus 4?', (k) => whole.has(k))).toEqual([['Wie viel ist 3 plus 4?']]);
    const parts = new Set(['Wie viel ist', '#42', 'minus', '#2?']);
    expect(planVoice('Wie viel ist 42 minus 2?', (k) => parts.has(k))).toEqual([['Wie viel ist', '#42', 'minus', '#2?']]);
    // Fehlt ein Baustein, bleibt der Satz lieber ganz stumm als halb
    parts.delete('#2?');
    expect(planVoice('Wie viel ist 42 minus 2?', (k) => parts.has(k))).toEqual([]);
  });

  it('lässt Sätze mit getippten Namen aus und liest den Rest', () => {
    const has = (k: string) => k === 'Gib das Gerät weiter, nicht spicken!' || k === 'Wie viel ist 3 plus 4?';
    expect(planVoice('Lena ist dran. Gib das Gerät weiter – nicht spicken!', has)).toEqual([['Gib das Gerät weiter, nicht spicken!']]);
    expect(planVoice(['Lena, ', 'Wie viel ist 3 plus 4?'], has)).toEqual([['Wie viel ist 3 plus 4?']]);
  });

  it('findet für jede Aufgabe genau die Aufnahmen, die der Satz-Sammler anlegt', () => {
    let seed = 42;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const subjects: Subject[] = ['rechnen', 'buchstaben', 'uhr', 'welt', 'woerter', 'englisch'];
    for (const subject of subjects)
      for (const level of [0, 1, 2] as const)
        for (let i = 0; i < 200; i++) {
          const t = makeTask(subject, level, rnd);
          const text = [t.say, tipSpeech(t)];
          const keys = new Set(neededKeys(text, subject === 'rechnen' ? 10 : Infinity));
          const plan = planVoice(text, (k) => keys.has(k));
          expect(plan.length, `${subject} ${level}: ${text.join(' ')}`).toBe(text.flatMap(sentences).length);
        }
    const lock = lockSpeech(3);
    expect(planVoice(lock, (k) => neededKeys(lock).includes(k)).length).toBe(2);
  });

  it('hat für jeden Eintrag im Verzeichnis auch eine Tondatei', () => {
    const files = new Set(Object.keys(import.meta.glob('../../public/stimme/*.mp3')).map((f) => f.split('/').pop()));
    const missing = Object.values(index.clips as Record<string, string>).filter((id) => !files.has(`${id}.mp3`));
    expect(Object.keys(index.clips).length).toBeGreaterThan(0);
    expect(missing).toEqual([]);
  });
});
