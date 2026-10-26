/** Things {@link copyText} needs, injectable for tests. */
export interface CopyTextEnv {
  clipboard?: Pick<Clipboard, 'writeText'> | undefined;
  /** Synchronous fallback (hidden textarea + execCommand). */
  fallback?: (text: string) => boolean;
}

/** Hidden-textarea + `execCommand('copy')` fallback for browsers without the async Clipboard API. */
export function execCommandCopy(text: string): boolean {
  if (typeof document === 'undefined') return false;
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  ta.style.pointerEvents = 'none';
  document.body.appendChild(ta);
  const active = document.activeElement as HTMLElement | null;
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  } finally {
    ta.remove();
    active?.focus?.();
  }
  return ok;
}

function defaultEnv(): CopyTextEnv {
  return {
    clipboard: typeof navigator !== 'undefined' ? navigator.clipboard : undefined,
    fallback: execCommandCopy,
  };
}

/**
 * Copies plain text (the AI prompt, raw JSON). Uses `navigator.clipboard.writeText` and falls back
 * to `execCommand`. Never throws. Note: plain text is NOT what Webflow reads on paste; use
 * `copyToWebflow()` for that.
 */
export async function copyText(text: string, env: CopyTextEnv = defaultEnv()): Promise<boolean> {
  try {
    if (env.clipboard?.writeText) {
      await env.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the fallback
  }
  try {
    return env.fallback?.(text) ?? false;
  } catch {
    return false;
  }
}
