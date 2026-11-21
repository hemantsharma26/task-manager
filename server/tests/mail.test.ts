import { SMTPServer } from 'smtp-server';
import { simpleParser, type ParsedMail } from 'mailparser';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { assignmentMail, invitationMail, sendMail, SmtpMailer, useMailer, type Mailer } from '../src/infra/mail/index.js';
import { LogOnlyMailer } from '../src/infra/mail/mailer.js';

// A real SMTP conversation against a throwaway server, so the transport, the headers and the encoding are exercised for real.
describe('email', () => {
  const received: ParsedMail[] = [];
  let server: SMTPServer;
  let port = 0;

  beforeAll(async () => {
    server = new SMTPServer({
      authOptional: true,
      disabledCommands: ['STARTTLS'],
      onData(stream, _session, done) {
        simpleParser(stream).then((mail) => {
          received.push(mail);
          done();
        });
      },
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.server.address() as { port: number }).port;
  });
  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('delivers an invitation over SMTP with a text part, an HTML part and the link', async () => {
    const mailer = new SmtpMailer(`smtp://127.0.0.1:${port}`);
    useMailer(mailer);
    const mail = invitationMail({ to: 'sam@example.com', inviterName: 'Asha Verma', groupName: 'Design team', roleName: 'Editor', url: 'https://app.example/join?token=abc123', expiresInDays: 7 });
    expect(await sendMail(mail)).toBe(true);

    const got = received.at(-1)!;
    expect(got.to).toMatchObject({ text: 'sam@example.com' });
    expect(got.subject).toBe('Asha Verma invited you to join Design team');
    expect(got.text).toContain('https://app.example/join?token=abc123');
    expect(got.html).toContain('href="https://app.example/join?token=abc123"');
    mailer.close();
  });

  it('turns hostile names and task titles into inert text, never markup', async () => {
    const mailer = new SmtpMailer(`smtp://127.0.0.1:${port}`);
    useMailer(mailer);
    const evil = '<img src=x onerror=alert(1)>"\'&';
    const mail = assignmentMail({ to: 'sam@example.com', assignerName: evil, taskKey: 'TM-1', taskTitle: `<script>alert(1)</script>\r\nBcc: attacker@example.com`, projectName: evil, dueText: null, url: 'https://app.example/x' });
    await sendMail(mail);

    const got = received.at(-1)!;
    expect(String(got.html)).not.toMatch(/<script|<img/i);
    expect(String(got.html)).toContain('&lt;script&gt;');
    // a line break in the title cannot inject another header into the message
    expect(got.subject).not.toMatch(/[\r\n]/);
    expect(JSON.stringify(got.headers.get('bcc') ?? null)).toBe('null');
    mailer.close();
  });

  it('retries a failing server and then gives up quietly, without throwing into the request that asked', async () => {
    const send = vi.fn().mockRejectedValue(new Error('connection refused'));
    const broken: Mailer = { kind: 'broken', send, close: () => {} };
    useMailer(broken);
    const ok = await sendMail(invitationMail({ to: 'a@example.com', inviterName: 'A', groupName: 'G', roleName: 'R', url: 'https://x', expiresInDays: 7 }), 1);
    expect(ok).toBe(false);
    expect(send).toHaveBeenCalledTimes(3);
  });

  it('succeeds on a later attempt after a temporary failure', async () => {
    const send = vi.fn().mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce(undefined);
    useMailer({ kind: 'flaky', send, close: () => {} });
    expect(await sendMail(invitationMail({ to: 'a@example.com', inviterName: 'A', groupName: 'G', roleName: 'R', url: 'https://x', expiresInDays: 7 }), 1)).toBe(true);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('with no SMTP configured it only logs, and reports success so the app flow continues', async () => {
    useMailer(new LogOnlyMailer());
    expect(await sendMail(invitationMail({ to: 'a@example.com', inviterName: 'A', groupName: 'G', roleName: 'R', url: 'https://x', expiresInDays: 7 }))).toBe(true);
  });
});
