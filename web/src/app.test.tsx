import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './app';

afterEach(() => vi.useRealTimers());

describe('mission dashboard', () => {
  it('runs the mission and resets the public dashboard state', async () => {
    vi.useFakeTimers();
    render(<App />);

    expect(screen.getAllByText('0%')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Start mission' }));
    for (let step = 0; step < 9; step += 1) {
      await act(async () => vi.advanceTimersByTimeAsync(700));
    }

    expect(screen.getAllByText('67%')).toHaveLength(2);
    expect(screen.getAllByText(/Checkpoint proof verified/i)).toHaveLength(2);
    expect(screen.getByText(/Checkpoint proof rejected/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /reset/i }));
    expect(screen.getAllByText('0%')).toHaveLength(2);
    expect(screen.getByText(/Start the mission to generate/i)).toBeInTheDocument();
  });
});
