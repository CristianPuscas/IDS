/** True on macOS / iOS, where the shortcut modifier is Cmd. */
export function isMacPlatform(
  platform: string = typeof navigator !== 'undefined' ? (navigator.platform ?? '') + ' ' + navigator.userAgent : '',
): boolean {
  return /mac|iphone|ipad|ipod/i.test(platform);
}

/** Ctrl+Enter or Cmd+Enter (without Alt/Shift). */
export function isConvertShortcut(e: { key: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; shiftKey?: boolean }): boolean {
  return e.key === 'Enter' && (!!e.ctrlKey || !!e.metaKey) && !e.altKey && !e.shiftKey;
}
