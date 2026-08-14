import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CardBuilderToolbar } from './CardBuilderToolbar';

// Mock: vi.fn(key => key) makes t() return the key as text, matching
// how the existing TenantToolbar tests work.
vi.mock('react-i18next', () => {
  return { useTranslation: vi.fn(() => ({ t: vi.fn((key: string) => key) })) };
});

const mockOnBuildFromScratch = vi.fn();
const mockOnPublicTemplates = vi.fn();

describe('CardBuilderToolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders both toolbar buttons', () => {
    render(
      <CardBuilderToolbar
        onBuildFromScratch={mockOnBuildFromScratch}
        onPublicTemplates={mockOnPublicTemplates}
      />
    );
    expect(screen.getByRole('button', { name: 'toolbar.buildFromScratch' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'toolbar.publicTemplates' })).toBeInTheDocument();
  });

  it('calls onBuildFromScratch when Build from Scratch button is clicked', async () => {
    render(
      <CardBuilderToolbar
        onBuildFromScratch={mockOnBuildFromScratch}
        onPublicTemplates={mockOnPublicTemplates}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: 'toolbar.buildFromScratch' }));
    expect(mockOnBuildFromScratch).toHaveBeenCalledTimes(1);
  });

  it('calls onPublicTemplates when Public Templates button is clicked', async () => {
    render(
      <CardBuilderToolbar
        onBuildFromScratch={mockOnBuildFromScratch}
        onPublicTemplates={mockOnPublicTemplates}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: 'toolbar.publicTemplates' }));
    expect(mockOnPublicTemplates).toHaveBeenCalledTimes(1);
  });
});
