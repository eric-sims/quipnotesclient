import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createGameSocket } from './socket.js';

// Controllable fake WebSocket: tests drive open/close/message by hand. A real
// socket fires its handlers asynchronously; synchronous is fine for these
// tests because the wrapper never re-enters itself.
class FakeWebSocket {
  static instances = [];

  constructor(url) {
    this.url = url;
    this.readyState = 0;
    FakeWebSocket.instances.push(this);
  }

  close() {
    if (this.onclose) this.onclose();
  }

  // --- test drivers ---
  open() {
    this.readyState = 1;
    if (this.onopen) this.onopen();
  }

  message(data) {
    if (this.onmessage) this.onmessage({ data });
  }

  drop() {
    if (this.onclose) this.onclose();
  }
}

function lastSocket() {
  return FakeWebSocket.instances[FakeWebSocket.instances.length - 1];
}

// jsdom has no real page visibility; override document.hidden and announce the
// change like a browser would.
function setHidden(hidden) {
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    get: () => hidden,
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  vi.useFakeTimers();
  FakeWebSocket.instances = [];
  vi.stubGlobal('WebSocket', FakeWebSocket);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  setHidden(false);
});

describe('createGameSocket', () => {
  it('connects to the game events URL and delivers parsed events', () => {
    const onEvent = vi.fn();
    const handle = createGameSocket('4821', onEvent);

    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(lastSocket().url).toContain('/games/4821/events');

    lastSocket().open();
    lastSocket().message(JSON.stringify({ type: 'round_started', round: 1 }));
    expect(onEvent).toHaveBeenCalledWith({ type: 'round_started', round: 1 });

    // Malformed frames are ignored, not thrown.
    lastSocket().message('not-json');
    expect(onEvent).toHaveBeenCalledTimes(1);

    handle.close();
  });

  it('reconnects promptly after an established connection drops', () => {
    const handle = createGameSocket('4821', vi.fn());
    lastSocket().open();
    lastSocket().drop();

    expect(FakeWebSocket.instances).toHaveLength(1);
    vi.advanceTimersByTime(500);
    expect(FakeWebSocket.instances).toHaveLength(2);

    handle.close();
  });

  it('backs off failed attempts and caps the delay at 30s', () => {
    const handle = createGameSocket('4821', vi.fn());

    // Fail every attempt (close without ever opening) for a while.
    for (let i = 0; i < 10; i++) {
      lastSocket().drop();
      vi.advanceTimersByTime(30000); // the cap: always long enough to retry
    }
    const count = FakeWebSocket.instances.length;

    // At the cap, a retry happens once per 30s — not sooner.
    lastSocket().drop();
    vi.advanceTimersByTime(29999);
    expect(FakeWebSocket.instances).toHaveLength(count);
    vi.advanceTimersByTime(1);
    expect(FakeWebSocket.instances).toHaveLength(count + 1);

    handle.close();
  });

  it('fires onUnreachable after repeated failed attempts, but not for drops after open', () => {
    const onUnreachable = vi.fn();
    const handle = createGameSocket('4821', vi.fn(), { onUnreachable });

    // A working connection that drops is not "unreachable".
    lastSocket().open();
    lastSocket().drop();
    vi.advanceTimersByTime(500);
    expect(onUnreachable).not.toHaveBeenCalled();

    // Three attempts in a row that never open are.
    lastSocket().drop();
    vi.advanceTimersByTime(30000);
    lastSocket().drop();
    vi.advanceTimersByTime(30000);
    expect(onUnreachable).not.toHaveBeenCalled();
    lastSocket().drop();
    expect(onUnreachable).toHaveBeenCalledTimes(1);

    // And it keeps firing while the outage lasts.
    vi.advanceTimersByTime(30000);
    lastSocket().drop();
    expect(onUnreachable).toHaveBeenCalledTimes(2);

    handle.close();
  });

  it('closes the socket while the page is hidden and reconnects on return', () => {
    const handle = createGameSocket('4821', vi.fn());
    lastSocket().open();

    setHidden(true);
    // Hidden: the connection is gone and nothing retries, no matter how long.
    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(FakeWebSocket.instances).toHaveLength(1);

    setHidden(false);
    expect(FakeWebSocket.instances).toHaveLength(2);

    handle.close();
  });

  it('cancels a pending reconnect when the page goes hidden', () => {
    const handle = createGameSocket('4821', vi.fn());
    lastSocket().drop(); // schedules a retry

    setHidden(true);
    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(FakeWebSocket.instances).toHaveLength(1);

    // Back to visible: reconnect with a fresh backoff.
    setHidden(false);
    expect(FakeWebSocket.instances).toHaveLength(2);

    handle.close();
  });

  it('close() stops reconnects and visibility handling for good', () => {
    const handle = createGameSocket('4821', vi.fn());
    lastSocket().open();
    handle.close();

    vi.advanceTimersByTime(10 * 60 * 1000);
    setHidden(true);
    setHidden(false);
    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(FakeWebSocket.instances).toHaveLength(1);
  });
});
