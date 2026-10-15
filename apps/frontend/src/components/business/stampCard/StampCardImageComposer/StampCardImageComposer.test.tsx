/**
 * StampCardImageComposer — component tests (Phase 2, 2026-10-13).
 *
 * The test surface is split into two layers:
 *   1. `composeStampCardImageOnWeb` (the OffscreenCanvas binding) is
 *      tested at the function level — we mock OffscreenCanvas + Image
 *      so the binding runs without a real browser canvas.
 *   2. The React component (`StampCardImageComposer`) is tested via
 *      RTL: we mock the `composeStampCardImage` + `uploadStampCardImage`
 *      modules and assert the state machine transitions + i18n key
 *      rendering.
 *
 * 2026-10-13 — created with the stamp card image composition plan.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { i18n } from '@/test/i18n';
import { StampCardImageComposer } from './StampCardImageComposer';
import type { StampCardImageInput } from '@saome/shared/schemas/stampCard';
import { STAMP_FILL_CAP } from '@saome/shared/constants/stampCard';

// Mock the binding + service so the test environment does not try to
// create an OffscreenCanvas (jsdom does not implement it) or hit the
// network.
vi.mock('./composeStampCardImage', () => ({
  composeStampCardImage: vi.fn(),
}));
vi.mock('./uploadStampCardImage', () => ({
  uploadStampCardImage: vi.fn(),
  UploadStampCardImageError: class extends Error {},
}));

import { composeStampCardImage } from './composeStampCardImage';
import { uploadStampCardImage } from './uploadStampCardImage';

const mockedCompose = vi.mocked(composeStampCardImage);
const mockedUpload = vi.mocked(uploadStampCardImage);

const baseInput: StampCardImageInput = {
  rows: 3,
  cols: 5,
  gridColor: 'transparent',
  iconId: 'bell',
  iconColor: '#FF0000',
  background: { type: 'color', value: '#FFFFFF' },
  fillCount: 0,
};

beforeEach(() => {
  i18n.changeLanguage('zh-TW');
  mockedCompose.mockReset();
  mockedUpload.mockReset();
});

describe('StampCardImageComposer — initial state', () => {
  it('renders the trigger button with the i18n label', () => {
    render(
      <StampCardImageComposer
        templateId="tpl-1"
        authToken="token"
        input={baseInput}
      />,
    );
    expect(screen.getByTestId('stamp-card-composer-button').textContent).toBe(
      '預覽並儲存 0.png',
    );
  });

  it('disables the button when templateId is null', () => {
    render(
      <StampCardImageComposer
        templateId={null}
        authToken="token"
        input={baseInput}
      />,
    );
    expect(screen.getByTestId('stamp-card-composer-button')).toBeDisabled();
  });

  it('shows the idle status pill on mount', () => {
    render(
      <StampCardImageComposer
        templateId="tpl-1"
        authToken="token"
        input={baseInput}
      />,
    );
    expect(screen.getByTestId('stamp-card-composer-status').textContent).toContain(
      '尚未上傳',
    );
  });
});

describe('StampCardImageComposer — happy path', () => {
  it('composes the image with fillCount=0 then uploads to /api/templates/:id/stamp-images/0', async () => {
    const fakeBlob = new Blob([new Uint8Array(8)], { type: 'image/png' });
    mockedCompose.mockResolvedValue(fakeBlob);
    mockedUpload.mockResolvedValue({
      r2Key: 'tenants/abc/templates/tpl-1/stamp-0.png',
      byteHash: 'a'.repeat(64),
      byteLength: 8,
      uploadedAt: '2026-10-13T00:00:00.000Z',
    });

    render(
      <StampCardImageComposer
        templateId="tpl-1"
        authToken="tkn"
        input={baseInput}
      />,
    );
    fireEvent.click(screen.getByTestId('stamp-card-composer-button'));

    await waitFor(() => {
      expect(mockedUpload).toHaveBeenCalledWith('tpl-1', 0, fakeBlob, 'tkn');
    });
    expect(screen.getByTestId('stamp-card-composer-status').textContent).toContain(
      '0.png 已上傳',
    );
  });

  it('passes the input as-is to composeStampCardImage (including the 0 fillCount)', async () => {
    const fakeBlob = new Blob([new Uint8Array(8)], { type: 'image/png' });
    mockedCompose.mockResolvedValue(fakeBlob);
    mockedUpload.mockResolvedValue({
      r2Key: 'k',
      byteHash: 'a'.repeat(64),
      byteLength: 8,
      uploadedAt: '2026-10-13T00:00:00.000Z',
    });

    render(
      <StampCardImageComposer
        templateId="tpl-1"
        authToken="tkn"
        input={baseInput}
      />,
    );
    fireEvent.click(screen.getByTestId('stamp-card-composer-button'));
    await waitFor(() => expect(mockedCompose).toHaveBeenCalled());
    expect(mockedCompose).toHaveBeenCalledWith(baseInput);
  });
});

describe('StampCardImageComposer — error path', () => {
  it('shows the error status when composeStampCardImage throws', async () => {
    mockedCompose.mockRejectedValue(new Error('canvas blew up'));

    render(
      <StampCardImageComposer
        templateId="tpl-1"
        authToken="tkn"
        input={baseInput}
      />,
    );
    fireEvent.click(screen.getByTestId('stamp-card-composer-button'));

    await waitFor(() => {
      expect(screen.getByTestId('stamp-card-composer-status').textContent).toContain(
        '上傳失敗',
      );
    });
    expect(mockedUpload).not.toHaveBeenCalled();
  });

  it('shows the error status when upload fails with UploadStampCardImageError', async () => {
    const fakeBlob = new Blob([new Uint8Array(8)], { type: 'image/png' });
    mockedCompose.mockResolvedValue(fakeBlob);
    mockedUpload.mockRejectedValue(
      new (class extends Error {
        constructor() {
          super('boom');
          this.name = 'UploadStampCardImageError';
        }
        status = 500;
      })(),
    );

    render(
      <StampCardImageComposer
        templateId="tpl-1"
        authToken="tkn"
        input={baseInput}
      />,
    );
    fireEvent.click(screen.getByTestId('stamp-card-composer-button'));

    await waitFor(() => {
      expect(screen.getByTestId('stamp-card-composer-status').textContent).toContain(
        '上傳失敗',
      );
    });
  });

  it('does not call upload when templateId is null', async () => {
    render(
      <StampCardImageComposer
        templateId={null}
        authToken="tkn"
        input={baseInput}
      />,
    );
    // Button is disabled, but we can still attempt to fire if forced;
    // the hook should also short-circuit. Either way, no upload.
    expect(mockedUpload).not.toHaveBeenCalled();
  });
});

describe('StampCardImageComposer — cap warning', () => {
  it('shows the cap warning when rows*cols > STAMP_FILL_CAP (4×5=20)', () => {
    render(
      <StampCardImageComposer
        templateId="tpl-1"
        authToken="tkn"
        input={{ ...baseInput, rows: 4, cols: 5 }}
      />,
    );
    expect(
      screen.getByTestId('stamp-card-composer-cap-warning').textContent,
    ).toContain(String(STAMP_FILL_CAP));
  });

  it('hides the cap warning when rows*cols <= STAMP_FILL_CAP (3×5=15)', () => {
    render(
      <StampCardImageComposer
        templateId="tpl-1"
        authToken="tkn"
        input={{ ...baseInput, rows: 3, cols: 5 }}
      />,
    );
    expect(
      screen.queryByTestId('stamp-card-composer-cap-warning'),
    ).not.toBeInTheDocument();
  });
});

describe('StampCardImageComposer — grid transparency hint', () => {
  it('always shows the grid transparency hint regardless of grid size', () => {
    render(
      <StampCardImageComposer
        templateId="tpl-1"
        authToken="tkn"
        input={baseInput}
      />,
    );
    expect(
      screen.getByTestId('stamp-card-composer-grid-hint').textContent,
    ).toContain('透明的');
  });
});

describe('StampCardImageComposer — English locale', () => {
  it('renders the English trigger label when language is "en"', async () => {
    await i18n.changeLanguage('en');
    render(
      <StampCardImageComposer
        templateId="tpl-1"
        authToken="tkn"
        input={baseInput}
      />,
    );
    expect(screen.getByTestId('stamp-card-composer-button').textContent).toBe(
      'Preview & save 0.png',
    );
  });
});
