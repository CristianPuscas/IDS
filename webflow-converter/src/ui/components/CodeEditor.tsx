/** Language of a {@link CodeEditor}, used for labelling and (later) syntax highlighting. */
export type CodeLanguage = 'html' | 'css' | 'js';

/** Props for {@link CodeEditor}. */
export interface CodeEditorProps {
  /** Visible label above the editor, e.g. "HTML". */
  label: string;
  language: CodeLanguage;
  value: string;
  /** Called with the full new text on every edit. */
  onChange: (value: string) => void;
  placeholder?: string;
  /** Optional DOM id for the textarea (label association). Defaults to `editor-<language>`. */
  id?: string;
}

/**
 * Monospace code input. Placeholder implementation is a plain textarea; the UI agent may
 * upgrade it (line numbers, highlighting) without changing the props.
 * Ownership: ui.
 */
export function CodeEditor({ label, language, value, onChange, placeholder, id }: CodeEditorProps) {
  const editorId = id ?? `editor-${language}`;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5">
      <label htmlFor={editorId} className="font-mono text-xs uppercase tracking-wider text-muted">
        {label}
      </label>
      <textarea
        id={editorId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        className="min-h-48 flex-1 resize-y rounded-md border border-line bg-surface p-3 font-mono text-[13px] leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus:border-accent focus:outline-none"
      />
    </div>
  );
}
