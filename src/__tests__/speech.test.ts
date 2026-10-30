import { describe, expect, it } from 'vitest';
import { rateVoice, sentences } from '../lib/speech';

const v = (name: string, voiceURI = name, lang = 'de-DE', localService = true) => ({ name, voiceURI, lang, localService, default: false });

describe('Vorlese-Stimme', () => {
  it('zieht natürliche Stimmen den roboterhaften vor', () => {
    const voices = [
      v('Eddy (Deutsch (Deutschland))', 'com.apple.eloquence.de-DE.Eddy'),
      v('Anna', 'com.apple.voice.compact.de-DE.Anna'),
      v('Anna (Premium)', 'com.apple.voice.premium.de-DE.Anna'),
      v('Microsoft Katja - German (Germany)'),
      v('Microsoft Seraphina Online (Natural) - German (Germany)', 'x', 'de-DE', false),
      v('Google Deutsch', 'Google Deutsch', 'de-DE', false),
      v('German', 'espeak-ng German'),
    ];
    const order = [...voices].sort((a, b) => rateVoice(b) - rateVoice(a)).map((x) => x.name);
    // Gleich gute Stimme auf dem Gerät vor der aus dem Internet
    expect(order.slice(0, 3)).toEqual(['Anna (Premium)', 'Microsoft Seraphina Online (Natural) - German (Germany)', 'Google Deutsch']);
    expect(order.indexOf('Anna')).toBeLessThan(order.indexOf('Microsoft Katja - German (Germany)'));
    expect(order.slice(-2).sort()).toEqual(['Eddy (Deutsch (Deutschland))', 'German'].sort());
  });

  it('liest satzweise und ohne Emojis vor', () => {
    expect(sentences('Sammle Äpfel 🍎, dann wird die Schlange länger. Nicht beißen!')).toEqual(['Sammle Äpfel , dann wird die Schlange länger.', 'Nicht beißen!']);
    expect(sentences('Die Geister jagen dich – weich ihnen aus!')).toEqual(['Die Geister jagen dich, weich ihnen aus!']);
    expect(sentences('Warte …')).toEqual(['Warte .']);
    expect(sentences('🍎 ⭐')).toEqual([]);
  });
});
