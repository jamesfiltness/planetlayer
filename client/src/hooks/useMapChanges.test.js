// When useMapChanges says a map has changed. jsdom has no EventSource, so a
// fake one stands in, letting each test send events and drop the connection.
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useMapChanges } from './useMapChanges.js';

class FakeEventSource {
  static last;
  constructor(url) {
    this.url = url;
    this.listeners = {};
    this.closed = false;
    FakeEventSource.last = this;
  }
  addEventListener(type, listener) {
    (this.listeners[type] ??= []).push(listener);
  }
  emit(type) {
    for (const listener of this.listeners[type] ?? []) listener();
  }
  close() {
    this.closed = true;
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('EventSource', FakeEventSource);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useMapChanges', () => {
  test("listens to the map's stream, and a burst of changes is one call, once they settle", () => {
    const onChange = vi.fn();
    renderHook(() => useMapChanges(7, onChange));
    const source = FakeEventSource.last;
    expect(source.url).toBe('/api/maps/7/events');

    source.emit('open');
    source.emit('changed');
    vi.advanceTimersByTime(100);
    source.emit('changed');
    vi.advanceTimersByTime(249);
    expect(onChange).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  test('a reconnection counts as a change, since something may have changed meanwhile, but the first connection does not', () => {
    const onChange = vi.fn();
    renderHook(() => useMapChanges(7, onChange));
    FakeEventSource.last.emit('open');
    vi.advanceTimersByTime(1000);
    expect(onChange).not.toHaveBeenCalled();
    FakeEventSource.last.emit('open');
    vi.advanceTimersByTime(250);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  test('the stream is closed when the map closes, and a change waiting then is dropped', () => {
    const onChange = vi.fn();
    const { unmount } = renderHook(() => useMapChanges(7, onChange));
    const source = FakeEventSource.last;
    source.emit('changed');
    unmount();
    vi.advanceTimersByTime(1000);
    expect([source.closed, onChange.mock.calls.length]).toEqual([true, 0]);
  });
});
