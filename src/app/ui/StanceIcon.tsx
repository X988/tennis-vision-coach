import { Stance } from '../../engines/scenario';
import { STANCE_LAYOUTS } from '../../engines/technique';

/** Top view of a stance for a right-handed forehand: ball side to the right, net up. */
export function StanceIcon({ stance, size = 56 }: { stance: Stance; size?: number }) {
  const l = STANCE_LAYOUTS[stance];
  const X = (s: number) => 50 + s * 70;
  const Y = (f: number) => 55 - f * 70;
  const foot = (p: { s: number; f: number; yaw: number }, c: string) => (
    <g transform={`translate(${X(p.s)} ${Y(p.f)}) rotate(${p.yaw})`}>
      <ellipse cx={0} cy={-4} rx={6} ry={11} fill={c} />
    </g>
  );
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <line x1="10" y1="10" x2="90" y2="10" stroke="currentColor" strokeOpacity="0.35" strokeWidth="2" strokeDasharray="4 4" />
      <circle cx={X(0.82)} cy={Y(0.38)} r={5} fill="#d7f230" />
      {foot(l.outside, '#7fe3ff')}
      {foot(l.inside, '#e8edf5')}
    </svg>
  );
}
