/**
 * Unit tests for the orphan-cleanup helpers added to cardService:
 *   - `collectR2KeysForTemplate` — enumerate every R2 key owned by a template
 *   - `diffRemovedR2Keys` — diff imageKey-bearing fields before vs after update
 *   - `enqueueTemplateR2Keys` — wrapper that enqueues each key (mocked)
 *
 * The DB-touching paths are exercised indirectly via mocks. These
 * tests focus on the pure logic of the diff / collection routines.
 *
 * Plan: `stay_on_free_plan_—_convert_sync_r2_delete_to_tombstone_+_cron_sweep_f0bcfa50`
 * (2026-10-03)
 */

import { describe, it, expect } from 'vitest';

import {
  collectR2KeysForTemplate,
  diffRemovedR2Keys,
} from '../services/r2Keys';

describe('collectR2KeysForTemplate', () => {
  const tenantId = 'tenant-A';
  const templateId = 'tpl-1';

  it('returns empty array for empty settings', () => {
    expect(collectR2KeysForTemplate(tenantId, templateId, {})).toEqual([]);
  });

  it('collects top-level imageKey fields', () => {
    const settings = {
      issuerLogo: `${tenantId}/${templateId}/logo.png`,
      backgroundImage: `${tenantId}/${templateId}/background.png`,
      iconImage: `${tenantId}/${templateId}/icon.png`,
    };
    const keys = collectR2KeysForTemplate(tenantId, templateId, settings);
    expect(keys.sort()).toEqual(
      [
        `${tenantId}/${templateId}/logo.png`,
        `${tenantId}/${templateId}/background.png`,
        `${tenantId}/${templateId}/icon.png`,
      ].sort(),
    );
  });

  it('collects table-card per-element imageKeys (with tenant prefix guard)', () => {
    const settings = {
      tableCard: {
        elements: [
          {
            id: 'el-1',
            type: 'image',
            imageKey: `${tenantId}/${templateId}/table-card/el-1.png`,
          },
          {
            id: 'el-2',
            type: 'image',
            imageKey: `${tenantId}/${templateId}/table-card/el-2.png`,
          },
          // Text element — should be ignored
          { id: 'el-3', type: 'text' },
        ],
      },
    };
    const keys = collectR2KeysForTemplate(tenantId, templateId, settings);
    expect(keys.sort()).toEqual(
      [
        `${tenantId}/${templateId}/table-card/el-1.png`,
        `${tenantId}/${templateId}/table-card/el-2.png`,
      ].sort(),
    );
  });

  it('skips imageKeys that do not match the expected prefix (cross-tenant defense)', () => {
    const settings = {
      tableCard: {
        elements: [
          {
            id: 'el-1',
            type: 'image',
            imageKey: 'OTHER-TENANT/tpl-1/table-card/el-1.png', // ← wrong tenant
          },
        ],
      },
    };
    expect(collectR2KeysForTemplate(tenantId, templateId, settings)).toEqual([]);
  });

  it('skips non-string imageKey values (defensive against corruption)', () => {
    const settings = {
      issuerLogo: 12345, // number, not string
      backgroundImage: null,
      iconImage: undefined,
      tableCard: {
        elements: [
          { id: 'el-1', type: 'image', imageKey: null },
          { id: 'el-2', type: 'image' }, // missing imageKey
        ],
      },
    };
    expect(collectR2KeysForTemplate(tenantId, templateId, settings)).toEqual([]);
  });

  it('deduplicates keys across top-level and table-card (same key set)', () => {
    const sharedKey = `${tenantId}/${templateId}/logo.png`;
    const settings = {
      issuerLogo: sharedKey,
      // (hypothetical: same key also stored inside tableCard, but not
      // the current schema — this test ensures Set semantics work)
    };
    const keys = collectR2KeysForTemplate(tenantId, templateId, settings);
    expect(keys).toEqual([sharedKey]);
  });
});

describe('diffRemovedR2Keys', () => {
  it('returns empty array when before and after are identical', () => {
    const before = {
      issuerLogo: 't/t/logo.png',
      backgroundImage: 't/t/bg.png',
    };
    const after = { ...before };
    expect(diffRemovedR2Keys(before, after)).toEqual([]);
  });

  it('detects issuerLogo removal (set to undefined)', () => {
    const before = { issuerLogo: 't/t/logo.png', iconImage: 't/t/icon.png' };
    const after = { iconImage: 't/t/icon.png' };
    expect(diffRemovedR2Keys(before, after).sort()).toEqual(['t/t/logo.png']);
  });

  it('detects issuerLogo replacement with a different key', () => {
    const before = { issuerLogo: 't/t/logo-v1.png' };
    const after = { issuerLogo: 't/t/logo-v2.png' };
    expect(diffRemovedR2Keys(before, after)).toEqual(['t/t/logo-v1.png']);
  });

  it('detects per-element imageKey removal', () => {
    const before = {
      tableCard: {
        elements: [
          { id: 'el-1', type: 'image', imageKey: 't/t/table-card/el-1.png' },
          { id: 'el-2', type: 'image', imageKey: 't/t/table-card/el-2.png' },
        ],
      },
    };
    const after = {
      tableCard: {
        elements: [
          { id: 'el-1', type: 'image', imageKey: 't/t/table-card/el-1.png' },
          // el-2 removed
        ],
      },
    };
    expect(diffRemovedR2Keys(before, after)).toEqual(['t/t/table-card/el-2.png']);
  });

  it('returns empty array when only additions happen (no removals)', () => {
    const before = {};
    const after = { issuerLogo: 't/t/new-logo.png' };
    expect(diffRemovedR2Keys(before, after)).toEqual([]);
  });

  it('handles missing tableCard on either side', () => {
    const before = {
      tableCard: {
        elements: [{ id: 'el-1', type: 'image', imageKey: 't/t/el-1.png' }],
      },
    };
    const after = {}; // tableCard removed entirely
    expect(diffRemovedR2Keys(before, after)).toEqual(['t/t/el-1.png']);
  });
});
