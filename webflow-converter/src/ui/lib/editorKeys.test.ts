import { describe, expect, it } from 'vitest';
import { countLines, handleEditorKey, indent, outdent, type EditorState } from './editorKeys';

/** Builds a state from text where `|` marks the caret or `[`/`]` mark a selection. */
function st(marked: string): EditorState {
  if (marked.includes('|')) {
    const i = marked.indexOf('|');
    return { value: marked.replace('|', ''), start: i, end: i };
  }
  const s = marked.indexOf('[');
  const e = marked.indexOf(']') - 1;
  return { value: marked.replace('[', '').replace(']', ''), start: s, end: e };
}

describe('Tab key in the editor', () => {
  it('inserts two spaces at the caret', () => {
    expect(handleEditorKey({ key: 'Tab' }, st('ab|cd'))).toEqual({ value: 'ab  cd', start: 4, end: 4 });
  });

  it('replaces a single-line selection with two spaces', () => {
    expect(indent(st('a[bc]d'))).toEqual({ value: 'a  d', start: 3, end: 3 });
  });

  it('indents every line of a multi-line selection', () => {
    const next = indent(st('x\na[b\nc]d\ny'));
    expect(next.value).toBe('x\n  ab\n  cd\ny');
    expect(next.value.slice(next.start, next.end)).toBe('b\n  c');
  });

  it('does not indent the line after a selection that ends at a line start', () => {
    expect(indent(st('[a\n]b')).value).toBe('  a\nb');
  });

  it('Shift+Tab removes up to two leading spaces on the caret line', () => {
    expect(handleEditorKey({ key: 'Tab', shiftKey: true }, st('    ab|c'))).toEqual({ value: '  abc', start: 4, end: 4 });
    expect(outdent(st(' a|'))).toEqual({ value: 'a', start: 1, end: 1 });
    expect(outdent(st('\ta|'))).toEqual({ value: 'a', start: 1, end: 1 });
  });

  it('Shift+Tab outdents every selected line and keeps the selection', () => {
    const next = outdent(st('  [a\n    b\nc]'));
    expect(next.value).toBe('a\n  b\nc');
    expect(next.value.slice(next.start, next.end)).toBe('a\n  b\nc');
  });

  it('Shift+Tab with nothing to remove is handled but changes nothing', () => {
    const s = st('ab|c');
    expect(handleEditorKey({ key: 'Tab', shiftKey: true }, s)).toEqual(s);
  });

  it('keeps the caret on the line when it sits inside the indentation', () => {
    expect(outdent(st(' |  a'))).toEqual({ value: ' a', start: 0, end: 0 });
  });

  it('ignores other keys and modified Tab', () => {
    expect(handleEditorKey({ key: 'Enter' }, st('a|'))).toBeNull();
    expect(handleEditorKey({ key: 'Tab', ctrlKey: true }, st('a|'))).toBeNull();
    expect(handleEditorKey({ key: 'Tab', metaKey: true }, st('a|'))).toBeNull();
    expect(handleEditorKey({ key: 'Tab', altKey: true }, st('a|'))).toBeNull();
  });
});

describe('countLines', () => {
  it('counts newline-separated lines', () => {
    expect(countLines('')).toBe(1);
    expect(countLines('a')).toBe(1);
    expect(countLines('a\nb\n')).toBe(3);
  });
});
