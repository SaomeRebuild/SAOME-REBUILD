/**
 * Locations validation — Vitest unit tests.
 *
 * @see packages/shared/logic/locations.ts
 *
 * Tests the exported functions:
 *   - parseCoordinatePaste: paste-to-split lat/lng (Google Maps format)
 *   - validateLocation: per-row validation (name + lat + lng + relevantText)
 *   - validateAllLocations: array-level validation
 *   - parseLocationsMaxDistance / validateLocationsMaxDistance: radius value
 *     (2026-09-06 rename from parseNotificationRadius)
 *
 * Behavior contract must match exactly between web + RN consumers.
 */

import { describe, it, expect } from 'vitest';
import {
  parseCoordinatePaste,
  validateLocation,
  validateAllLocations,
  parseLocationsMaxDistance,
  validateLocationsMaxDistance,
  type LocationInput,
} from './locations';

describe('parseCoordinatePaste — Google Maps format', () => {
  it('parses "25.033,121.565" (no space)', () => {
    const result = parseCoordinatePaste('25.033,121.565');
    expect(result).toEqual({ latitude: 25.033, longitude: 121.565 });
  });

  it('parses "25.033, 121.565" (with space after comma)', () => {
    const result = parseCoordinatePaste('25.033, 121.565');
    expect(result).toEqual({ latitude: 25.033, longitude: 121.565 });
  });

  it('parses "25.17568282511508,121.45070027378395" (high-precision Google Maps format)', () => {
    const result = parseCoordinatePaste('25.17568282511508,121.45070027378395');
    expect(result).toEqual({
      latitude: 25.17568282511508,
      longitude: 121.45070027378395,
    });
  });

  it('parses negative coordinates (Western / Southern hemisphere)', () => {
    const result = parseCoordinatePaste('-33.8688, -151.2093');
    expect(result).toEqual({ latitude: -33.8688, longitude: -151.2093 });
  });

  it('tolerates leading and trailing whitespace', () => {
    const result = parseCoordinatePaste('   25.033,121.565   ');
    expect(result).toEqual({ latitude: 25.033, longitude: 121.565 });
  });

  it('parses integer coordinates', () => {
    const result = parseCoordinatePaste('25,121');
    expect(result).toEqual({ latitude: 25, longitude: 121 });
  });

  it('parses boundary values 90 / -90 / 180 / -180', () => {
    expect(parseCoordinatePaste('90,0')).toEqual({ latitude: 90, longitude: 0 });
    expect(parseCoordinatePaste('-90,0')).toEqual({ latitude: -90, longitude: 0 });
    expect(parseCoordinatePaste('0,180')).toEqual({ latitude: 0, longitude: 180 });
    expect(parseCoordinatePaste('0,-180')).toEqual({ latitude: 0, longitude: -180 });
  });

  it('returns invalidFormat error when input is empty', () => {
    const result = parseCoordinatePaste('');
    expect(result).toEqual({
      type: 'invalidFormat',
      message: 'step5.locations.validation.invalidFormat',
    });
  });

  it('returns invalidFormat error when input is plain text', () => {
    const result = parseCoordinatePaste('hello world');
    expect(result).toEqual({
      type: 'invalidFormat',
      message: 'step5.locations.validation.invalidFormat',
    });
  });

  it('returns invalidFormat error when there is no comma', () => {
    const result = parseCoordinatePaste('25.033 121.565');
    expect(result).toEqual({
      type: 'invalidFormat',
      message: 'step5.locations.validation.invalidFormat',
    });
  });

  it('returns invalidFormat error when only one number is provided', () => {
    const result = parseCoordinatePaste('25.033,');
    expect(result).toEqual({
      type: 'invalidFormat',
      message: 'step5.locations.validation.invalidFormat',
    });
  });

  it('returns invalidFormat error when there are three or more comma-separated values', () => {
    const result = parseCoordinatePaste('25.033,121.565,17z');
    expect(result).toEqual({
      type: 'invalidFormat',
      message: 'step5.locations.validation.invalidFormat',
    });
  });

  it('returns latitudeOutOfRange error when latitude > 90', () => {
    const result = parseCoordinatePaste('95,121');
    expect(result).toEqual({
      type: 'latitudeOutOfRange',
      message: 'step5.locations.validation.latitudeOutOfRange',
    });
  });

  it('returns latitudeOutOfRange error when latitude < -90', () => {
    const result = parseCoordinatePaste('-95,121');
    expect(result).toEqual({
      type: 'latitudeOutOfRange',
      message: 'step5.locations.validation.latitudeOutOfRange',
    });
  });

  it('returns longitudeOutOfRange error when longitude > 180', () => {
    const result = parseCoordinatePaste('25,181');
    expect(result).toEqual({
      type: 'longitudeOutOfRange',
      message: 'step5.locations.validation.longitudeOutOfRange',
    });
  });

  it('returns longitudeOutOfRange error when longitude < -180', () => {
    const result = parseCoordinatePaste('25,-181');
    expect(result).toEqual({
      type: 'longitudeOutOfRange',
      message: 'step5.locations.validation.longitudeOutOfRange',
    });
  });
});

describe('validateLocation — per-row validation (lat/lng required, 2026-09-06 refactor)', () => {
  const validBase: LocationInput = {
    name: '台北 101',
    latitude: 25.033,
    longitude: 121.565,
    relevantText: null,
  };

  it('returns null for a minimal valid row (name + lat + lng + relevantText=null)', () => {
    expect(validateLocation(validBase)).toBeNull();
  });

  it('returns null for a valid row with non-null relevantText', () => {
    expect(
      validateLocation({ ...validBase, relevantText: '歡迎光臨 🎉' }),
    ).toBeNull();
  });

  it('returns nameEmpty error when name is empty string', () => {
    expect(
      validateLocation({ ...validBase, name: '' }),
    ).toEqual({
      type: 'nameEmpty',
      message: 'step5.locations.validation.nameEmpty',
    });
  });

  it('returns nameEmpty error when name is whitespace only', () => {
    expect(
      validateLocation({ ...validBase, name: '   ' }),
    ).toEqual({
      type: 'nameEmpty',
      message: 'step5.locations.validation.nameEmpty',
    });
  });

  it('returns nameTooLong error when name exceeds LOCATION_NAME_MAX_LENGTH', () => {
    expect(
      validateLocation({ ...validBase, name: 'x'.repeat(41) }),
    ).toEqual({
      type: 'nameTooLong',
      message: 'step5.locations.validation.nameTooLong',
    });
  });

  it('accepts name at exactly LOCATION_NAME_MAX_LENGTH chars', () => {
    expect(
      validateLocation({ ...validBase, name: 'x'.repeat(40) }),
    ).toBeNull();
  });

  it('returns latitudeRequired error when latitude is missing', () => {
    expect(
      validateLocation({ ...validBase, latitude: Number.NaN }),
    ).toEqual({
      type: 'latitudeRequired',
      message: 'step5.locations.validation.latitudeRequired',
    });
  });

  it('returns longitudeRequired error when longitude is missing', () => {
    expect(
      validateLocation({ ...validBase, longitude: Number.NaN }),
    ).toEqual({
      type: 'longitudeRequired',
      message: 'step5.locations.validation.longitudeRequired',
    });
  });

  it('returns latitudeRequired error when latitude is undefined', () => {
    const partial: Partial<LocationInput> = {
      name: 'X',
      longitude: 121.565,
      relevantText: null,
    };
    expect(validateLocation(partial)).toEqual({
      type: 'latitudeRequired',
      message: 'step5.locations.validation.latitudeRequired',
    });
  });

  it('returns longitudeRequired error when longitude is undefined', () => {
    const partial: Partial<LocationInput> = {
      name: 'X',
      latitude: 25.033,
      relevantText: null,
    };
    expect(validateLocation(partial)).toEqual({
      type: 'longitudeRequired',
      message: 'step5.locations.validation.longitudeRequired',
    });
  });

  it('returns relevantTextTooLong when relevantText exceeds RELEVANT_TEXT_MAX_LENGTH=100', () => {
    expect(
      validateLocation({ ...validBase, relevantText: 'x'.repeat(101) }),
    ).toEqual({
      type: 'relevantTextTooLong',
      message: 'step5.locations.validation.relevantTextTooLong',
    });
  });

  it('accepts relevantText at exactly RELEVANT_TEXT_MAX_LENGTH chars', () => {
    expect(
      validateLocation({ ...validBase, relevantText: 'x'.repeat(100) }),
    ).toBeNull();
  });
});

describe('validateAllLocations — array-level validation', () => {
  const validRow: LocationInput = {
    name: 'A',
    latitude: 25,
    longitude: 121,
    relevantText: null,
  };

  it('returns locationsMinOne error for empty array (requireMinOne=true)', () => {
    expect(validateAllLocations([])).toEqual({
      type: 'locationsMinOne',
      message: 'step5.locations.validation.locationsMinOne',
    });
  });

  it('returns null for empty array when requireMinOne=false (locationsDisabled=true scenario)', () => {
    // Step 5 skip path: when locationsDisabled=true the workspace
    // passes requireMinOne=false so an empty array is acceptable.
    expect(validateAllLocations([], { requireMinOne: false })).toBeNull();
  });

  it('returns null for an array of valid rows', () => {
    const locs: LocationInput[] = [
      { name: 'A', latitude: 25, longitude: 121, relevantText: null },
      { name: 'B', latitude: 26, longitude: 122, relevantText: null },
    ];
    expect(validateAllLocations(locs)).toBeNull();
  });

  it('returns tooMany error when array exceeds LOCATIONS_MAX', () => {
    const locs: LocationInput[] = Array.from({ length: 11 }, (_, i) => ({
      name: `L${i}`,
      latitude: 0,
      longitude: 0,
      relevantText: null,
    }));
    expect(validateAllLocations(locs)).toEqual({
      type: 'tooMany',
      message: 'step5.locations.validation.tooMany',
    });
  });

  it('accepts exactly LOCATIONS_MAX rows', () => {
    const locs: LocationInput[] = Array.from({ length: 10 }, (_, i) => ({
      name: `L${i}`,
      latitude: 0,
      longitude: 0,
      relevantText: null,
    }));
    expect(validateAllLocations(locs)).toBeNull();
  });

  it('returns the FIRST failing row error (in order)', () => {
    const locs: Partial<LocationInput>[] = [
      { name: 'A', latitude: 25, longitude: 121, relevantText: null }, // valid
      { name: '', latitude: 25, longitude: 121, relevantText: null }, // nameEmpty
      { name: 'C', latitude: 25, longitude: 121, relevantText: null }, // would be valid but skipped
    ];
    expect(validateAllLocations(locs)).toEqual({
      type: 'nameEmpty',
      message: 'step5.locations.validation.nameEmpty',
    });
  });

  it('reports latitudeRequired when a row has missing latitude (requireMinOne=true)', () => {
    const locs: Partial<LocationInput>[] = [
      { name: 'A', longitude: 121, relevantText: null }, // missing lat
    ];
    expect(validateAllLocations(locs)).toEqual({
      type: 'latitudeRequired',
      message: 'step5.locations.validation.latitudeRequired',
    });
  });
});

// ===== Step 5 — Locations max distance (2026-09-06 rename from notificationRadius) =====

describe('parseLocationsMaxDistance — radius validation', () => {
  it('returns null for null sentinel (use pass-type default)', () => {
    expect(parseLocationsMaxDistance(null)).toBeNull();
  });

  it('returns null for empty string (use pass-type default)', () => {
    expect(parseLocationsMaxDistance('')).toBeNull();
    expect(parseLocationsMaxDistance('   ')).toBeNull();
  });

  it('accepts integer at the lower bound (100)', () => {
    expect(parseLocationsMaxDistance(100)).toBe(100);
  });

  it('accepts integer at the upper bound (1000)', () => {
    expect(parseLocationsMaxDistance(1000)).toBe(1000);
  });

  it('accepts integer within range (500)', () => {
    expect(parseLocationsMaxDistance(500)).toBe(500);
  });

  it('accepts string numeric input within range', () => {
    expect(parseLocationsMaxDistance('500')).toBe(500);
    expect(parseLocationsMaxDistance('  750  ')).toBe(750);
  });

  it('returns locationsMaxDistanceOutOfRange for value below 100', () => {
    const result = parseLocationsMaxDistance(99);
    expect(result).toEqual({
      type: 'locationsMaxDistanceOutOfRange',
      message: 'step5.locations.validation.locationsMaxDistanceOutOfRange',
    });
  });

  it('returns locationsMaxDistanceOutOfRange for value above 1000', () => {
    const result = parseLocationsMaxDistance(1001);
    expect(result).toEqual({
      type: 'locationsMaxDistanceOutOfRange',
      message: 'step5.locations.validation.locationsMaxDistanceOutOfRange',
    });
  });

  it('returns locationsMaxDistanceInvalid for non-numeric string', () => {
    const result = parseLocationsMaxDistance('hello');
    expect(result).toEqual({
      type: 'locationsMaxDistanceInvalid',
      message: 'step5.locations.validation.locationsMaxDistanceInvalid',
    });
  });

  it('returns locationsMaxDistanceInvalid for undefined', () => {
    const result = parseLocationsMaxDistance(undefined);
    expect(result).toEqual({
      type: 'locationsMaxDistanceInvalid',
      message: 'step5.locations.validation.locationsMaxDistanceInvalid',
    });
  });

  it('returns locationsMaxDistanceInvalid for non-integer float', () => {
    const result = parseLocationsMaxDistance(150.5);
    expect(result).toEqual({
      type: 'locationsMaxDistanceInvalid',
      message: 'step5.locations.validation.locationsMaxDistanceInvalid',
    });
  });
});

describe('validateLocationsMaxDistance — store value validation', () => {
  it('returns null for null sentinel', () => {
    expect(validateLocationsMaxDistance(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(validateLocationsMaxDistance(undefined)).toBeNull();
  });

  it('returns null for valid integer in range', () => {
    expect(validateLocationsMaxDistance(500)).toBeNull();
  });

  it('returns locationsMaxDistanceOutOfRange for out-of-range number', () => {
    const result = validateLocationsMaxDistance(99);
    expect(result).toEqual({
      type: 'locationsMaxDistanceOutOfRange',
      message: 'step5.locations.validation.locationsMaxDistanceOutOfRange',
    });
  });
});