import { meetsPasswordRules, passwordChangeProblems, passwordRules, passwordStrength } from './password';

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

describe('passwordChangeProblems', () => {
  const good = { current: 'Old-Password-1!', next: 'Brand-New-Kettle-47!', confirm: 'Brand-New-Kettle-47!' };

  it('is valid only when everything is right', () => {
    expect(passwordChangeProblems(good).valid).toBe(true);
  });

  it('needs the current password', () => {
    expect(passwordChangeProblems({ ...good, current: '' })).toMatchObject({ valid: false, current: expect.any(String) });
  });

  it('needs a new password that meets the rules and differs from the current one', () => {
    expect(passwordChangeProblems({ ...good, next: 'short', confirm: 'short' })).toMatchObject({ valid: false, next: expect.stringContaining('rules') });
    expect(passwordChangeProblems({ current: good.next, next: good.next, confirm: good.next })).toMatchObject({ valid: false, next: expect.stringContaining('different') });
  });

  it('needs the confirmation to match exactly', () => {
    expect(passwordChangeProblems({ ...good, confirm: '' })).toMatchObject({ valid: false, confirm: expect.stringContaining('again') });
    expect(passwordChangeProblems({ ...good, confirm: good.next + 'x' })).toMatchObject({ valid: false, confirm: expect.stringContaining('match') });
  });

  it('has no "current password" check when there is none (a reset from an emailed link)', () => {
    expect(passwordChangeProblems({ next: good.next, confirm: good.next }).valid).toBe(true);
  });
});
