import type { AgentRun } from '../types'

// Worker steps: the instruction every subagent gets to report them, and the
// time-to-finish estimate drawn from them. Pure helpers, no `$`.

// The same name as register.tsx's STEP_TOOL (kept a literal there for its matcher).
const STEP_TOOL = 'mcp__savvy-progress__step'

// The instruction's opening words: a prompt that already holds them is left as it is.
const MARKER = `Progress reporting: if the tool ${STEP_TOOL} is available`

/** Appended to every Agent prompt; worded to the step tool's `done`, `total`, `note`. */
export const STEP_INSTRUCTION =
  `${MARKER}, call it right after you plan with done: 0 and total: your step count, ` +
  'then after each finished step with the new done and a 2-4 word note; ' +
  'raise total if you find more steps. Skip this silently if the tool is missing.'

// Agents talk to each other in caveman: the report a worker hands back is
// read by another model, so it drops the filler and keeps the facts exact.
const CAVEMAN_MARKER = 'Report style: caveman'

/** Appended to every Agent prompt next to the step instruction. */
export const CAVEMAN_INSTRUCTION =
  `${CAVEMAN_MARKER}. Your final report goes to another agent, not a person: write it terse, ` +
  'fragments OK, no articles, filler, pleasantries or hedging. Keep code, paths, commands, ' +
  'numbers and exact error text unchanged. Files, code, commits and anything a person reads stay in normal style.'

/** The prompt with the step and caveman instructions appended, each once. */
export const withStepInstruction = (prompt: string): string => {
  const extra = [
    prompt.includes(MARKER) ? '' : STEP_INSTRUCTION,
    prompt.includes(CAVEMAN_MARKER) ? '' : CAVEMAN_INSTRUCTION,
  ].filter(Boolean)
  if (extra.length === 0) return prompt
  return [prompt, ...extra].filter(Boolean).join('\n\n')
}

export type Eta = { kind: 'left'; ms: number } | { kind: 'estimating' } | { kind: 'finishing' }

/**
 * A running agent's estimate from its reported steps: elapsed time per step
 * done, times the steps left. None without steps and none once it ended.
 */
export const etaOf = (a: AgentRun, at: number): Eta | null => {
  if (a.status !== 'running' || !a.stepTotal || a.stepTotal <= 0) return null
  const done = a.stepDone ?? 0
  if (done <= 0) return { kind: 'estimating' }
  if (done >= a.stepTotal) return { kind: 'finishing' }
  const elapsed = Math.max(0, at - a.startedAt)
  return { kind: 'left', ms: (elapsed * (a.stepTotal - done)) / done }
}

const WORDS = {
  en: { s: 's', m: 'm', h: 'h', left: 'left', estimating: 'estimating…', finishing: 'finishing…' },
  ru: { s: 'с', m: 'м', h: 'ч', left: 'осталось', estimating: 'оценка…', finishing: 'завершает…' },
} as const

/** `~45s left`, `~4m left`, `~1h 5m left`: seconds under a minute, whole minutes after. */
export const fmtLeft = (ms: number, lang: 'en' | 'ru' = 'en'): string => {
  const w = WORDS[lang]
  const s = Math.round(Math.max(0, ms) / 1000)
  if (s < 60) return `~${Math.max(1, s)}${w.s} ${w.left}`
  const m = Math.round(s / 60)
  if (m < 60) return `~${m}${w.m} ${w.left}`
  const h = Math.floor(m / 60)
  const mm = m % 60
  return `~${h}${w.h}${mm ? ` ${mm}${w.m}` : ''} ${w.left}`
}

/** The card's ETA text, or '' when there is nothing honest to show. */
export const etaText = (a: AgentRun, at: number, lang: 'en' | 'ru' = 'en'): string => {
  const eta = etaOf(a, at)
  if (!eta) return ''
  if (eta.kind === 'left') return fmtLeft(eta.ms, lang)
  return WORDS[lang][eta.kind]
}
