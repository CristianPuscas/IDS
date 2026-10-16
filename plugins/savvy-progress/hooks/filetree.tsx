import type { ElementTable, RenderChildren } from 'claude-code'

import type { Touch } from '../types'

// The project file tree, drawn in the agents pane below the agents (merged
// from the filetree-desktop mod): its look and its pure helpers. Everything
// that reaches `$` (reading git, tracking tools, the timer) lives in
// register.tsx, since `$` is never handed across an import. Files Claude is
// reading or editing right now shimmer, files it read or edited this session
// keep a mark, and an edited file that leaves `git status` (committed) turns
// green. Reads only the file list, never file contents. No network.

export const MAX_WALK = 5000
export const MAX_FOLDERS = 600
const CARD_LIMIT = 12
// A read or edit takes a fraction of a second: keep its row lit this long
// after it ends, so the eye can follow where Claude goes.
export const LINGER_MS = 2500

type StatusKey = 'opened' | 'edited' | 'committed' | 'reading' | 'editing'
type Look = { fg: string; bg: string }

const STATUS_LOOK: Record<StatusKey, Look & { label: string }> = {
  opened: { label: 'Opened', fg: '#c4a1ff', bg: '#35294d' },
  edited: { label: 'Edited', fg: '#ffa45c', bg: '#43301f' },
  committed: { label: 'Committed', fg: '#6fdc8c', bg: '#1f3a2a' },
  reading: { label: 'reading', fg: '#c4a1ff', bg: '#3d2f58' },
  editing: { label: 'editing', fg: '#ffa45c', bg: '#4d3522' },
}

// Two tints per live state: the row's background alternates between them.
const ROW_TINT: Record<'reading' | 'editing', [string, string]> = {
  reading: ['#2a2238', '#352a48'],
  editing: ['#33261a', '#402f20'],
}

const RED: Look = { fg: '#ff6b7a', bg: '#45202a' }
const GREEN: Look = { fg: '#7bd88f', bg: '#1f3a26' }
const BLUE: Look = { fg: '#7cb7ff', bg: '#1d2e45' }
const YELLOW: Look = { fg: '#f4d35e', bg: '#3d3518' }
const ORANGE: Look = { fg: '#ff9f5a', bg: '#43301f' }
const PURPLE: Look = { fg: '#c4a1ff', bg: '#35294d' }
const GREY: Look = { fg: '#a0a0a0', bg: '#2c2c2c' }

const TYPE_LOOK: Record<string, Look> = {
  pdf: RED,
  csv: GREEN, xlsx: GREEN, xls: GREEN, tsv: GREEN,
  md: BLUE, txt: GREY, css: BLUE, scss: BLUE, py: BLUE,
  ts: YELLOW, tsx: YELLOW, js: YELLOW, jsx: YELLOW, mjs: YELLOW,
  json: ORANGE, html: ORANGE, htm: ORANGE, yml: ORANGE, yaml: ORANGE,
  png: PURPLE, jpg: PURPLE, jpeg: PURPLE, webp: PURPLE, svg: PURPLE, gif: PURPLE, mp4: PURPLE,
  sh: GREEN,
  '': GREY,
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const extOf = (path: string) => {
  const name = path.slice(path.lastIndexOf('/') + 1)
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
}

const shortDate = (ms: number) => {
  const d = new Date(ms)
  const isThisYear = d.getFullYear() === new Date().getFullYear()
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${isThisYear ? '' : ` ${String(d.getFullYear()).slice(2)}`}`
}

const folderSvg = (stroke: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="${stroke}" stroke-width="2" stroke-linejoin="round"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.2l2 2.2h8.8A1.5 1.5 0 0 1 21 8.7v9.8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/></svg>`
const FOLDER = folderSvg('#6ea8fe')
const FOLDER_HOT = folderSvg('#b48cff')
export const SKIP_DIRS = new Set(['.git', 'node_modules', '.next', 'dist', 'build', '.cache'])

// The tree row a click in the card picked out.
const FOCUS_BG = '#22314d'
const FOCUS_FG = '#8cc4ff'

export const relative = (base: string, path: string): string | undefined => {
  if (!base) return undefined
  if (path.startsWith(base + '/')) return path.slice(base.length + 1)
  return path.startsWith('/') ? undefined : path.replace(/^\.\//, '')
}

export const ancestors = (path: string): string[] => {
  const parts = path.split('/')
  return parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join('/'))
}

export const parsePorcelain = (out: string): string[] => {
  const paths: string[] = []
  const parts = out.split('\0')
  for (let i = 0; i < parts.length; i++) {
    const entry = parts[i] ?? ''
    if (entry.length < 4) continue
    const status = entry.slice(0, 2)
    paths.push(entry.slice(3))
    if (status.includes('R') || status.includes('C')) i++
  }
  return paths
}

type Dir = { name: string; path: string; dirs: Map<string, Dir>; files: string[] }

export const buildTree = (list: readonly string[]): Dir => {
  const top: Dir = { name: '', path: '', dirs: new Map(), files: [] }
  for (const path of list) {
    const parts = path.split('/')
    let at = top
    for (let i = 0; i < parts.length - 1; i++) {
      const name = parts[i] ?? ''
      let next = at.dirs.get(name)
      if (!next) {
        next = { name, path: parts.slice(0, i + 1).join('/'), dirs: new Map(), files: [] }
        at.dirs.set(name, next)
      }
      at = next
    }
    at.files.push(path)
  }
  return top
}


/** What the tree draws from, read by register.tsx from the plugin's state. */
export type FileTreeData = {
  base: string
  list: string[]
  times: Record<string, number>
  marks: Record<string, Touch>
  live: string[]
  tick: number
  changed: string[]
  done: string[]
  opened: Record<string, boolean>
  picked: string
}

/** What the tree's buttons do; each returns the write's promise. */
export type FileTreeActions = {
  /** Opens or closes a folder; `isLive` says it is open by itself now. */
  toggle: (dir: string, isLive: boolean) => Promise<unknown>
  /** Opens a card file's folders, marks its row and scrolls to it. */
  reveal: (path: string) => Promise<unknown>
  collapseAll: () => Promise<unknown>
  refresh: () => Promise<unknown>
}

/**
 * The file tree part of the pane: the CLAUDE TOUCHED card, the All Files
 * header with Collapse all, the tree and refresh. `reserved` is how many
 * terminal rows the agents above it already take.
 */
export const drawFileTree = (
  elements: ElementTable,
  view: { surface: string; rows?: number; reserved: number },
  data: FileTreeData,
  actions: FileTreeActions,
): RenderChildren => {
  const { Box, Text, Button } = elements
  const Svg = 'Svg' in elements ? elements.Svg : undefined
  const isDesktop = view.surface !== 'terminal'
  const { base, list, times, marks, live, opened, picked } = data
  const at = Date.now()
  // Live: being read or edited now, or finished within the linger.
  const working = new Set(live.map(entry => entry.slice(entry.indexOf(':') + 1)))
  const editingNow = new Set(live.filter(entry => entry.startsWith('edit:')).map(entry => entry.slice(5)))
  for (const [path, mark] of Object.entries(marks)) {
    if (working.has(path) || at - mark.at > LINGER_MS) continue
    working.add(path)
    if (mark.kind === 'edit') editingNow.add(path)
  }
  // The folder Claude was in last stays open until it moves elsewhere.
  const latest = Object.entries(marks).reduce<[string, number]>(
    (best, [path, mark]) => (mark.at > best[1] ? [path, mark.at] : best),
    ['', 0],
  )[0]
  const changed = new Set(data.changed)
  const done = new Set(data.done)

  if (list.length === 0) {
    return (
      <Box key="files" flexDirection="column" width="100%">
        <Text dimColor>Reading the file list…</Text>
      </Box>
    )
  }

  // Folders open by themselves only while Claude works inside them; the rest
  // stay collapsed unless the person opened them.
  const liveDirs = new Set<string>()
  for (const path of [...working, latest]) for (const dir of ancestors(path)) liveDirs.add(dir)
  const hot = new Set<string>(liveDirs)
  for (const path of [...Object.keys(marks), ...changed]) for (const dir of ancestors(path)) hot.add(dir)

  const isOpen = (dir: string) => opened[dir] ?? liveDirs.has(dir)
  const toggle = (dir: string) => () => actions.toggle(dir, liveDirs.has(dir))

  const statusOf = (path: string): StatusKey | undefined => {
    if (working.has(path)) return editingNow.has(path) ? 'editing' : 'reading'
    if (done.has(path)) return 'committed'
    if (marks[path]?.kind === 'edit') return 'edited'
    if (marks[path]?.kind === 'read') return 'opened'
    return undefined
  }

  const typeBadge = (path: string, faded = false) => {
    const ext = extOf(path)
    const look = TYPE_LOOK[ext] ?? GREY
    const label = (ext || '·').toUpperCase().slice(0, 4).padEnd(4, ' ')
    return (
      <Text color={look.fg} backgroundColor={look.bg} bold dimColor={faded}>
        {` ${label}`}
      </Text>
    )
  }

  const pill = (status: StatusKey, faded = false) => {
    const look = STATUS_LOOK[status]
    return (
      <Text color={look.fg} backgroundColor={look.bg} bold dimColor={faded}>
        {` ${look.label} `}
      </Text>
    )
  }

  const folderIcon = (isHot: boolean) =>
    Svg ? (
      <Svg source={isHot ? FOLDER_HOT : FOLDER} alt="folder" width={16} height={16} />
    ) : (
      <Text color={isHot ? '#b48cff' : '#6ea8fe'}>▪</Text>
    )

  // Claude touched: newest first.
  const touchedPaths = [...new Set([...working, ...Object.keys(marks)])].sort(
    (a, b) => (working.has(b) ? Infinity : (marks[b]?.at ?? 0)) - (working.has(a) ? Infinity : (marks[a]?.at ?? 0)),
  )
  const cardRows = touchedPaths.slice(0, CARD_LIMIT).map(path => {
    const slash = path.lastIndexOf('/')
    const name = path.slice(slash + 1)
    const dir = slash < 0 ? '' : path.slice(path.lastIndexOf('/', slash - 1) + 1, slash)
    const status = statusOf(path) ?? 'opened'
    // Live work at full strength, history faded.
    const faded = !working.has(path)
    return (
      <Box key={`t:${path}`} width="100%" justifyContent="space-between">
        <Box gap={1} flexShrink={1}>
          {typeBadge(path, faded)}
          <Button key={`go:${path}`} plain dimColor={faded} onPress={() => actions.reveal(path)}>
            {name}
          </Button>
          {dir && (
            <Text dimColor wrap="truncate-end">
              {dir}
            </Text>
          )}
        </Box>
        {pill(status, faded)}
      </Box>
    )
  })

  const limit = isDesktop ? 600 : Math.max(5, (view.rows ?? 30) - 8 - cardRows.length - view.reserved)
  const rows: RenderChildren[] = []
  let hidden = 0
  const push = (row: RenderChildren) => (rows.length < limit ? rows.push(row) : hidden++)

  const fileRow = (path: string, depth: number) => {
    const name = path.slice(path.lastIndexOf('/') + 1)
    const status = statusOf(path)
    const isLive = status === 'reading' || status === 'editing'
    const isPicked = picked === path
    const tint = isLive ? ROW_TINT[status][1] : isPicked ? FOCUS_BG : undefined
    const nameColor = isPicked && !isLive ? FOCUS_FG : status ? STATUS_LOOK[status].fg : undefined
    const when = times[path]
    push(
      <Box
        key={`f:${path}`}
        width="100%"
        justifyContent="space-between"
        paddingLeft={depth * 2 + 2}
        paddingRight={1}
        backgroundColor={tint}
      >
        <Box gap={1} flexShrink={1}>
          {typeBadge(path)}
          <Text
            color={nameColor}
            bold={isLive || isPicked}
            dimColor={!status && !changed.has(path) && !isPicked}
            wrap="truncate-end"
          >
            {name}
          </Text>
        </Box>
        {status && status !== 'opened' ? (
          pill(status)
        ) : (
          <Box gap={1}>
            {changed.has(path) && <Text color="warning">M</Text>}
            <Text dimColor>{when ? shortDate(when) : ''}</Text>
          </Box>
        )}
      </Box>,
    )
  }

  const dirRows = (dir: Dir, depth: number) => {
    const subdirs = [...dir.dirs.values()].sort((a, b) => a.name.localeCompare(b.name))
    for (const sub of subdirs) {
      const open = isOpen(sub.path)
      const isHot = hot.has(sub.path)
      push(
        <Box key={`d:${sub.path}`} paddingLeft={depth * 2} gap={1} alignItems="center">
          <Button key={`b:${sub.path}`} plain dimColor onPress={toggle(sub.path)}>
            {open ? '▾' : '▸'}
          </Button>
          {folderIcon(isHot)}
          <Text color={isHot ? '#b48cff' : undefined}>{sub.name}</Text>
        </Box>,
      )
      if (open) dirRows(sub, depth + 1)
    }
    for (const path of [...dir.files].sort((a, b) => a.localeCompare(b))) fileRow(path, depth)
  }

  dirRows(buildTree(list), 0)
  const rootName = base.slice(base.lastIndexOf('/') + 1) || base

  return (
    <Box key="files" flexDirection="column" width="100%">
      <Box borderStyle="round" borderColor="#3a3a3a" flexDirection="column" paddingX={1} marginBottom={1}>
        <Box width="100%" justifyContent="space-between">
          <Text bold dimColor>
            CLAUDE TOUCHED
          </Text>
          <Text bold dimColor>
            {`${touchedPaths.length} ${touchedPaths.length === 1 ? 'FILE' : 'FILES'}`}
          </Text>
        </Box>
        {cardRows.length === 0 && <Text dimColor>Nothing yet. Files Claude opens or edits show up here.</Text>}
        {cardRows}
        {touchedPaths.length > CARD_LIMIT && <Text dimColor>{`+ ${touchedPaths.length - CARD_LIMIT} more`}</Text>}
      </Box>
      <Box width="100%" justifyContent="space-between">
        <Text bold dimColor wrap="truncate-end">
          {`All Files ${rootName}`}
        </Text>
        <Button
          key="collapse"
          plain
          dimColor
          onPress={() => actions.collapseAll()}
        >
          Collapse all
        </Button>
      </Box>
      {rows}
      {hidden > 0 && <Text dimColor>{`… ${hidden} more`}</Text>}
      <Box marginTop={1}>
        <Button key="refresh" plain dimColor onPress={() => actions.refresh()}>
          refresh
        </Button>
      </Box>
    </Box>
  )
}
