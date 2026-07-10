// Thin, resilient WebSocket wrapper over a game's event stream
// (GET /games/:code/events). Used online only — in offline mode the app polls
// api.getRound instead, since the mock backend has no socket.
//
// Server -> client events are JSON objects: { type, ... }:
//   round_started { round, prompt }
//   submission    { round, count, total }
//   game_ended    {}
//
// Battery posture: this page lives on a phone for a whole game night, so the
// wrapper must never keep the radio busy for nothing. While the page is hidden
// (screen off / app backgrounded) the socket is closed and no reconnect timers
// run; on return it connects fresh, and the server replays the round lifecycle
// as a snapshot on connect so nothing is permanently missed. After a few
// consecutive failed connection attempts, `onUnreachable` lets the app check
// over HTTP whether the game still exists — a game that ended while the phone
// was asleep must stop the reconnect loop, not be retried forever.

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081';

// Consecutive failed connection attempts before onUnreachable fires. It fires
// again on each further failure so the app can keep probing during an outage.
const UNREACHABLE_AFTER = 3;

// Derive the ws(s):// events URL from the http(s):// API base.
function eventsUrl(code) {
  const base = API_URL.replace(/^http/i, 'ws');
  return `${base}/games/${code}/events`;
}

// Opens a WebSocket to a game's event stream. `onEvent(evt)` receives each
// parsed event. Reconnects with capped exponential backoff until close() is
// called by the caller, pausing entirely while the page is hidden. Returns a
// handle: { close() }.
export function createGameSocket(code, onEvent, { onUnreachable } = {}) {
  let ws = null;
  let closed = false;
  let failures = 0; // consecutive connection attempts that never opened
  let reconnectTimer = null;

  function connect() {
    reconnectTimer = null;
    if (closed || document.hidden) return; // visibilitychange resumes us
    let opened = false;
    try {
      ws = new WebSocket(eventsUrl(code));
    } catch {
      attemptFailed();
      return;
    }

    ws.onopen = () => {
      opened = true;
      failures = 0;
    };
    ws.onmessage = (e) => {
      try {
        onEvent(JSON.parse(e.data));
      } catch {
        // Ignore malformed frames.
      }
    };
    ws.onerror = () => {
      // onclose will follow and handle the reconnect.
      try {
        ws.close();
      } catch {
        // no-op
      }
    };
    ws.onclose = () => {
      ws = null;
      if (closed) return;
      if (document.hidden) return; // suspended; resumed on visibilitychange
      if (opened) {
        // An established connection dropped: retry promptly (failures was
        // reset on open, so the backoff starts small again).
        scheduleReconnect();
      } else {
        attemptFailed();
      }
    };
  }

  // A connection attempt never reached open: back off, and once the streak is
  // long enough let the app probe whether the game is even still there.
  function attemptFailed() {
    scheduleReconnect();
    failures += 1;
    if (failures >= UNREACHABLE_AFTER && onUnreachable) onUnreachable();
  }

  function scheduleReconnect() {
    // 0.5s, 1s, 2s, ... capped at 30s.
    const delay = Math.min(30000, 500 * 2 ** failures);
    reconnectTimer = setTimeout(connect, delay);
  }

  // Hold no connection (and fire no retries) while nobody can see the page;
  // reconnect fresh when it becomes visible again.
  function onVisibilityChange() {
    if (closed) return;
    if (document.hidden) {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (ws) {
        try {
          ws.close(); // its onclose sees the hidden page and stays quiet
        } catch {
          // no-op
        }
      }
    } else if (!ws && !reconnectTimer) {
      failures = 0;
      connect();
    }
  }
  document.addEventListener('visibilitychange', onVisibilityChange);

  connect();

  return {
    close() {
      closed = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) {
        try {
          ws.close();
        } catch {
          // no-op
        }
      }
    },
  };
}
