export type Phase = 'plan' | 'design' | 'delegate' | 'review' | 'close'

export type PlannedTask = {
  title: string
  tier: string
  after: number[]
}

export type Flow = {
  title: string
  total: number
  done: number
  running: number
  phase: Phase
  isFinished: boolean
  tasks: PlannedTask[]
}

export type AgentStatus = 'running' | 'done' | 'failed'

export type AgentRun = {
  id: string
  agentId?: string
  type: string
  description: string
  model: string
  effort?: string
  status: AgentStatus
  startedAt: number
  endedAt?: number
  contextTokens: number
  contextMax: number
  tokens: number
  costUsd: number
  steps: number
  round: number
  /** Self-reported by the worker through the `step` tool. */
  stepDone?: number
  stepTotal?: number
  stepNote?: string
}

export type Panel = {
  isCompact: boolean
  autoOpenedFor: string
}

/** A file Claude read or edited this session (the file tree's marks). */
export type Touch = { kind: 'read' | 'edit'; at: number }

declare module 'claude-code' {
  interface PluginState {
    'savvy-progress': {
      flow: Flow | null
      agents: AgentRun[]
      panel: Panel
      now: number
      /** Finished agents shown open while this equals their count; -1 closed. */
      doneOpenAt: number
      // The file tree, drawn below the agents.
      root: string
      files: string[]
      mtimes: Record<string, number>
      touched: Record<string, Touch>
      active: string[]
      dirty: string[]
      committed: string[]
      expanded: Record<string, boolean>
      frame: number
      focused: string
    }
  }
}
