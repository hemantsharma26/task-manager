import { meetsPasswordRules, passwordRules, passwordStrength } from './password';

describe('password rules', () => {
  it('needs 10 characters and a mix, or a long passphrase', () => {
    expect(meetsPasswordRules('Short1!')).toBe(false);
    expect(meetsPasswordRules('alllowercaseonly')).toBe(true); // 16 chars: passphrase
    expect(meetsPasswordRules('alllower10')).toBe(false); // 10 chars, only two classes
    expect(meetsPasswordRules('Mixed9Case')).toBe(true);
  });

  it('reports each rule separately, so the checklist can tick them off one by one', () => {
    expect(passwordRules('abc').map((r) => r.ok)).toEqual([false, false]);
    expect(passwordRules('Abcdefghij1').map((r) => r.ok)).toEqual([true, true]);
  });

  it('counts characters, not UTF-16 units', () => {
    expect(passwordRules('😀😀😀😀😀😀😀😀😀😀').find((r) => r.id === 'length')!.ok).toBe(true);
  });

  it('gives a strength from 0 (empty) to 4', () => {
    expect(passwordStrength('')).toBe(0);
    expect(passwordStrength('abc')).toBe(1);
    expect(passwordStrength('Tr1cky-Harbor-Lamp!')).toBe(4);
  });
});
