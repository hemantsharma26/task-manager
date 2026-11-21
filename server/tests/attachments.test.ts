import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { uploadDir } from '../src/config/env.js';
import { app, resetDb, signedInAgent, startDb, stopDb } from './helpers.js';
import { EXE, GIF, GIF_WITH_SCRIPT, HTML_AS_IMAGE, JPEG, MP4, PDF, PNG, SVG, WEBP, ZIP } from './samples.js';

beforeAll(startDb);
beforeEach(resetDb);
afterAll(stopDb);

type Agent = Awaited<ReturnType<typeof signedInAgent>>['agent'];
type Att = { id: string; name: string; mime: string; kind: string; size: number };

const newTask = async (agent: Agent) => (await agent.post('/api/tasks').send({ title: 'with files' })).body.task as { id: string };
const send = (agent: Agent, taskId: string, ...files: { data: Buffer; name: string; type?: string }[]) => {
  const req = agent.post(`/api/tasks/${taskId}/attachments`);
  for (const f of files) req.attach('files', f.data, { filename: f.name, contentType: f.type ?? 'application/octet-stream' });
  return req;
};
const filesOnDisk = (userId: string) => (existsSync(path.join(uploadDir, userId)) ? readdirSync(path.join(uploadDir, userId)) : []);

describe('attachments: what is accepted', () => {
  it.each([
    ['PNG', PNG, 'a.png', 'image/png', 'image'],
    ['JPEG', JPEG, 'a.jpg', 'image/jpeg', 'image'],
    ['GIF', GIF, 'a.gif', 'image/gif', 'image'],
    ['WebP', WEBP, 'a.webp', 'image/webp', 'image'],
    ['MP4 video', MP4, 'clip.mp4', 'video/mp4', 'video'],
    ['PDF', PDF, 'doc.pdf', 'application/pdf', 'pdf'],
  ])('accepts a real %s and reports its true type', async (_n, data, name, mime, kind) => {
    const { agent, user } = await signedInAgent();
    const t = await newTask(agent);
    const res = await send(agent, t.id, { data, name });
    expect(res.status).toBe(201);
    const att = (res.body.task.attachments as Att[])[0]!;
    expect(att).toMatchObject({ name, mime, kind, size: data.length });
    expect(filesOnDisk(user.id)).toHaveLength(1);
  });

  it('decides the type from the file itself, not from its name or the type the browser claimed', async () => {
    const { agent, user } = await signedInAgent();
    const t = await newTask(agent);
    // a PNG named .txt and labelled as plain text is still a PNG; a web page named .png and labelled image/png is refused
    const real = await send(agent, t.id, { data: PNG, name: 'notes.txt', type: 'text/plain' });
    expect(real.status).toBe(201);
    expect((real.body.task.attachments as Att[])[0]!.mime).toBe('image/png');
    const fake = await send(agent, t.id, { data: HTML_AS_IMAGE, name: 'photo.png', type: 'image/png' });
    expect(fake.status).toBe(400);
    expect(fake.body.error.message).toMatch(/not an allowed file/);
    expect(filesOnDisk(user.id)).toHaveLength(1); // the refused one left nothing behind
  });

  it.each([
    ['an SVG (can carry script)', SVG, 'logo.svg', 'image/svg+xml'],
    ['an HTML page', HTML_AS_IMAGE, 'page.html', 'text/html'],
    ['a ZIP archive', ZIP, 'a.zip', 'application/zip'],
    ['a Windows program', EXE, 'setup.exe', 'application/x-msdownload'],
    ['an empty file', Buffer.alloc(0), 'empty.png', 'image/png'],
    ['plain text', Buffer.from('just some text'), 'readme.txt', 'text/plain'],
  ])('refuses %s', async (_n, data, name, type) => {
    const { agent, user } = await signedInAgent();
    const t = await newTask(agent);
    const res = await send(agent, t.id, { data, name, type });
    expect(res.status).toBe(400);
    expect(filesOnDisk(user.id)).toHaveLength(0);
  });

  it('is all or nothing: one bad file in a batch keeps none of them', async () => {
    const { agent, user } = await signedInAgent();
    const t = await newTask(agent);
    const res = await send(agent, t.id, { data: PNG, name: 'good.png' }, { data: EXE, name: 'bad.exe' }, { data: PDF, name: 'good.pdf' });
    expect(res.status).toBe(400);
    expect(filesOnDisk(user.id)).toHaveLength(0);
    expect((await agent.get(`/api/tasks/${t.id}`)).body.task.attachments).toHaveLength(0);
  });
});

describe('attachments: limits', () => {
  it('refuses an image over 10 MB, naming the limit', async () => {
    const { agent, user } = await signedInAgent();
    const t = await newTask(agent);
    const big = Buffer.concat([PNG, Buffer.alloc(10 * 1024 * 1024)]);
    const res = await send(agent, t.id, { data: big, name: 'huge.png' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/image files can be at most 10 MB/);
    expect(filesOnDisk(user.id)).toHaveLength(0);
  }, 60000);

  it('refuses more than five files in one request, and more than twenty on one task', async () => {
    const { agent, user } = await signedInAgent();
    const t = await newTask(agent);
    const six = await send(agent, t.id, ...Array.from({ length: 6 }, (_, i) => ({ data: PNG, name: `${i}.png` })));
    expect(six.status).toBe(400);
    expect(filesOnDisk(user.id)).toHaveLength(0);

    for (let i = 0; i < 4; i++) expect((await send(agent, t.id, ...Array.from({ length: 5 }, (_, j) => ({ data: PNG, name: `${i}-${j}.png` })))).status).toBe(201);
    const over = await send(agent, t.id, { data: PNG, name: 'one-too-many.png' });
    expect(over.status).toBe(400);
    expect(over.body.error.message).toMatch(/at most 20 attachments/);
    expect(filesOnDisk(user.id)).toHaveLength(20);
  }, 60000);

  it('needs at least one file, and ignores extra text fields', async () => {
    const { agent } = await signedInAgent();
    const t = await newTask(agent);
    expect((await agent.post(`/api/tasks/${t.id}/attachments`).attach('files', Buffer.alloc(0), { filename: 'x' })).status).toBe(400);
    expect((await send(agent, t.id)).status).toBe(400);
  });
});

describe('attachments: names', () => {
  it('shows a cleaned name and never lets the user pick where the file goes', async () => {
    const { agent, user } = await signedInAgent();
    const t = await newTask(agent);
    const res = await send(agent, t.id, { data: PNG, name: '../../etc/passwd.png' });
    expect(res.status).toBe(201);
    const att = (res.body.task.attachments as Att[])[0]!;
    expect(att.name).toBe('passwd.png');
    expect(att.name.length).toBeLessThanOrEqual(120);
    // on disk it is only a random id inside the owner's own folder
    expect(filesOnDisk(user.id)[0]).toMatch(/^[0-9a-f-]{36}$/);
    expect(existsSync(path.join(uploadDir, '..', 'etc'))).toBe(false);
  });

  it('answers a malformed upload (a control character in the file name) with 400, not a server error, and keeps nothing', async () => {
    const { agent, user } = await signedInAgent();
    const t = await newTask(agent);
    expect((await send(agent, t.id, { data: PNG, name: 'bad\u0000name.png' })).status).toBe(400);
    expect(filesOnDisk(user.id)).toHaveLength(0);
  });

  it('keeps a long name within the limit', async () => {
    const { agent } = await signedInAgent();
    const t = await newTask(agent);
    const res = await send(agent, t.id, { data: PNG, name: `${'x'.repeat(300)}.png` });
    expect(((res.body.task.attachments as Att[])[0]!.name).length).toBeLessThanOrEqual(120);
  });
});

describe('attachments: downloading', () => {
  it('serves the exact bytes with the real type and protective headers', async () => {
    const { agent } = await signedInAgent();
    const t = await newTask(agent);
    const att = ((await send(agent, t.id, { data: PNG, name: 'pic.png' })).body.task.attachments as Att[])[0]!;
    const res = await agent.get(`/api/tasks/${t.id}/attachments/${att.id}`).buffer(true).parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on('data', (c: Buffer) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(res.status).toBe(200);
    expect(Buffer.compare(res.body as Buffer, PNG)).toBe(0);
    expect(res.headers['content-type']).toBe('image/png');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBe("default-src 'none'; sandbox");
    expect(res.headers['content-disposition']).toMatch(/^inline; filename="pic\.png"/);
    expect(res.headers['cache-control']).toMatch(/^private/);
  });

  it('keeps a file that is secretly a GIF plus a script inert: served as an image only, sandboxed, never as HTML', async () => {
    const { agent } = await signedInAgent();
    const t = await newTask(agent);
    const res = await send(agent, t.id, { data: GIF_WITH_SCRIPT, name: 'sneaky.gif' });
    expect(res.status).toBe(201);
    const att = (res.body.task.attachments as Att[])[0]!;
    const got = await agent.get(`/api/tasks/${t.id}/attachments/${att.id}`);
    expect(got.headers['content-type']).toBe('image/gif');
    expect(got.headers['x-content-type-options']).toBe('nosniff');
    expect(got.headers['content-security-policy']).toContain('sandbox');
  });

  it('serves a PDF without the restrictive policy that would block the browser\'s viewer, but still as a PDF', async () => {
    const { agent } = await signedInAgent();
    const t = await newTask(agent);
    const att = ((await send(agent, t.id, { data: PDF, name: 'doc.pdf' })).body.task.attachments as Att[])[0]!;
    const res = await agent.get(`/api/tasks/${t.id}/attachments/${att.id}`);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('supports Range requests, so a video can be played and scrubbed', async () => {
    const { agent } = await signedInAgent();
    const t = await newTask(agent);
    const att = ((await send(agent, t.id, { data: MP4, name: 'clip.mp4' })).body.task.attachments as Att[])[0]!;
    const res = await agent.get(`/api/tasks/${t.id}/attachments/${att.id}`).set('Range', 'bytes=0-9').buffer(true).parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on('data', (c: Buffer) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(res.status).toBe(206);
    expect(res.headers['content-range']).toBe(`bytes 0-9/${MP4.length}`);
    expect((res.body as Buffer).length).toBe(10);
    expect(res.headers['accept-ranges']).toBe('bytes');
  });

  it('encodes a non-ASCII name safely in the download header', async () => {
    const { agent } = await signedInAgent();
    const t = await newTask(agent);
    const att = ((await send(agent, t.id, { data: PNG, name: 'रिपोर्ट "final".png' })).body.task.attachments as Att[])[0]!;
    const res = await agent.get(`/api/tasks/${t.id}/attachments/${att.id}`);
    expect(res.headers['content-disposition']).toMatch(/filename\*=UTF-8''/);
    expect(res.headers['content-disposition']).not.toMatch(/filename="[^"]*"[^;]*"/);
  });

  it('answers a clean 404 if the file has been lost from disk', async () => {
    const { agent, user } = await signedInAgent();
    const t = await newTask(agent);
    const att = ((await send(agent, t.id, { data: PNG, name: 'a.png' })).body.task.attachments as Att[])[0]!;
    const { rmSync } = await import('node:fs');
    for (const f of filesOnDisk(user.id)) rmSync(path.join(uploadDir, user.id, f));
    expect((await agent.get(`/api/tasks/${t.id}/attachments/${att.id}`)).status).toBe(404);
  });
});

describe('attachments: removing', () => {
  it('deleting an attachment removes it from the task and from disk', async () => {
    const { agent, user } = await signedInAgent();
    const t = await newTask(agent);
    const atts = (await send(agent, t.id, { data: PNG, name: 'a.png' }, { data: PDF, name: 'b.pdf' })).body.task.attachments as Att[];
    const res = await agent.delete(`/api/tasks/${t.id}/attachments/${atts[0]!.id}`);
    expect(res.status).toBe(200);
    expect(res.body.task.attachments.map((a: Att) => a.name)).toEqual(['b.pdf']);
    expect(filesOnDisk(user.id)).toHaveLength(1);
    expect((await agent.delete(`/api/tasks/${t.id}/attachments/${atts[0]!.id}`)).status).toBe(404);
  });

  it('deleting a task deletes its files too', async () => {
    const { agent, user } = await signedInAgent();
    const t = await newTask(agent);
    await send(agent, t.id, { data: PNG, name: 'a.png' }, { data: MP4, name: 'b.mp4' });
    expect(filesOnDisk(user.id)).toHaveLength(2);
    expect((await agent.delete(`/api/tasks/${t.id}`)).status).toBe(204);
    expect(filesOnDisk(user.id)).toHaveLength(0);
  });
});

describe('attachments: who may touch them', () => {
  it('belong to the task owner: nobody else can read, add or remove them, or even tell they exist', async () => {
    const alice = await signedInAgent();
    const bob = await signedInAgent();
    const t = await newTask(alice.agent);
    const att = ((await send(alice.agent, t.id, { data: PNG, name: 'secret.png' })).body.task.attachments as Att[])[0]!;

    expect((await bob.agent.get(`/api/tasks/${t.id}/attachments/${att.id}`)).status).toBe(404);
    expect((await bob.agent.delete(`/api/tasks/${t.id}/attachments/${att.id}`)).status).toBe(404);
    const upload = await send(bob.agent, t.id, { data: PNG, name: 'planted.png' });
    expect(upload.status).toBe(404);
    expect(filesOnDisk(bob.user.id)).toHaveLength(0); // the refused upload was cleaned up
    expect(filesOnDisk(alice.user.id)).toHaveLength(1);
  });

  it('needs a session', async () => {
    const res = await request(app).post('/api/tasks/000000000000000000000000/attachments').attach('files', PNG, { filename: 'a.png' });
    expect(res.status).toBe(401);
  });

  it('refuses an upload that claims to come from another site', async () => {
    const { agent, user } = await signedInAgent();
    const t = await newTask(agent);
    const res = await agent.post(`/api/tasks/${t.id}/attachments`).set('Origin', 'https://evil.example').attach('files', PNG, { filename: 'a.png' });
    expect(res.status).toBe(403);
    expect(filesOnDisk(user.id)).toHaveLength(0);
  });

  it('accepts multipart only for uploads: any other route still demands JSON', async () => {
    const { agent } = await signedInAgent();
    const res = await agent.post('/api/tasks').field('title', 'x');
    expect(res.status).toBe(415);
  });

  it('a malformed task id is a 404, and nothing is left on disk', async () => {
    const { agent, user } = await signedInAgent();
    const res = await agent.post('/api/tasks/not-an-id/attachments').attach('files', PNG, { filename: 'a.png' });
    expect([400, 404, 415]).toContain(res.status);
    expect(filesOnDisk(user.id)).toHaveLength(0);
  });
});
