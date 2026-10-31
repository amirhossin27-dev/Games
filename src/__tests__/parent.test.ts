import { describe, expect, it } from 'vitest';
import { checkParentPassword, checkRecoveryCode, isPowerPassword, setParentPassword } from '../lib/parent';

describe('Eltern-Passwort', () => {
  it('nimmt das eigene Passwort und den Notfall-Code an, aber nichts anderes', async () => {
    const code = await setParentPassword('Sonne123');
    expect(await checkParentPassword('Sonne123')).toBe(true);
    expect(await checkParentPassword('sonne123')).toBe(false);
    expect(await checkParentPassword('')).toBe(false);
    expect(await checkRecoveryCode(code.toLowerCase())).toBe(true);
    expect(await checkRecoveryCode('ABCD-2345')).toBe(false);
  });

  it('ein normales Passwort ist kein Power-Passwort', async () => {
    expect(await isPowerPassword('Sonne123')).toBe(false);
    expect(await isPowerPassword('')).toBe(false);
    expect(await isPowerPassword('hilfe')).toBe(false);
  });
});
