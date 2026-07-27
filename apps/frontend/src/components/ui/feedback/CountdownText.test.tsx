import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { CountdownText } from './CountdownText';

describe('CountdownText', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('formats remaining time as mm:ss', () => {
    render(<CountdownText seconds={125} />);
    expect(screen.getByText('02:05')).toBeInTheDocument();
  });

  it('decrements every second', () => {
    render(<CountdownText seconds={3} />);
    expect(screen.getByText('00:03')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText('00:02')).toBeInTheDocument();
  });

  it('calls onComplete when reaching zero', () => {
    const onComplete = vi.fn();
    render(<CountdownText seconds={2} onComplete={onComplete} />);
    act(() => {
      vi.advanceTimersByTime(2100);
    });
    expect(onComplete).toHaveBeenCalled();
  });
});
