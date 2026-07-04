// Deep-link support: a host's QR code encodes a URL like
// `https://play.rotcev.com/?code=1234`, so a player who scans it lands on the
// join screen with the code already filled in. This only ever *prefills* the
// onboarding form — the player still enters a name and taps Join — so a scan
// can never hijack an active session or auto-join with stale state.

// A valid game code is exactly four digits (matches useGame's CODE_RE).
const CODE_RE = /^\d{4}$/;

// codeFromUrl reads the `code` query param and returns it only when it's a
// well-formed 4-digit code; otherwise ''. Guarded so a malformed query string
// can't throw during startup.
export function codeFromUrl(search) {
  try {
    const query = search ?? window.location.search;
    const code = new URLSearchParams(query).get('code') || '';
    return CODE_RE.test(code) ? code : '';
  } catch {
    return '';
  }
}
