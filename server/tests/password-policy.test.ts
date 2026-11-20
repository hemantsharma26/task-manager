import { describe, expect, it } from 'vitest';
import { checkPassword } from '../src/modules/auth/password.policy.js';

const who = { email: 'asha.verma@example.com', name: 'Asha Verma' };

describe('password policy', () => {
  it.each(['Tr1cky-Harbor-Lamp!', 'correct horse battery staple', 'Zx9#kLm2$Qw8', 'my-very-long-and-unusual-passphrase'])('accepts %s', (password) => {
    expect(checkPassword(password, who)).toEqual([]);
  });

  it('checks length in characters, not bytes, so non-Latin passwords are not penalised', () => {
    expect(checkPassword('पासवर्ड-Secure-9', who)).toEqual([]);
    expect(checkPassword('Ab1!', who)).toContain('min');
  });

  it('caps absurdly long passwords', () => {
    expect(checkPassword('A1!' + 'x'.repeat(200), who)).toContain('max');
  });

  it.each(['password', 'Password1', 'P@ssw0rd', 'P@ssw0rd2026!', 'qwerty123456', 'Welcome@123', 'iloveyou!', 'Admin#2024', 'letmein1234'])('flags the common password %s even when dressed up', (password) => {
    expect(checkPassword(password, who)).toContain('common');
  });

  it('requires three of four character classes unless the password is a long passphrase', () => {
    expect(checkPassword('onlylowercaseletters', who)).toEqual([]); // 20 chars: a passphrase
    expect(checkPassword('onlylower1', who)).toContain('classes');
    expect(checkPassword('Mixed9Case', who)).toEqual([]);
  });

  it('refuses a password that contains the user\'s name or email name', () => {
    expect(checkPassword('Verma-Rocks-2026!', who)).toContain('personal');
    expect(checkPassword('ilove-asha.verma-9X', who)).toContain('personal');
  });

  it('refuses one repeated character and simple sequences', () => {
    expect(checkPassword('aaaaaaaaaaaa', who)).toContain('repeated');
    expect(checkPassword('abcdefghijkl', who)).toContain('repeated');
    expect(checkPassword('zyxwvutsrqpo', who)).toContain('repeated');
  });
});
