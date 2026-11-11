/**
 * Lesson scenario data format (section 6 of the spec). Scenarios are plain
 * JSON validated with zod; see docs/SCENARIO_FORMAT.md for the semantics.
 */
import { z } from 'zod';

export const SCENARIO_SCHEMA_VERSION = 1;

const courtPoint = z.object({ x: z.number().min(-8).max(8), y: z.number().min(-18).max(18) });
const localized = z.object({ ru: z.string().min(1), uk: z.string().optional(), en: z.string().optional() });

export const STANCES = ['open', 'semi_open', 'neutral', 'closed'] as const;
export const DECISIONS = ['first_step', 'stance', 'position', 'prep_timing'] as const;
export const ERROR_VARIANTS = ['late_prep', 'no_split_step', 'wrong_stance', 'too_close'] as const;
export const FOCUS = ['split_step', 'first_step', 'unit_turn', 'footwork', 'stance', 'contact', 'recovery'] as const;
export const CATEGORIES = ['short', 'medium', 'deep', 'wide', 'body', 'fast', 'slow', 'high', 'low'] as const;
export const CAMERAS = ['top', 'side', 'back', 'opponent', 'free'] as const;

export const scenarioSchema = z
  .object({
    id: z.string().regex(/^[A-Z0-9_]+$/, 'id: UPPER_SNAKE_CASE'),
    version: z.number().int().positive(),
    schemaVersion: z.literal(SCENARIO_SCHEMA_VERSION),
    title: localized,
    description: localized,
    surface: z.enum(['hard', 'clay', 'grass']).default('hard'),
    player: z.object({
      /** Handedness the scenario was authored for; it is mirrored for the other hand. */
      handedness: z.enum(['right', 'left']),
      backhand: z.enum(['two_handed', 'one_handed']),
      /** Pelvis ground position at the start (court coordinates). */
      start: courtPoint,
      level: z.enum(['beginner', 'intermediate', 'advanced']),
    }),
    incomingBall: z.object({
      /** Opponent's contact point; default: centre of the opponent's baseline at 1 m. */
      launch: z.object({ x: z.number(), y: z.number().min(0), h: z.number().min(0.2).max(3.5) }).optional(),
      /** Ball speed just BEFORE the bounce, km/h (what the receiver perceives). */
      speedKmh: z.number().min(25).max(220),
      spin: z.enum(['flat', 'topspin', 'slice']),
      /** Explicit spin rate; otherwise derived from apexM or the spin type default. */
      spinRpm: z.number().min(-4500).max(5000).optional(),
      bounce: courtPoint,
      /** Highest point of the flight before the bounce, metres. */
      apexM: z.number().min(1).max(8).optional(),
    }),
    task: z.object({
      shot: z.enum(['forehand', 'backhand']),
      goal: z.enum(['neutral', 'attacking', 'defensive']),
    }),
    learning: z.object({
      focus: z.array(z.enum(FOCUS)).min(1),
      difficulty: z.number().int().min(1).max(3),
      coachApproved: z.boolean(),
      categories: z.array(z.enum(CATEGORIES)).min(1),
      /** Questions asked before the demonstration. */
      decisions: z.array(z.enum(DECISIONS)).min(1),
      /** The typical mistake shown in the comparison mode. */
      errorVariant: z.enum(ERROR_VARIANTS),
      /** At least two recommended camera angles for the breakdown. */
      cameras: z.array(z.enum(CAMERAS)).min(2),
    }),
  })
  .superRefine((s, ctx) => {
    if (s.incomingBall.bounce.y >= 0) {
      ctx.addIssue({ code: 'custom', path: ['incomingBall', 'bounce', 'y'], message: 'bounce must be on the player half (y < 0)' });
    }
    if (s.player.start.y > -5) {
      ctx.addIssue({ code: 'custom', path: ['player', 'start', 'y'], message: 'player starts on their own half' });
    }
  });

export type ScenarioSpec = z.infer<typeof scenarioSchema>;
export type Stance = (typeof STANCES)[number];
export type DecisionKind = (typeof DECISIONS)[number];
export type ErrorVariant = (typeof ERROR_VARIANTS)[number];
export type Category = (typeof CATEGORIES)[number];
export type CameraId = (typeof CAMERAS)[number];
export type Goal = ScenarioSpec['task']['goal'];
export type ShotSide = ScenarioSpec['task']['shot'];
export type SpinType = ScenarioSpec['incomingBall']['spin'];

export function parseScenario(data: unknown): ScenarioSpec {
  return scenarioSchema.parse(data);
}

export function validateScenario(data: unknown): { ok: true; value: ScenarioSpec } | { ok: false; errors: string[] } {
  const r = scenarioSchema.safeParse(data);
  if (r.success) return { ok: true, value: r.data };
  return { ok: false, errors: r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };
}

/** Mirror a scenario authored for one hand so it plays for the other (X -> -X). */
export function mirrorScenario(s: ScenarioSpec): ScenarioSpec {
  const flip = <T extends { x: number }>(p: T): T => ({ ...p, x: -p.x });
  return {
    ...s,
    player: { ...s.player, handedness: s.player.handedness === 'right' ? 'left' : 'right', start: flip(s.player.start) },
    incomingBall: {
      ...s.incomingBall,
      bounce: flip(s.incomingBall.bounce),
      launch: s.incomingBall.launch ? flip(s.incomingBall.launch) : undefined,
    },
  };
}
