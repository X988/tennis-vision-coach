import { describe, expect, it } from 'vitest';
import { LIBRARY } from '../../content/library';
import { mirrorScenario, validateScenario } from '../scenario';

const s = LIBRARY.scenarios[0];

describe('scenario format', () => {
  it('rejects invalid data with readable paths', () => {
    const r = validateScenario({ ...s, incomingBall: { ...s.incomingBall, bounce: { x: 0, y: 5 } } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join()).toContain('incomingBall.bounce.y');
    expect(validateScenario({ ...s, id: 'bad id' }).ok).toBe(false);
  });

  it('mirroring twice gives the original', () => {
    expect(mirrorScenario(mirrorScenario(s))).toEqual(s);
    expect(mirrorScenario(s).incomingBall.bounce.x).toBe(-s.incomingBall.bounce.x);
  });
});
