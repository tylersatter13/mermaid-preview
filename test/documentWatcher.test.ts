import { describe, it, expect, vi } from 'vitest';
import { debounce } from '../src/documentWatcher';

describe('debounce', () => {
  it('calls the function after the delay', async () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced('hello');
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledWith('hello');
    expect(fn).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it('resets the timer on subsequent calls', async () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced('first');
    vi.advanceTimersByTime(200);
    debounced('second');
    vi.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledWith('second');
    expect(fn).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it('can be disposed to cancel pending calls', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced('hello');
    debounced.dispose();
    vi.advanceTimersByTime(500);
    expect(fn).not.toHaveBeenCalled();

    vi.useRealTimers();
  });
});
