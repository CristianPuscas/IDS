/**
 * Clipboard writer (spec 4). Webflow reads only the `application/json` entry of the paste event.
 * The async Clipboard API cannot write `application/json`, so we hook a one-shot `copy` event and
 * trigger it with `document.execCommand('copy')`.
 *
 * Ownership: engine (implemented; the UI calls it).
 */

/**
 * Puts `json` on the clipboard as `application/json` (what Webflow reads) and `text/plain`
 * (debug fallback).
 *
 * IMPORTANT: call it directly inside a user-gesture handler (e.g. a click). The copy happens
 * synchronously before the returned promise settles, so do not `await` anything before calling it.
 *
 * @param json The serialised XscpData (`ConvertResult.json`). A leading BOM/whitespace is stripped.
 * @returns `true` if the copy event fired and the data was set; `false` otherwise.
 */
export async function copyToWebflow(json: string): Promise<boolean> {
  if (typeof document === 'undefined') return false;
  const str = json.replace(/^﻿/, '').trimStart();
  let written = false;

  const onCopy = (e: ClipboardEvent): void => {
    if (!e.clipboardData) return;
    e.preventDefault();
    e.clipboardData.setData('application/json', str);
    e.clipboardData.setData('text/plain', str);
    written = true;
  };

  document.addEventListener('copy', onCopy, true);
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  } finally {
    document.removeEventListener('copy', onCopy, true);
  }
  return ok && written;
}

/**
 * Best-effort Safari detection. Safari does not hand custom MIME types to other origins
 * (spec 4), so pasting into webflow.com usually fails there; the UI should warn.
 */
export function isSafari(userAgent: string = typeof navigator !== 'undefined' ? navigator.userAgent : ''): boolean {
  return /safari/i.test(userAgent) && !/chrome|chromium|crios|edg|opr|android/i.test(userAgent);
}
