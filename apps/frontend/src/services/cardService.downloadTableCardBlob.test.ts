/**
 * cardService — Step 7 downloadTableCardBlob test (Round 2 fix, 2026-09-27).
 *
 * Critical invariant under test:
 *   - `downloadTableCardBlob(templateId)` calls `httpClient.getBlob`
 *     (which attaches Bearer auth + retries on 5xx + refresh on 401).
 *   - It does NOT return a URL string (the previous `downloadTableCardUrl`
 *     was used with `window.open`, which silently 401'd in production).
 *   - Path includes `table-card/download` and the templateId.
 *
 * Run: `npm test -- cardService.downloadTableCard`
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { httpClient } from './httpClient';
import { cardService } from './cardService';

describe('cardService.downloadTableCardBlob — Round 2 fix', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a Blob from httpClient.getBlob (not a URL string)', async () => {
    const fakeBlob = new Blob(['png-bytes'], { type: 'image/png' });
    const getBlobSpy = vi
      .spyOn(httpClient, 'getBlob')
      .mockResolvedValueOnce(fakeBlob);

    const result = await cardService.downloadTableCardBlob('tpl-uuid-1');

    expect(result).toBe(fakeBlob);
    expect(result).toBeInstanceOf(Blob);
    expect(getBlobSpy).toHaveBeenCalledTimes(1);
  });

  it('calls /api/cards/:templateId/table-card/download with correct URL', async () => {
    const getBlobSpy = vi
      .spyOn(httpClient, 'getBlob')
      .mockResolvedValueOnce(new Blob(['x'], { type: 'image/png' }));

    await cardService.downloadTableCardBlob('tpl-abc-123');

    const calledPath = getBlobSpy.mock.calls[0][0];
    expect(calledPath).toBe('/api/cards/tpl-abc-123/table-card/download');
  });
});
