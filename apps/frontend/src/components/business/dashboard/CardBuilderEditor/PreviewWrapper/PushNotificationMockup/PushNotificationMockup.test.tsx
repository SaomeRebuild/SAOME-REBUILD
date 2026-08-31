/**
 * PushNotificationMockup — Vitest + RTL Tests
 *
 * Phase 9 (2026-08-31): the push-notification overlay rendered inside
 * PhoneFrame consumes the icon image uploaded via MediaAssetUploader
 * variant="icon". This test guards:
 * - renders nothing when cardId is null (create-draft mode)
 * - renders issuerName fallback when not provided
 * - renders with full props (issuerName + iconImage)
 *
 * NOTE: Bug #8.5 fix 2026-08-31 — corrected props to match the actual
 * PushNotificationMockupProps interface (iconImage / issuerName /
 * iconImageVersion). The previous test used non-existent props (title,
 * body, iconUrl) which caused pre-existing TS errors blocking the build.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, beforeEach } from 'vitest';
import { PushNotificationMockup } from './PushNotificationMockup';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';

describe('PushNotificationMockup', () => {
  beforeEach(() => {
    // Reset to clean state before each test
    useCardBuilderStore.setState({
      cardId: null,
      name: '',
      cardType: null,
      step: 1,
      completedSteps: new Set(),
      cardSide: 'front',
      issuerName: '',
      issuerLogo: '',
      issuerLogoVersion: 0,
      iconImage: '',
      iconImageVersion: 0,
      backgroundColor: '#1a1a1a',
      textColor: '#ffffff',
      holderName: '',
      barcodeType: 'qr_code',
      storeName: '',
      passValidDays: null,
      expiryDate: '',
      currency: 'TWD',
      isPaid: false,
    });
  });

  it('renders nothing when cardId is null (create-draft mode)', () => {
    const { container } = render(<PushNotificationMockup iconImage="key" issuerName="X" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders with cardId set + issuerName provided', () => {
    useCardBuilderStore.setState({ cardId: 'test-template-id' });
    render(<PushNotificationMockup iconImage="key" issuerName="STARBUCKS" />);
    expect(screen.getByText('STARBUCKS')).toBeInTheDocument();
    expect(screen.getByTestId('push-notification-mockup')).toBeInTheDocument();
  });

  it('falls back to "Card Issuer" when issuerName is empty', () => {
    useCardBuilderStore.setState({ cardId: 'test-template-id' });
    render(<PushNotificationMockup iconImage="key" issuerName="" />);
    expect(screen.getByText('Card Issuer')).toBeInTheDocument();
  });

  it('uses correct testid root', () => {
    useCardBuilderStore.setState({ cardId: 'test-template-id' });
    const { container } = render(<PushNotificationMockup iconImage="key" issuerName="X" />);
    expect(screen.getByTestId('push-notification-mockup')).toBe(container.firstChild);
  });
});
