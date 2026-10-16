import type { On, RenderPropsOf } from 'claude-code'
import { describe, expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'savvy-progress',
  component: 'Pane',
  requestId: 'savvy-agents',
  props: { title: 'Agents', isFocused: false, bodyColumns: 60, placement: 'dock' } as unknown as RenderPropsOf['Pane'],
} as const

const SURFACES = ['terminal', 'desktop'] as const

const agent = (id: string, status: string, description: string) => ({
  id,
  agentId: id,
  type: 'Explore',
  description,
  model: 'claude-sonnet-5-5',
  status,
  startedAt: 1000,
  endedAt: status === 'running' ? undefined : 5000,
  contextTokens: 20000,
  contextMax: 200000,
  tokens: 12000,
  costUsd: 0.12,
  steps: 1,
  round: 1,
})

describe('agents pane with the file tree', () => {
  test('waits for the file list before drawing a tree', async $ => {
    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ ...PANE, surface })
      expect(await ui.find({ type: 'Text', text: /Reading the file list/ })).toBeDefined()
      await ui.unmount()
    }
  })

  test('with no agents the pane is the file tree alone', async ($, on) => {
    const fixture: Record<string, unknown> = { root: '/repo', files: ['README.md', 'src/a.ts'] }
    on('state.get', async ($, e, next) => {
      const held = await next(e)
      const isFixed = e.plugin === 'savvy-progress' && e.key in fixture
      return isFixed && held.deny === undefined ? { value: { value: fixture[e.key], version: 1 } } : held
    })
    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ ...PANE, surface })
      expect(await ui.find({ type: 'Text', text: /All Files repo/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /CLAUDE TOUCHED/ })).toBeDefined()
      expect(await ui.find({ key: 'refresh' })).toBeDefined()
      expect(await ui.find({ text: /No subagents yet/ })).toBeUndefined()
      expect(await ui.find({ key: 'compact' })).toBeUndefined()
      await ui.unmount()
    }
  })

  test('draws the tree with marks for read, edited and committed files', async ($, on) => {
    const fixture: Record<string, unknown> = {
      root: '/repo',
      files: ['README.md', 'src/a.ts', 'src/b.ts', 'src/c.ts'],
      touched: {
        'src/a.ts': { kind: 'read', at: 1 },
        'src/b.ts': { kind: 'edit', at: 2 },
        'src/c.ts': { kind: 'edit', at: 3 },
      },
      committed: ['src/c.ts'],
    }
    on('state.get', async ($, e, next) => {
      const held = await next(e)
      const isFixed = e.plugin === 'savvy-progress' && e.key in fixture
      return isFixed && held.deny === undefined ? { value: { value: fixture[e.key], version: 1 } } : held
    })
    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ ...PANE, surface })
      expect(await ui.find({ type: 'Text', text: /CLAUDE TOUCHED/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /3 FILES/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /All Files repo/ })).toBeDefined()
      expect(await ui.find({ key: 'collapse', text: /Collapse all/ })).toBeDefined()
      expect(await ui.find({ key: 't:src/a.ts', text: /Opened/ })).toBeDefined()
      expect(await ui.find({ key: 't:src/b.ts', text: /Edited/ })).toBeDefined()
      expect(await ui.find({ key: 't:src/c.ts', text: /Committed/ })).toBeDefined()
      expect(await ui.find({ key: 'f:src/a.ts' })).toBeDefined()
      await ui.press({ key: 'b:src' })
      expect(await ui.find({ key: 'f:src/a.ts' })).toBeUndefined()
      await ui.press({ key: 'b:src' })
      expect(await ui.find({ key: 'f:src/a.ts' })).toBeDefined()
      // A click on a card row opens its folder in the tree.
      await ui.press({ key: 'b:src' })
      expect(await ui.find({ key: 'f:src/a.ts' })).toBeUndefined()
      await ui.press({ key: 'go:src/a.ts' })
      expect(await ui.find({ key: 'f:src/a.ts' })).toBeDefined()
      // Collapse all drops the person's choices; src stays open as the folder
      // of the last touched file.
      await ui.press({ key: 'collapse' })
      expect(await ui.find({ key: 'f:src/a.ts' })).toBeDefined()
      await ui.unmount()
    }
  })

  test('running agents sit above the tree; finished ones fold, and fold again at each new finish', async ($, on) => {
    const fixture: Record<string, unknown> = { root: '/repo', files: ['README.md'], now: 9000 }
    on('state.get', async ($, e, next) => {
      const held = await next(e)
      const isFixed = e.plugin === 'savvy-progress' && e.key in fixture
      return isFixed && held.deny === undefined ? { value: { value: fixture[e.key], version: 1 } } : held
    })
    for (const surface of SURFACES) {
      fixture.agents = [agent('a1', 'done', 'Old search'), agent('a2', 'running', 'Find the parser')]
      const ui = await $.ui.mount({ ...PANE, surface })

      // The running agent is drawn before the All Files header.
      const all = await ui.findAll({})
      const runAt = all.findIndex(el => el.key === 'a:a2')
      const filesAt = all.findIndex(el => el.type === 'Text' && /All Files repo/.test(el.text))
      expect(runAt).toBeGreaterThanOrEqual(0)
      expect(filesAt).toBeGreaterThan(runAt)

      // Finished: folded by default, opened by a press.
      expect(await ui.find({ key: 'agents-done', text: /▸ Finished · 1/ })).toBeDefined()
      expect(await ui.find({ key: 'a:a1' })).toBeUndefined()
      await ui.press({ key: 'agents-done' })
      expect(await ui.find({ key: 'agents-done', text: /▾ Finished · 1/ })).toBeDefined()
      expect(await ui.find({ key: 'a:a1' })).toBeDefined()

      // Another agent finishes: the fold closes by itself.
      fixture.agents = [agent('a1', 'done', 'Old search'), agent('a2', 'done', 'Find the parser')]
      await ui.redraw()
      expect(await ui.find({ key: 'agents-done', text: /▸ Finished · 2/ })).toBeDefined()
      expect(await ui.find({ key: 'a:a1' })).toBeUndefined()
      expect(await ui.find({ key: 'a:a2' })).toBeUndefined()

      // It still opens and closes by hand.
      await ui.press({ key: 'agents-done' })
      expect(await ui.find({ key: 'a:a2' })).toBeDefined()
      await ui.press({ key: 'agents-done' })
      expect(await ui.find({ key: 'a:a2' })).toBeUndefined()
      await ui.unmount()
    }
  })

  test('compact mode keeps the file tree below the strip', async ($, on) => {
    const fixture: Record<string, unknown> = {
      root: '/repo',
      files: ['README.md'],
      now: 9000,
      agents: [agent('a2', 'running', 'Find the parser')],
    }
    on('state.get', async ($, e, next) => {
      const held = await next(e)
      const isFixed = e.plugin === 'savvy-progress' && e.key in fixture
      return isFixed && held.deny === undefined ? { value: { value: fixture[e.key], version: 1 } } : held
    })
    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ ...PANE, surface })
      await ui.press({ key: 'compact' })
      expect(await ui.find({ key: 'a:a2' })).toBeUndefined()
      expect(await ui.find({ type: 'Text', text: /All Files repo/ })).toBeDefined()
      await ui.press({ key: 'compact' })
      expect(await ui.find({ key: 'a:a2' })).toBeDefined()
      await ui.unmount()
    }
  })
})

// A running agent with reported steps; `now` 60 s after its start.
const stepped = (id: string, status: string, description: string, stepDone?: number, stepTotal?: number) => ({
  ...agent(id, status, description),
  startedAt: 1000,
  ...(stepTotal === undefined ? {} : { stepDone, stepTotal }),
})

const ETA = /~\d+[smh]( \d+m)? left|estimating…|finishing…/

describe('time left from reported steps', () => {
  // `doneOpenAt` at the finished count keeps the finished agents unfolded.
  const stub = (on: On, agents: unknown[], doneOpenAt = -1) => {
    const fixture: Record<string, unknown> = { root: '/repo', files: ['README.md'], now: 61000, agents, doneOpenAt }
    on('state.get', async ($, e, next) => {
      const held = await next(e)
      const isFixed = e.plugin === 'savvy-progress' && e.key in fixture
      return isFixed && held.deny === undefined ? { value: { value: fixture[e.key], version: 1 } } : held
    })
  }

  // Desktop draws each card as one Svg: its source and alt carry the text.
  const cardText = async (ui: { findAll: (q: { type?: string }) => Promise<{ props: Record<string, unknown>; text: string }[]> }, surface: string) =>
    surface === 'desktop'
      ? (await ui.findAll({ type: 'Svg' })).map(el => `${String(el.props.source)} ${String(el.props.alt)}`).join('\n')
      : (await ui.findAll({ type: 'Text' })).map(el => el.text).join('\n')

  test('2 of 8 steps after 60 s reads ~3m left, with the 2/8 count', async ($, on) => {
    stub(on, [stepped('a2', 'running', 'Find the parser', 2, 8)])
    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ ...PANE, surface })
      const text = await cardText(ui, surface)
      expect(text).toContain('~3m left')
      expect(text).toContain('2/8')
      await ui.unmount()
    }
  })

  test('0 steps done reads estimating…', async ($, on) => {
    stub(on, [stepped('a2', 'running', 'Find the parser', 0, 5)])
    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ ...PANE, surface })
      const text = await cardText(ui, surface)
      expect(text).toContain('estimating…')
      expect(text).toContain('0/5')
      await ui.unmount()
    }
  })

  test('no time left without steps, nor for finished agents', async ($, on) => {
    stub(on, [
      stepped('a1', 'done', 'Old search', 4, 8),
      stepped('a3', 'failed', 'Broken run', 1, 8),
      stepped('a2', 'running', 'Find the parser'),
    ], 2)
    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ ...PANE, surface })
      expect(await ui.find({ key: 'a:a1' })).toBeDefined()
      expect(await ui.find({ key: 'a:a2' })).toBeDefined()
      expect(await ui.find({ key: 'a:a3' })).toBeDefined()
      expect(await cardText(ui, surface)).not.toMatch(ETA)
      await ui.unmount()
    }
  })
})

describe('every subagent is asked to report steps', () => {
  test('the Agent call gets the step instruction appended once', async ($, on) => {
    const seen: string[] = []
    on('tool.call', { tool: 'Agent' }, async ($, e) => {
      if (e.tool === 'Agent') seen.push(e.prompt)
      return { result: {} as never }
    })
    await $.tool.call({ tool: 'Agent', description: 'Look around', prompt: 'Map the repo.', subagent_type: 'Explore' })
    await $.tool.call({ tool: 'Agent', description: 'Careful work', prompt: 'Fix it.', subagent_type: 'savvy-careful' })
    expect(seen.length).toBe(2)
    expect(seen[0]?.startsWith('Map the repo.\n\nProgress reporting: if the tool mcp__savvy-progress__step is available')).toBe(true)
    expect(seen[0]).toContain('done: 0 and total')
    expect(seen[1]).toContain('Progress reporting:')

    // A prompt that already carries it is passed on unchanged.
    const already = seen[0] ?? ''
    await $.tool.call({ tool: 'Agent', description: 'Again', prompt: already, subagent_type: 'Explore' })
    expect(seen[2]).toBe(already)
    expect((seen[2] ?? '').split('Progress reporting:').length).toBe(2)
    expect(seen[0]).toContain('Report style: caveman')
    expect((seen[2] ?? '').split('Report style: caveman').length).toBe(2)
  })
})
