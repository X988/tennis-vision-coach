import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [relative(root, p)];
  });
}

describe('file names', () => {
  it('no two files differ only by letter case (macOS and Windows would see one file)', () => {
    const files = [...walk(join(root, 'src')), ...walk(join(root, 'e2e'))];
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const f of files) {
      const k = f.toLowerCase();
      if (seen.has(k)) clashes.push(`${seen.get(k)} <-> ${f}`);
      seen.set(k, f);
    }
    expect(clashes).toEqual([]);
  });
});
