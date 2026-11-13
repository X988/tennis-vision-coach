import { useEffect, useRef } from 'react';
import { SimulationClock } from '../../engines/clock';
import { Plan } from '../../engines/plan';
import { useT } from '../i18n';
import { useVoice } from './context';
import { phaseCue, primaryPhase } from './narration';
import { PRIORITY } from './speaker';

/**
 * Names the phases while the lesson plays and explains a phase when the
 * learner stops on it. Reads the shared simulation clock a few times per
 * second; scrubbing only speaks once the position has settled.
 */
export function usePhaseVoice(plan: Plan | null, clock: SimulationClock, active: boolean) {
  const t = useT();
  const voice = useVoice();
  const last = useRef<{ id: string | null; playing: boolean }>({ id: null, playing: false });
  const settle = useRef<number | null>(null);

  useEffect(() => {
    if (!plan || !active || !voice.enabled) return;
    // Start silent: only changes that happen from now on are narrated.
    last.current = { id: primaryPhase(plan, clock.time)?.id ?? null, playing: clock.playing };
    const id = window.setInterval(() => {
      const phase = primaryPhase(plan, clock.time);
      const pid = phase?.id ?? null;
      const prev = last.current;
      if (pid === prev.id) {
        prev.playing = clock.playing;
        return;
      }
      last.current = { id: pid, playing: clock.playing };
      if (settle.current) window.clearTimeout(settle.current);
      if (!phase) return;
      if (clock.playing) {
        const cue = phaseCue(t, phase.id, true, clock.rate);
        if (cue) voice.say(cue, { priority: PRIORITY.cue });
      } else {
        settle.current = window.setTimeout(() => {
          const now = primaryPhase(plan, clock.time);
          if (now && now.id === phase.id && !clock.playing) voice.say(phaseCue(t, phase.id, false, clock.rate)!, { priority: PRIORITY.phase });
        }, 350);
      }
    }, 60);
    return () => {
      window.clearInterval(id);
      if (settle.current) window.clearTimeout(settle.current);
    };
  }, [plan, clock, active, voice, t]);
}
