import { formatSize, kindOf, MAX_BYTES, problemWith, sortFiles } from './files';

const f = (name: string, type: string, size = 1000) => ({ name, type, size });

describe('file rules', () => {
  it('knows the kind from the type, or from the extension when the browser gives no type', () => {
    expect(kindOf(f('a.png', 'image/png'))).toBe('image');
    expect(kindOf(f('a.mov', ''))).toBe('video');
    expect(kindOf(f('REPORT.PDF', ''))).toBe('pdf');
    expect(kindOf(f('a.svg', 'image/svg+xml'))).toBeUndefined();
    expect(kindOf(f('a.exe', 'application/x-msdownload'))).toBeUndefined();
    expect(kindOf(f('noextension', ''))).toBeUndefined();
  });

  it('explains what is wrong with a file', () => {
    expect(problemWith(f('a.png', 'image/png'))).toBeNull();
    expect(problemWith(f('a.svg', 'image/svg+xml'))).toMatch(/not an allowed file/);
    expect(problemWith(f('empty.png', 'image/png', 0))).toMatch(/empty/);
    expect(problemWith(f('big.png', 'image/png', MAX_BYTES.image + 1))).toMatch(/image files can be at most 10 MB/);
    expect(problemWith(f('big.mp4', 'video/mp4', MAX_BYTES.video))).toBeNull();
    expect(problemWith(f('big.mp4', 'video/mp4', MAX_BYTES.video + 1))).toMatch(/video files can be at most 100 MB/);
  });

  it('sorts a selection into files that go and messages for those that do not, respecting the task limit', () => {
    const files = [f('a.png', 'image/png'), f('b.svg', 'image/svg+xml'), f('c.pdf', 'application/pdf'), f('d.png', 'image/png')] as File[];
    const { accepted, problems } = sortFiles(files, 0, 20);
    expect(accepted.map((x) => x.name)).toEqual(['a.png', 'c.pdf', 'd.png']);
    expect(problems).toHaveLength(1);

    const limited = sortFiles(files, 19, 20);
    expect(limited.accepted.map((x) => x.name)).toEqual(['a.png']);
    expect(limited.problems.join(' ')).toMatch(/at most 20 attachments/);
  });

  it('writes sizes the way people read them', () => {
    expect(formatSize(512)).toBe('512 B');
    expect(formatSize(2048)).toBe('2 KB');
    expect(formatSize(1.5 * 1024 * 1024)).toBe('1.5 MB');
    expect(formatSize(40 * 1024 * 1024)).toBe('40 MB');
  });
});
