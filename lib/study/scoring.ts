import type { ScoreInput } from "./types";

const clamp = (value: number) => Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));

export function opportunityScore(input: ScoreInput) {
  const s = {
    need: clamp(input.need),
    recurrence: clamp(input.recurrence),
    pain: clamp(input.pain),
    market: clamp(input.market),
    capture: clamp(input.capture),
    persistence: clamp(input.persistence),
    execution: clamp(input.execution),
    friction: clamp(input.friction),
  };
  const base =
    s.need * 0.18 +
    s.recurrence * 0.18 +
    s.pain * 0.14 +
    s.market * 0.12 +
    s.capture * 0.16 +
    s.persistence * 0.12 +
    s.execution * 0.10;
  const score = base * (1 - 0.20 * (s.friction / 100));
  return Math.round(score * 10) / 10;
}
