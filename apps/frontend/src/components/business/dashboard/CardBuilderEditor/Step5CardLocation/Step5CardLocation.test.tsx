/**
 * Step5CardLocation — Vitest + RTL tests
 *
 * Covers the Step 5 composition (2026-09-06 refactor):
 *   1. Renders the section titles + LocationsDisabledToggle
 *   2. InitialMessageField: 50-char cap, counter, maxLength guard
 *   3. LocationsMaxDistanceField: number input [100-1000], clear-to-default button
 *      (renamed 2026-09-06 from NotificationRadiusField)
 *   4. LocationsField: add/remove button behavior, max-10 cap, "min 1 location"
 *      hint when locationsDisabled=false
 *   5. LocationRow: paste-to-split auto-splits lat/lng, relevantText field,
 *      required lat/lng when locationsDisabled=false
 *   6. locationsDisabled toggle: when true → collapses body + clears data
 *
 * Mounts the i18n stub consistent with the existing Step4CardInfo tests
 * (so the keys themselves are the readable labels in the test output).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { Step5CardLocation } from './Step5CardLocation';
import { useCardBuilderStore } from '../CardBuilderEditor.store';

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({ t: vi.fn((key: string) => key) })),
}));

beforeEach(() => {
  cleanup();
  useCardBuilderStore.getState().reset();
});

describe('Step5CardLocation — section composition', () => {
  it('renders the section titles (Initial message + Locations + Toggle)', () => {
    render(<Step5CardLocation showValidation={false} />);
    expect(screen.getByText('step5.initialMessage.label')).toBeInTheDocument();
    expect(screen.getByText('step5.locations.title')).toBeInTheDocument();
    expect(screen.getByText('step5.locationsDisabled.label')).toBeInTheDocument();
  });

  it('renders the disabled Hint when locationsDisabled=true (body collapsed)', () => {
    useCardBuilderStore.getState().setLocationsDisabled(true);
    render(<Step5CardLocation showValidation={false} />);
    // Body collapsed → only the disabled hint remains (initialMessage/radius/locations fields hidden)
    expect(screen.getByText('step5.skipNotice')).toBeInTheDocument();
    expect(screen.queryByText('step5.initialMessage.label')).not.toBeInTheDocument();
    expect(screen.queryByText('step5.locationsMaxDistance.label')).not.toBeInTheDocument();
    expect(screen.queryByText('step5.locations.title')).not.toBeInTheDocument();
  });

  it('renders all three sub-components when locationsDisabled=false (default)', () => {
    render(<Step5CardLocation showValidation={false} />);
    expect(screen.getByText('step5.initialMessage.label')).toBeInTheDocument();
    expect(screen.getByText('step5.locationsMaxDistance.label')).toBeInTheDocument();
    expect(screen.getByText('step5.locations.title')).toBeInTheDocument();
    // skipNotice NOT shown when enabled
    expect(screen.queryByText('step5.skipNotice')).not.toBeInTheDocument();
  });
});

describe('Step5CardLocation — InitialMessageField', () => {
  it('renders a single-line input with maxLength=50', () => {
    render(<Step5CardLocation showValidation={false} />);
    const input = document.getElementById('step5-initial-message') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe('INPUT');
    expect(input.maxLength).toBe(50);
  });

  it('shows the counter with current character count', () => {
    useCardBuilderStore.getState().setInitialMessage('Hello');
    render(<Step5CardLocation showValidation={false} />);
    const counter = document.getElementById('step5-initial-message-counter');
    expect(counter).toBeInTheDocument();
    expect(counter?.textContent).toContain('step5.initialMessage.counter');
  });

  it('truncates initialMessage at 50 chars (setInitialMessage guard)', () => {
    useCardBuilderStore.getState().setInitialMessage('x'.repeat(60));
    expect(useCardBuilderStore.getState().initialMessage.length).toBe(50);
  });
});

describe('Step5CardLocation — LocationsMaxDistanceField (renamed 2026-09-06)', () => {
  it('renders the locationsMaxDistance section title', () => {
    render(<Step5CardLocation showValidation={false} />);
    expect(screen.getByText('step5.locationsMaxDistance.label')).toBeInTheDocument();
  });

  it('input starts empty when locationsMaxDistance is null', () => {
    useCardBuilderStore.getState().setLocationsMaxDistance(null);
    render(<Step5CardLocation showValidation={false} />);
    const input = document.getElementById('step5-locations-max-distance') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe('');
  });

  it('input shows the current value when locationsMaxDistance is set', () => {
    useCardBuilderStore.getState().setLocationsMaxDistance(500);
    render(<Step5CardLocation showValidation={false} />);
    const input = document.getElementById('step5-locations-max-distance') as HTMLInputElement;
    expect(input.value).toBe('500');
  });

  it('typing a valid number updates the store', () => {
    render(<Step5CardLocation showValidation={false} />);
    const input = document.getElementById('step5-locations-max-distance') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '250' } });
    expect(useCardBuilderStore.getState().locationsMaxDistance).toBe(250);
  });

  it('clear button appears when locationsMaxDistance is set', () => {
    useCardBuilderStore.getState().setLocationsMaxDistance(500);
    render(<Step5CardLocation showValidation={false} />);
    const clearButton = screen.getByRole('button', { name: 'step5.locationsMaxDistance.useDefault' });
    expect(clearButton).toBeInTheDocument();
  });

  it('clear button resets locationsMaxDistance to null', () => {
    useCardBuilderStore.getState().setLocationsMaxDistance(500);
    render(<Step5CardLocation showValidation={false} />);
    const clearButton = screen.getByRole('button', { name: 'step5.locationsMaxDistance.useDefault' });
    fireEvent.click(clearButton);
    expect(useCardBuilderStore.getState().locationsMaxDistance).toBeNull();
  });

  it('setLocationsMaxDistance clamps out-of-range values to the nearest bound', () => {
    useCardBuilderStore.getState().setLocationsMaxDistance(50);
    expect(useCardBuilderStore.getState().locationsMaxDistance).toBe(100); // clamped to min
    useCardBuilderStore.getState().setLocationsMaxDistance(9999);
    expect(useCardBuilderStore.getState().locationsMaxDistance).toBe(1000); // clamped to max
  });

  it('setLocationsMaxDistance rounds float to nearest integer', () => {
    useCardBuilderStore.getState().setLocationsMaxDistance(250.7);
    expect(useCardBuilderStore.getState().locationsMaxDistance).toBe(251);
    useCardBuilderStore.getState().setLocationsMaxDistance(250.3);
    expect(useCardBuilderStore.getState().locationsMaxDistance).toBe(250);
  });
});

describe('Step5CardLocation — LocationsDisabledToggle (2026-09-06)', () => {
  it('toggle is checked by default (locationsDisabled=false → geolocation enabled)', () => {
    render(<Step5CardLocation showValidation={false} />);
    const checkbox = document.getElementById('step5-locations-disabled') as HTMLInputElement;
    expect(checkbox).toBeInTheDocument();
    expect(checkbox.checked).toBe(true);
    expect(screen.getByText('step5.locationsDisabled.enabledHint')).toBeInTheDocument();
  });

  it('unchecking the toggle sets locationsDisabled=true and collapses the body', () => {
    render(<Step5CardLocation showValidation={false} />);
    const checkbox = document.getElementById('step5-locations-disabled') as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(useCardBuilderStore.getState().locationsDisabled).toBe(true);
    // Body collapses → skipNotice visible
    expect(screen.getByText('step5.skipNotice')).toBeInTheDocument();
    expect(screen.getByText('step5.locationsDisabled.disabledHint')).toBeInTheDocument();
  });

  it('toggling to disabled CLEARS locations + locationsMaxDistance (no stale DB data)', () => {
    // Seed locations + radius
    useCardBuilderStore.getState().setLocationsMaxDistance(500);
    useCardBuilderStore.getState().addLocation();
    expect(useCardBuilderStore.getState().locations.length).toBe(1);
    expect(useCardBuilderStore.getState().locationsMaxDistance).toBe(500);

    // Toggle off
    useCardBuilderStore.getState().setLocationsDisabled(true);

    // Both cleared
    expect(useCardBuilderStore.getState().locations.length).toBe(0);
    expect(useCardBuilderStore.getState().locationsMaxDistance).toBeNull();
  });

  it('toggling back to enabled does NOT auto-populate fields (user must add them)', () => {
    useCardBuilderStore.getState().setLocationsDisabled(true);
    useCardBuilderStore.getState().setLocationsDisabled(false);
    // Still empty
    expect(useCardBuilderStore.getState().locations.length).toBe(0);
    expect(useCardBuilderStore.getState().locationsMaxDistance).toBeNull();
  });
});

describe('Step5CardLocation — LocationsField', () => {
  it('renders the "min 1 location" empty-state hint when locations.length === 0', () => {
    render(<Step5CardLocation showValidation={false} />);
    expect(screen.getByText('step5.locations.locationsMinOneHint')).toBeInTheDocument();
  });

  it('renders no location rows by default', () => {
    render(<Step5CardLocation showValidation={false} />);
    expect(document.querySelectorAll('[id^="step5-location-"][id$="-name"]')).toHaveLength(0);
  });

  it('addLocation button appends one empty row', () => {
    render(<Step5CardLocation showValidation={false} />);
    const addButton = screen.getByRole('button', { name: 'step5.locations.addLocation' });
    fireEvent.click(addButton);
    expect(useCardBuilderStore.getState().locations).toHaveLength(1);
    // The new row shows up in the DOM
    expect(
      document.querySelectorAll('[id^="step5-location-"][id$="-name"]'),
    ).toHaveLength(1);
  });

  it('addLocation is a no-op at the LOCATIONS_MAX cap', () => {
    // Seed 10 rows
    for (let i = 0; i < 10; i++) {
      useCardBuilderStore.getState().addLocation();
    }
    expect(useCardBuilderStore.getState().locations).toHaveLength(10);
    render(<Step5CardLocation showValidation={false} />);
    const addButton = screen.getByRole('button', { name: 'step5.locations.addLocation' });
    // Button is disabled at the cap (UI belt-and-suspenders)
    expect(addButton).toBeDisabled();
    // Direct store call is also no-op (defensive guard)
    useCardBuilderStore.getState().addLocation();
    expect(useCardBuilderStore.getState().locations).toHaveLength(10);
  });

  it('removeLocation removes the row and does NOT refill (locations are optional)', () => {
    useCardBuilderStore.getState().addLocation();
    useCardBuilderStore.getState().addLocation();
    expect(useCardBuilderStore.getState().locations).toHaveLength(2);
    const rows = render(<Step5CardLocation showValidation={false} />);
    const removeButtons = screen.getAllByRole('button', {
      name: 'step5.locations.removeLocation',
    });
    expect(removeButtons).toHaveLength(2);
    fireEvent.click(removeButtons[0]!);
    expect(useCardBuilderStore.getState().locations).toHaveLength(1);
    rows.unmount();
  });

  it('counter shows current location count via t() with {{count}} placeholder key', () => {
    useCardBuilderStore.getState().addLocation();
    render(<Step5CardLocation showValidation={false} />);
    expect(screen.getByText('step5.locations.counter')).toBeInTheDocument();
  });

  it('renders the maxReached hint when at the cap', () => {
    for (let i = 0; i < 10; i++) {
      useCardBuilderStore.getState().addLocation();
    }
    render(<Step5CardLocation showValidation={false} />);
    expect(screen.getByText('step5.locations.maxReached')).toBeInTheDocument();
  });
});

describe('Step5CardLocation — LocationRow paste-to-split', () => {
  it('auto-splits "25.033,121.565" into latitude + longitude', () => {
    useCardBuilderStore.getState().addLocation();
    render(<Step5CardLocation showValidation={false} />);
    const coordsInput = document.getElementById(
      'step5-location-0-coords',
    ) as HTMLInputElement;
    expect(coordsInput).toBeInTheDocument();

    // Simulate a clipboard paste
    const clipboardData = { getData: () => '25.033,121.565' };
    fireEvent.paste(coordsInput, { clipboardData } as unknown as ClipboardEvent);

    const row = useCardBuilderStore.getState().locations[0]!;
    expect(row.latitude).toBe(25.033);
    expect(row.longitude).toBe(121.565);
  });

  it('auto-splits high-precision Google Maps coordinates', () => {
    useCardBuilderStore.getState().addLocation();
    render(<Step5CardLocation showValidation={false} />);
    const coordsInput = document.getElementById(
      'step5-location-0-coords',
    ) as HTMLInputElement;
    const clipboardData = {
      getData: () => '25.17568282511508,121.45070027378395',
    };
    fireEvent.paste(coordsInput, { clipboardData } as unknown as ClipboardEvent);

    const row = useCardBuilderStore.getState().locations[0]!;
    expect(row.latitude).toBeCloseTo(25.17568282511508, 10);
    expect(row.longitude).toBeCloseTo(121.45070027378395, 10);
  });

  it('rejects invalid format with the invalidFormat i18n key', () => {
    useCardBuilderStore.getState().addLocation();
    render(<Step5CardLocation showValidation={true} />);
    const coordsInput = document.getElementById(
      'step5-location-0-coords',
    ) as HTMLInputElement;
    const clipboardData = { getData: () => 'hello world' };
    fireEvent.paste(coordsInput, { clipboardData } as unknown as ClipboardEvent);

    // The store is NOT updated
    const row = useCardBuilderStore.getState().locations[0]!;
    expect(Number.isNaN(row.latitude)).toBe(true);
    expect(Number.isNaN(row.longitude)).toBe(true);

    // The error message is rendered (i18n key from parseCoordinatePaste)
    expect(
      screen.getByText('step5.locations.validation.invalidFormat'),
    ).toBeInTheDocument();
  });

  it('rejects latitude out of range', () => {
    useCardBuilderStore.getState().addLocation();
    render(<Step5CardLocation showValidation={true} />);
    const coordsInput = document.getElementById(
      'step5-location-0-coords',
    ) as HTMLInputElement;
    const clipboardData = { getData: () => '95,121' };
    fireEvent.paste(coordsInput, { clipboardData } as unknown as ClipboardEvent);

    // Store NOT updated; error message rendered
    expect(
      screen.getByText('step5.locations.validation.latitudeOutOfRange'),
    ).toBeInTheDocument();
  });

  it('store integration: full addLocation → setName → pasteCoordinates flow', () => {
    // Sanity test for the round-trip: user clicks +, types name, pastes coords.
    render(<Step5CardLocation showValidation={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'step5.locations.addLocation' }));
    const nameInput = document.getElementById(
      'step5-location-0-name',
    ) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: '台北 101' } });
    const coordsInput = document.getElementById(
      'step5-location-0-coords',
    ) as HTMLInputElement;
    const clipboardData = { getData: () => '25.0337,121.5645' };
    fireEvent.paste(coordsInput, { clipboardData } as unknown as ClipboardEvent);

    const row = useCardBuilderStore.getState().locations[0]!;
    expect(row.name).toBe('台北 101');
    expect(row.latitude).toBe(25.0337);
    expect(row.longitude).toBe(121.5645);
  });

  it('row shape includes relevantText (2026-09-06 refactor)', () => {
    useCardBuilderStore.getState().addLocation();
    render(<Step5CardLocation showValidation={false} />);
    const relevantTextInput = document.getElementById(
      'step5-location-0-relevant-text',
    ) as HTMLInputElement;
    expect(relevantTextInput).toBeInTheDocument();
    expect(relevantTextInput.tagName).toBe('INPUT');
    expect(relevantTextInput.maxLength).toBe(100);

    // Type → store updates
    fireEvent.change(relevantTextInput, { target: { value: '歡迎光臨' } });
    expect(useCardBuilderStore.getState().locations[0]!.relevantText).toBe('歡迎光臨');
  });

  it('clearing the relevantText field stores null (no custom lock-screen message)', () => {
    useCardBuilderStore.getState().addLocation();
    useCardBuilderStore.getState().setLocationRelevantText(0, '歡迎光臨');
    render(<Step5CardLocation showValidation={false} />);
    const relevantTextInput = document.getElementById(
      'step5-location-0-relevant-text',
    ) as HTMLInputElement;
    fireEvent.change(relevantTextInput, { target: { value: '' } });
    expect(useCardBuilderStore.getState().locations[0]!.relevantText).toBe(null);
  });
});

describe('Step5CardLocation — store defensive sanitization (loadSettings)', () => {
  it('loadSettings coerces locations with bad lat/lng into a clean array (skips bad rows)', () => {
    // Seed 1 good row and 1 bad row to verify sanitizer
    const store = useCardBuilderStore.getState();
    store.loadSettings({
      locations: [
        { name: 'A', latitude: 25, longitude: 121 },
        { name: 'B', latitude: 999, longitude: 121 }, // bad latitude
        { name: 'C', latitude: 26, longitude: 200 }, // bad longitude
        { name: 'D', latitude: 27, longitude: 122 }, // good
      ],
    });
    const locations = useCardBuilderStore.getState().locations;
    // Only A and D survive
    expect(locations).toHaveLength(2);
    expect(locations[0]?.name).toBe('A');
    expect(locations[1]?.name).toBe('D');
  });

  it('loadSettings accepts relevantText per row (≤ 100 chars, optional)', () => {
    useCardBuilderStore.getState().loadSettings({
      locations: [
        { name: 'A', latitude: 25, longitude: 121, relevantText: '歡迎光臨 🎉' },
        { name: 'B', latitude: 26, longitude: 122, relevantText: null },
        { name: 'C', latitude: 27, longitude: 123 }, // omitted → null
      ],
    });
    const locations = useCardBuilderStore.getState().locations;
    expect(locations).toHaveLength(3);
    expect(locations[0]!.relevantText).toBe('歡迎光臨 🎉');
    expect(locations[1]!.relevantText).toBe(null);
    expect(locations[2]!.relevantText).toBe(null);
  });

  it('loadSettings accepts locationsDisabled toggle', () => {
    useCardBuilderStore.getState().loadSettings({ locationsDisabled: true });
    expect(useCardBuilderStore.getState().locationsDisabled).toBe(true);

    useCardBuilderStore.getState().loadSettings({ locationsDisabled: false });
    expect(useCardBuilderStore.getState().locationsDisabled).toBe(false);
  });

  it('loadSettings accepts locationsMaxDistance (rename from notificationRadius)', () => {
    useCardBuilderStore.getState().loadSettings({ locationsMaxDistance: 500 });
    expect(useCardBuilderStore.getState().locationsMaxDistance).toBe(500);
  });

  it('loadSettings falls back to deprecated notificationRadius when locationsMaxDistance missing', () => {
    // Pre-Migration 017 rows may still carry `notificationRadius`.
    // The store coerces the legacy key into the new field.
    useCardBuilderStore.getState().loadSettings({ notificationRadius: 250 });
    expect(useCardBuilderStore.getState().locationsMaxDistance).toBe(250);
  });

  it('loadSettings truncates initialMessage at 50 chars', () => {
    useCardBuilderStore.getState().loadSettings({
      initialMessage: 'x'.repeat(60),
    });
    expect(useCardBuilderStore.getState().initialMessage.length).toBe(50);
  });

  it('loadSettings truncates locations array to LOCATIONS_MAX=10', () => {
    const oversized = Array.from({ length: 15 }, (_, i) => ({
      name: `L${i}`,
      latitude: 0,
      longitude: 0,
    }));
    useCardBuilderStore.getState().loadSettings({ locations: oversized });
    expect(useCardBuilderStore.getState().locations).toHaveLength(10);
  });
});