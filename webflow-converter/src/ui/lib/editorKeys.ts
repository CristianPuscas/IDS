/** Text and selection of a textarea. */
export interface EditorState {
  value: string;
  start: number;
  end: number;
}

/** Minimal keyboard event shape, so the logic is testable without a DOM. */
export interface EditorKey {
  key: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}

export const INDENT = '  ';

const lineStartAt = (value: string, pos: number): number => value.lastIndexOf('\n', pos - 1) + 1;

/** Selected line block `[blockStart, blockEnd)`. A selection ending right after a newline excludes the next line. */
function lineBlock({ value, start, end }: EditorState): [number, number] {
  const blockStart = lineStartAt(value, start);
  const blockEnd = end > start && value[end - 1] === '\n' ? end - 1 : end;
  const nl = value.indexOf('\n', blockEnd);
  return [blockStart, nl === -1 ? value.length : nl];
}

/**
 * Tab: inserts two spaces at the caret (replacing a single-line selection),
 * or indents every line of a multi-line selection.
 */
export function indent(state: EditorState): EditorState {
  const { value, start, end } = state;
  if (!value.slice(start, end).includes('\n')) {
    const caret = start + INDENT.length;
    return { value: value.slice(0, start) + INDENT + value.slice(end), start: caret, end: caret };
  }
  const [bs, be] = lineBlock(state);
  const lines = value.slice(bs, be).split('\n');
  const next = lines.map((l) => INDENT + l).join('\n');
  return {
    value: value.slice(0, bs) + next + value.slice(be),
    start: start + INDENT.length,
    end: end + INDENT.length * lines.length,
  };
}

/** Shift+Tab: removes up to two leading spaces (or one tab) from every touched line. */
export function outdent(state: EditorState): EditorState {
  const { value, start, end } = state;
  const [bs, be] = lineBlock(state);
  const lines = value.slice(bs, be).split('\n');
  let removedFirst = 0;
  let removedTotal = 0;
  const next = lines.map((line, i) => {
    const n = /^(\t| {1,2})/.exec(line)?.[0].length ?? 0;
    if (i === 0) removedFirst = n;
    removedTotal += n;
    return line.slice(n);
  });
  if (removedTotal === 0) return state;
  const newStart = Math.max(bs, start - removedFirst);
  const newEnd = Math.max(newStart, end - removedTotal);
  return { value: value.slice(0, bs) + next.join('\n') + value.slice(be), start: newStart, end: newEnd };
}

/**
 * Editor key handling. Returns the new state when the key is handled (the caller must call
 * `preventDefault`), or `null` to let the browser handle it. Modified Tab (Ctrl/Cmd/Alt) is left alone.
 */
export function handleEditorKey(key: EditorKey, state: EditorState): EditorState | null {
  if (key.key !== 'Tab' || key.ctrlKey || key.metaKey || key.altKey) return null;
  return key.shiftKey ? outdent(state) : indent(state);
}

/** Number of lines (an empty string counts as one line). */
export function countLines(value: string): number {
  let n = 1;
  for (let i = 0; i < value.length; i++) if (value.charCodeAt(i) === 10) n++;
  return n;
}
