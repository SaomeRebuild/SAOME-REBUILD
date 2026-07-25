import { describe, it, expect } from 'vitest';

describe('vitest setup smoke test', () => {
  it('runs basic assertion', () => {
    expect(1 + 1).toBe(2);
  });

  it('handles string equality', () => {
    expect('saome').toBe('saome');
  });
});
