// When useDebouncedSaver sends saves, and in what order.
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useDebouncedSaver } from './useDebouncedSaver.js';

// A `send` whose saves finish only when the test says so, recording each.
function controlledSend() {
  const calls = [];
  const send = vi.fn((id, value, options) => new Promise((resolve) => calls.push({ id, value, options, finish: resolve })));
  return { send, calls };
}

// Lets promise callbacks queued so far run.
const settle = () => act(() => Promise.resolve());

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useDebouncedSaver', () => {
  test('a run of changes is one save, of the last value, after the delay', async () => {
    const { send, calls } = controlledSend();
    const { result } = renderHook(() => useDebouncedSaver(send));
    act(() => {
      result.current.save(1, 'a');
      result.current.save(1, 'b');
    });
    expect(send).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(calls.map((c) => c.value)).toEqual(['b']);
  });

  test('a save is pending from when it is queued until it has finished', async () => {
    const { send, calls } = controlledSend();
    const { result } = renderHook(() => useDebouncedSaver(send));
    act(() => result.current.save(1, 'a'));
    expect([result.current.pending(1), result.current.pending(2)]).toEqual([true, false]);
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(result.current.pending(1)).toBe(true);
    calls[0].finish();
    await settle();
    await settle();
    expect(result.current.pending(1)).toBe(false);
  });

  test("a layer's next save waits until the one before has finished", async () => {
    const { send, calls } = controlledSend();
    const { result } = renderHook(() => useDebouncedSaver(send));

    act(() => result.current.save(1, 'first'));
    await act(() => vi.advanceTimersByTimeAsync(300));
    act(() => result.current.save(1, 'second'));
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(calls.map((c) => c.value)).toEqual(['first']);

    calls[0].finish();
    await settle();
    expect(calls.map((c) => c.value)).toEqual(['first', 'second']);
  });

  test("different layers' saves don't wait for each other", async () => {
    const { send, calls } = controlledSend();
    const { result } = renderHook(() => useDebouncedSaver(send));
    act(() => {
      result.current.save(1, 'one');
      result.current.save(2, 'two');
    });
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(calls.map((c) => c.id).sort()).toEqual([1, 2]);
  });

  test('a cancelled save is never sent', async () => {
    const { send } = controlledSend();
    const { result } = renderHook(() => useDebouncedSaver(send));
    act(() => {
      result.current.save(1, 'gone');
      result.current.cancel(1);
    });
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(send).not.toHaveBeenCalled();
  });

  test('closing sends waiting saves at once, with keepalive, without waiting for earlier ones', async () => {
    const { send, calls } = controlledSend();
    const { result, unmount } = renderHook(() => useDebouncedSaver(send));
    act(() => result.current.save(1, 'first'));
    await act(() => vi.advanceTimersByTimeAsync(300));
    act(() => result.current.save(1, 'last'));

    unmount();
    expect(calls.map((c) => [c.value, c.options.keepalive])).toEqual([['first', false], ['last', true]]);
  });
});
