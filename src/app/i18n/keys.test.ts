import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { translate } from './index';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) && !/\.test\./.test(f) ? [p] : [];
  });
}

describe('translations', () => {
  it('every literal key used in the interface exists in Russian', () => {
    const missing: string[] = [];
    for (const f of files(join(__dirname, '..'))) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'\s*[,)]/g)) {
        if (translate('ru', m[1]) === m[1]) missing.push(`${m[1]} (${f.split('/src/')[1]})`);
      }
    }
    expect(missing).toEqual([]);
  });
});
