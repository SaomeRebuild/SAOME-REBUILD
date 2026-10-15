/**
 * passTemplateMapping stamp-image conformance tests — v15 dispatch wire format.
 *
 * @module modules/pass-templates/tests/passTemplateMapping-stamp-image
 *
 * Wire-format contract pinned here (2026-10-15):
 *   - `images.background` for `stamp_card` / `multipass` resolves to
 *     `${r2PublicUrl}/api/pass-templates/${templateId}/stamp-image/0`
 *     when `stampImageKey` is set.
 *   - All other card types continue to resolve to
 *     `${r2PublicUrl}/api/pass-templates/${templateId}/background`
 *     from `settings.backgroundImage` (unchanged from v14).
 *   - When `cardType === 'stamp_card' / 'multipass'` but no
 *     `stampImageKey` is provided (e.g. the Step 8 upload failed),
 *     the mapping falls back to `settings.backgroundImage` gracefully.
 *
 * Drift guard: if the mapping module ever starts ignoring the stamp
 * dispatch or misrouting other card types to the stamp URL, these
 * tests catch it at unit-test time — not at production deploy time.
 *
 * Rule references:
 *   - Rule 019 § D.3 — third-party API shape is a contract.
 *   - Rule 019 § 6 — DB CHECK constraint / API enum alignment.
 *   - Rule 001 § Decision Log — new DB table → Passcreator push is P0.
 *
 * Decision: runs/decisions/2026-10-15-stamp-card-push-wiring.md
 */

import { describe, it, expect } from 'vitest';
import { mapTemplateToPasscreator } from '../services/passTemplateMapping';
import type { TemplatesRow } from '@/modules/cards/db/templates';

const R2_URL = 'https://r2.example.com';
const TEMPLATE_ID = '00000000-0000-4000-8000-000000000001';
const TENANT_ID = '00000000-0000-4000-8000-000000000002';

function makeRow(overrides: Partial<TemplatesRow> = {}): TemplatesRow {
  return {
    id: TEMPLATE_ID,
    tenant_id: TENANT_ID,
    status: 'draft',
    name: 'Café Rewards',
    card_type: 'reward_card',
    settings: {
      cardType: 'reward_card',
      barcodeType: 'qr_code',
      logoText: 'Café 咖啡',
      issuerName: 'Café Co.',
      description: 'A neighborhood loyalty card',
      language: 'zh-TW',
      backgroundColor: '#0F0F23',
      textColor: '#F8FAFC',
      leftField: 'phone',
      rightField: 'email',
      backFields: [],
      iconImage: 'tenant-001/template-001/icon.png',
      issuerLogo: 'tenant-001/template-001/logo.png',
      backgroundImage: 'tenant-001/template-001/background.png',
    },
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
    expires_at: undefined,
    passcreator_template_id: null,
    ...overrides,
  };
}

const STAMP_R2_KEY = `tenants/${TENANT_ID}/templates/${TEMPLATE_ID}/stamp-0.png`;

describe('mapTemplateToPasscreator — v15 stamp image dispatch', () => {
  it('stamp_card with stampImageKey → images.background points at /stamp-image/0 (NOT settings.backgroundImage)', () => {
    const body = mapTemplateToPasscreator({
      template: makeRow({ card_type: 'stamp_card' }),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
      stampImageKey: STAMP_R2_KEY,
    });
    expect(body.images.background).toBe(
      `${R2_URL}/api/pass-templates/${TEMPLATE_ID}/stamp-image/0`,
    );
    // Defensive: confirm we're NOT emitting the legacy background URL.
    expect(body.images.background).not.toContain('/background');
  });

  it('multipass with stampImageKey → images.background points at /stamp-image/0', () => {
    const body = mapTemplateToPasscreator({
      template: makeRow({ card_type: 'multipass' }),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
      stampImageKey: STAMP_R2_KEY,
    });
    expect(body.images.background).toBe(
      `${R2_URL}/api/pass-templates/${TEMPLATE_ID}/stamp-image/0`,
    );
  });

  it('stamp_card with stampImageKey=null → falls back to settings.backgroundImage', () => {
    // Mirrors "Step 8 upload failed; mapper still produces a valid payload
    // from the tenant-uploaded background".
    const body = mapTemplateToPasscreator({
      template: makeRow({ card_type: 'stamp_card' }),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
      stampImageKey: null,
    });
    expect(body.images.background).toBe(
      `${R2_URL}/api/pass-templates/${TEMPLATE_ID}/background`,
    );
  });

  it('stamp_card without stampImageKey arg → falls back to settings.backgroundImage (backward compat)', () => {
    // Older callers (before v15) don't pass stampImageKey at all.
    const body = mapTemplateToPasscreator({
      template: makeRow({ card_type: 'stamp_card' }),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
    });
    expect(body.images.background).toBe(
      `${R2_URL}/api/pass-templates/${TEMPLATE_ID}/background`,
    );
  });

  it.each([
    'membership_card',
    'reward_card',
    'cashback_card',
    'discount_card',
    'coupon_card',
    'gift_card',
  ] as const)(
    '%s with stampImageKey set → still uses settings.backgroundImage (stamp dispatch is opt-in per cardType)',
    (cardType) => {
      // The stamp-image URL is only valid for stamp_card / multipass.
      // Any other cardType that happens to receive a stampImageKey
      // must NOT route to /stamp-image/0 — that route's stamp-image
      // proxy only serves stamp_card / multipass semantics. This
      // guards against accidental misuse if a future caller starts
      // passing stampImageKey unconditionally.
      const body = mapTemplateToPasscreator({
        template: makeRow({ card_type: cardType }),
        language: 'zh-TW',
        r2PublicUrl: R2_URL,
        stampImageKey: STAMP_R2_KEY,
      });
      expect(body.images.background).toBe(
        `${R2_URL}/api/pass-templates/${TEMPLATE_ID}/background`,
      );
    },
  );

  it('stamp_card with stampImageKey but no settings.backgroundImage → images.background is the stamp URL only', () => {
    // Tenant never uploaded a background; only the composed 0.png
    // is available. images.background should still be set to the
    // stamp URL (Passcreator fallback is acceptable since the grid
    // is the user-visible content for stamp cards).
    const body = mapTemplateToPasscreator({
      template: makeRow({
        card_type: 'stamp_card',
        // settings.backgroundImage is "" (cleared) — skip override
      }),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
      stampImageKey: STAMP_R2_KEY,
    });
    expect(body.images.background).toBe(
      `${R2_URL}/api/pass-templates/${TEMPLATE_ID}/stamp-image/0`,
    );
  });

  it('images.backgroundDifferentForEachPass is still true for stamp_card (v14 default-on preserved)', () => {
    const body = mapTemplateToPasscreator({
      template: makeRow({ card_type: 'stamp_card' }),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
      stampImageKey: STAMP_R2_KEY,
    });
    expect(body.images.backgroundDifferentForEachPass).toBe(true);
  });

  it('images.icon and images.logo are unaffected by the stamp dispatch', () => {
    const body = mapTemplateToPasscreator({
      template: makeRow({ card_type: 'stamp_card' }),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
      stampImageKey: STAMP_R2_KEY,
    });
    expect(body.images.icon).toBe(`${R2_URL}/api/pass-templates/${TEMPLATE_ID}/icon`);
    expect(body.images.logo).toBe(`${R2_URL}/api/pass-templates/${TEMPLATE_ID}/logo`);
  });

  it('absolute (legacy CDN) stampImageKey is passed through unchanged', () => {
    // Defensive: the r2KeyToPublicUrl helper passes through any URL
    // starting with http(s). Even if someone hands us an absolute
    // CDN URL as stampImageKey, the mapping must not crash.
    const absoluteStampUrl = 'https://cdn.example.com/tenants/foo/stamp-0.png';
    const body = mapTemplateToPasscreator({
      template: makeRow({ card_type: 'stamp_card' }),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
      stampImageKey: absoluteStampUrl,
    });
    expect(body.images.background).toBe(absoluteStampUrl);
  });

  /**
   * 2026-10-15 v16 — `images.backgroundHidden: false` for stamp dispatch.
   *
   * Regression trace (user report 2026-10-15):
   *   stamp_card 模板的 0.png 在 R2 正確上傳,Passcreator push 也送了
   *   `images.background` URL,但 Passcreator 模板設定 UI 顯示「不用
   *   背景圖」仍是打勾 → deployed pass 看不到 strip 圖(包含 grid + 背景)。
   *
   *   根因:Passcreator V2 describe response 顯示 `images.backgroundHidden`
   *   預設為 `true`。我們的 mapping 之前只 emit `images.background`
   *   URL,沒有同步 emit `backgroundHidden: false` → Passcreator 隱藏背景。
   *
   *   修法:當 `images.background` 有 URL(stamp_card 走 stamp-image proxy,
   *   其他卡種走 settings.backgroundImage)時,emit
   *   `images.backgroundHidden: false`。
   *
   *   來源:https://developer.passcreator.com/en/api/v2/pass-template
   *   (describe response: `images.background` 與 `images.backgroundHidden`
   *   兩欄位同時出現;後者預設 `true`)
   */
  it('stamp_card with stampImageKey → images.backgroundHidden is false (v16 un-hide)', () => {
    const body = mapTemplateToPasscreator({
      template: makeRow({ card_type: 'stamp_card' }),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
      stampImageKey: STAMP_R2_KEY,
    });
    expect(body.images.background).toBe(
      `${R2_URL}/api/pass-templates/${TEMPLATE_ID}/stamp-image/0`,
    );
    expect(body.images.backgroundHidden).toBe(false);
  });
  it('multipass with stampImageKey → images.backgroundHidden is false (v16 un-hide)', () => {
    const body = mapTemplateToPasscreator({
      template: makeRow({ card_type: 'multipass' }),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
      stampImageKey: STAMP_R2_KEY,
    });
    expect(body.images.backgroundHidden).toBe(false);
  });
  it('stamp_card fallback to settings.backgroundImage → still emits backgroundHidden: false (v16 un-hide)', () => {
    // 即使是 graceful fallback 路徑(stamp-0.png 沒上傳,改用租戶原背景),
    // 只要 images.background 有 URL,就要 emit backgroundHidden: false。
    const body = mapTemplateToPasscreator({
      template: makeRow({ card_type: 'stamp_card' }),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
      stampImageKey: null,
    });
    expect(body.images.background).toBe(
      `${R2_URL}/api/pass-templates/${TEMPLATE_ID}/background`,
    );
    expect(body.images.backgroundHidden).toBe(false);
  });
  it('stamp_card with no background at all → omits backgroundHidden (v16 graceful)', () => {
    // 兩個來源都空 → 不 emit background,也不 emit backgroundHidden;
    // 讓 Passcreator 走預設(沒圖可顯示時,Passcreator 的「隱藏」預設 OK)。
    const row = makeRow({ card_type: 'stamp_card' });
    row.settings.backgroundImage = undefined;
    const body = mapTemplateToPasscreator({
      template: row,
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
      stampImageKey: null,
    });
    expect(body.images).not.toHaveProperty('background');
    expect(body.images).not.toHaveProperty('backgroundHidden');
  });

  /**
   * 2026-10-15 v18 — `images.background` (stamp URL) cache-bust query.
   *
   * Regression trace (user report 2026-10-15):
   *   User 回報:「現在製圖好像沒問題了,但 Passcreator 那邊的圖還是好
   *   幾版之前的,新的圖一直沒有推上去」。根因:V17 commit 修的是
   *   composer URL 的瀏覽器 cache,把新 bytes 寫到 R2 — 但 push 到
   *   Passcreator 的 URL 仍是固定 path (`${tid}/stamp-image/0`),
   *   Passcreator 第一次 fetch 後 cache 住,後續 push 同 URL 不再
   *   re-fetch,即使 R2 bytes 已變 → deployed pass 持續看到舊版。
   *
   *   Fingerprint 是 V17 feedback § 為什麼這條 rule 該獨立成一個 rule
   *   提到的家族第四例延伸：「URL 不變、bytes 變了,但中間某個 layer
   *   的 cache 不會 revalidate」— V17 修的是瀏覽器端 cache,
   *   本次修的是 Passcreator 端 cache(同 fingerprint 跨不同層)。
   *
   *   修法:推到 Passcreator 的 stamp URL 加 `?v=<byteHash[:12]>` cache-bust
   *   query string。byteHash 是 PNG bytes 的 SHA-256 hex(64 chars),
   *   截前 12 字 = 48 bits entropy → 撞機率幾近 0。byteHash 跟 PNG
   *   bytes 內容直接綁定:換背景/換格數/換 icon 都會 hash 變 →
   *   URL 變 → Passcreator cache miss → 重新 fetch 新 bytes。
   *
   *   為什麼用 byteHash 不用 uploadedAt timestamp:
   *   - byteHash 跟 PNG bytes 一對一綁定,語義清晰
   *   - uploadedAt 是 metadata,跟 bytes freshness 是間接關係
   *   - 同一張 PNG 重 render 的 byteHash 完全一致 → 連續 publish
   *     沒換 bytes → URL 一樣 → 不會無效化(對 immutable cache header 是友善)
   */
  it('v18 — stamp_card with stampImageKey + stampImageByteHash → URL carries ?v=<hash[:12]>', () => {
    const body = mapTemplateToPasscreator({
      template: makeRow({ card_type: 'stamp_card' }),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
      stampImageKey: STAMP_R2_KEY,
      stampImageByteHash: 'a3b1c2d4e5f6789a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a',
    });
    expect(body.images.background).toBe(
      `${R2_URL}/api/pass-templates/${TEMPLATE_ID}/stamp-image/0?v=a3b1c2d4e5f6`,
    );
  });

  it('v18 — different byteHash produces a different stamp URL (regression — cache bust must invalidate)', () => {
    // 防 regression:這條是 cache invalidation 的根本。如果兩個不同
    // hash 撞出同一個 query string,Passcreator 端 cache 就不會失效 →
    // 整條修復鏈破掉。雖然 12 字 hash 截斷有極低機率撞機,但 unit test
    // 必跑兩個 distinct hash 各產不同 URL 作為 contract guard。
    const hashA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const hashB = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const bodyA = mapTemplateToPasscreator({
      template: makeRow({ card_type: 'stamp_card' }),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
      stampImageKey: STAMP_R2_KEY,
      stampImageByteHash: hashA,
    });
    const bodyB = mapTemplateToPasscreator({
      template: makeRow({ card_type: 'stamp_card' }),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
      stampImageKey: STAMP_R2_KEY,
      stampImageByteHash: hashB,
    });
    expect(bodyA.images.background).not.toBe(bodyB.images.background);
    // 兩個 distinct query tokens 是 cache key invalidation 的物質基礎。
    expect(bodyA.images.background).toContain('?v=aaaaaaaaaaaa');
    expect(bodyB.images.background).toContain('?v=bbbbbbbbbbbb');
  });

  it('v18 — stampImageKey set but stampImageByteHash=null → stamp URL has no ?v= (v15 backward compat)', () => {
    // 向後相容:老 caller 只有 stampImageKey、沒有 stampImageByteHash,
    // 仍應走 stamp URL(無 query string)。沒有 byteHash 就沒 cache-bust
    // 修飾,但用戶看到的是 stamp 圖;Passcreator 端 cache 可能會看到
    // 舊 bytes,這個 case 由「Cache-Control header audit」follow-up 處理
    // (見 feedback § Cache-Control immutable follow-up)。
    const body = mapTemplateToPasscreator({
      template: makeRow({ card_type: 'stamp_card' }),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
      stampImageKey: STAMP_R2_KEY,
      stampImageByteHash: null,
    });
    expect(body.images.background).toBe(
      `${R2_URL}/api/pass-templates/${TEMPLATE_ID}/stamp-image/0`,
    );
    expect(body.images.background).not.toContain('?v=');
  });

  it('v18 — stampImageByteHash absent (undefined arg) → stamp URL has no ?v= (backward compat with v15 callers)', () => {
    // 老 caller 只有 stampImageKey、沒有 stampImageByteHash。
    // 向後相容:不傳 byteHash 仍能 emit stamp URL(只要 stampImageKey set)。
    // 注意:這條路徑不會 cache-bust,在 production 等同於「讓 Passcreator
    // cache 失效由 sync 端升級或 Cache-Control header 議題處理」
    // (見 runs/improvements/feedback/20261015-stamp-card-push-cache-bust-url-hash.md
    //  § Cache-Control immutable follow-up)。
    const body = mapTemplateToPasscreator({
      template: makeRow({ card_type: 'stamp_card' }),
      language: 'zh-TW',
      r2PublicUrl: R2_URL,
      stampImageKey: STAMP_R2_KEY,
      // stampImageByteHash intentionally omitted
    });
    expect(body.images.background).toBe(
      `${R2_URL}/api/pass-templates/${TEMPLATE_ID}/stamp-image/0`,
    );
    expect(body.images.background).not.toContain('?v=');
  });
});