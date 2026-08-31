# Investigation: Icon preview broken image (Bug B)

**Date**: 2026-08-30
**Phase**: Plan CardBuilder-data-loss-and-icon-preview · Phase 2
**Status**: evidence collected (code), runtime evidence pending (DevTools)

## TL;DR

Code-level analysis shows no frontend or backend bug that would cause the
icon preview to be broken. The icon object is verifiably in R2, the
URL is correctly constructed, and the store state updates correctly
after upload. The remaining unknowns are runtime/browser-side and
require Chrome DevTools to diagnose.

## Evidence

### 1. R2 has icon object (Candidate #1 ELIMINATED)

```bash
$ npx wrangler r2 object get "saome/efb3fbbc.../2ca4b46c.../icon.png" \
    --file=/tmp/icon-check.bin --remote
Downloading "efb3fbbc.../2ca4b46c.../icon.png" from "saome".
Download complete.

$ ls -l /tmp/icon-check.bin /tmp/logo-check.bin
icon-check.bin   664997 bytes
logo-check.bin   851854 bytes
```

Both objects present at expected keys.

### 2. Frontend URL construction is correct (Candidate #5 ELIMINATED)

Added diagnostic test
`apps/frontend/src/components/business/dashboard/CardBuilderEditor/MediaAssetUploader/MediaAssetUploader.icon-preview.test.tsx`
which verifies after upload:

- `<img src>` matches `/api/cards/template-1/image/icon` ✓
- `<img src>` includes `v={number}` cache-busting ✓
- Store `iconImage` = `tenant-1/template-1/icon.png` ✓
- Store `iconImageVersion` = `Date.now()` (non-zero) ✓

2/2 tests pass.

### 3. Backend `getImage` route field map is correct

`apps/backend/src/modules/cards/routes/getImage.ts` line 47-51:

```ts
const fieldMap: Record<string, ImageKey> = {
  logo: 'issuerLogo',
  background: 'backgroundImage',
  icon: 'iconImage',
};
```

For URL `/image/icon`, reads `settings.iconImage`. ✓

### 4. Store update path is correct (Phase 1 fix already merged in)

`apps/frontend/src/.../MediaAssetUploader.tsx` line 285-288:

```ts
await cardService.update(templateId, {
  settings: { ...safeSettings, [config.settingsField]: key },
});
```

Before Phase 1 fix: this would REPLACE settings, wiping Step 2 fields.
After Phase 1 fix: MERGE with `settings = settings || $1::jsonb`,
preserves Step 2 fields.

The icon field (`config.settingsField = 'iconImage'`) is correctly
written.

## Remaining unknowns (require runtime evidence)

These cannot be verified without Chrome DevTools access from the user:

| # | Candidate | How to verify |
|---|---|---|
| 1 | Backend `getImage` returns 204 (R2 lookup miss) | DevTools Network tab: GET /image/icon → status 200 vs 204 |
| 2 | CORS preflight rejection | DevTools Network tab: OPTIONS /image/icon |
| 3 | Browser cache poisoning | DevTools Application → Storage → Clear site data → reload |
| 4 | Token missing in sessionStorage | DevTools Console: `sessionStorage.getItem('saome.accessToken')` |
| 5 | Mixed Content (HTTPS→HTTP fallback) | DevTools Console warnings |

## User action required

To proceed with Phase 3 fix, the user needs to run one Chrome DevTools
session and collect:

1. **Network tab screenshot** for `GET /api/cards/{id}/image/icon`:
   - Status code (200 / 204 / 401 / 404?)
   - Response headers (Content-Type, Content-Length, Cache-Control)
   - Response body size
2. **Console log** from `[MediaAssetUploader]` showing the `displayUrl`
   value at the moment of preview render.
3. **Application tab** check: does sessionStorage have `saome.accessToken`?

## Decision Gate (per Plan § Phase 2)

Root cause is NOT yet confirmed. Stop Phase 2 here and wait for user
DevTools evidence before proceeding to Phase 3 fix.

## Files touched in this investigation

- `apps/frontend/src/.../MediaAssetUploader/MediaAssetUploader.icon-preview.test.tsx` (new diagnostic test, kept as future regression test)
- No production code changed in Phase 2.

## Related

- Plan: `.cursor/plans/fix_cardbuilder_data_loss_+_icon_preview_6eb27ab7.plan.md`
- Phase 1 commit will include Bug #1 fix + this diagnostic test.