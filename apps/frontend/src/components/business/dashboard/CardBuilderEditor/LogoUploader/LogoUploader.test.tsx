/**
 * LogoUploader tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LogoUploader } from './LogoUploader';

// Mock the cardService
vi.mock('@/services/cardService', () => ({
  cardService: {
    generateLogoUploadUrl: vi.fn().mockResolvedValue({
      uploadUrl: 'https://r2.example.com/upload',
      key: 'tenant1/template1/issuer-logo.png',
    }),
    update: vi.fn().mockResolvedValue({}),
  },
}));

// Mock the useImageCrop hook
vi.mock('@/hooks/useImageCrop', () => ({
  useImageCrop: vi.fn().mockReturnValue({
    cropState: {
      focalX: 0.5,
      focalY: 0.5,
      scale: 1.0,
      naturalWidth: 1920,
      naturalHeight: 1080,
    },
    imageUrl: null,
    setImageRef: vi.fn(),
    loadImage: vi.fn(),
    setFocalPoint: vi.fn(),
    setScale: vi.fn(),
    cropImage: vi.fn().mockResolvedValue(new Blob()),
    resetCrop: vi.fn(),
    hasImage: false,
    originalFile: null,
  }),
}));

describe('LogoUploader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders upload button when idle', () => {
    render(
      <LogoUploader
        templateId="test-id"
        onLogoUploaded={vi.fn()}
      />,
    );

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('shows select file button', () => {
    render(
      <LogoUploader
        templateId="test-id"
        onLogoUploaded={vi.fn()}
      />,
    );

    // Button with select file text should exist (i18n: 選擇圖片)
    expect(screen.getByText(/選擇圖片/i)).toBeInTheDocument();
  });
});
