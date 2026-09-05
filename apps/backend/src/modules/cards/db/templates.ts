/**
 * Templates table queries.
 *
 * @module modules/cards/db/templates
 * @description Pure SQL functions for the `templates` table.
 */

import type { Sql } from '@/shared/db/client';

export interface TemplatesRow {
  id: string;
  tenant_id: string;
  status: 'draft' | 'published' | 'abandoned';
  name: string;
  /** Card type. NULL = user has not selected a type yet (orphan draft). */
  card_type?: CardType;
  settings: TemplateSettings;
  created_at: Date;
  updated_at: Date;
  /** Draft TTL: now() + 24h. NULL = published/never-expires. */
  expires_at?: Date;
}

/** Card types supported by the card builder */
export type CardType =
  | 'stamp_card'
  | 'cashback_card'
  | 'reward_card'
  | 'membership_card'
  | 'discount_card'
  | 'coupon_card'
  | 'multipass'
  | 'gift_card';

/**
 * Card face field keys (Step 3 — 顯示欄位).
 *
 * Mirrors `cardFieldKeySchema` in packages/shared/schemas/card.ts and
 * `CARD_FIELD_KEYS` in packages/shared/constants/card-fields.ts. This is
 * the DB-layer interface (Rule 019 § 4.1, layer 3 of 4) so service param
 * types and JSONB column contracts pick up the same value set.
 */
export type CardFieldKey =
  | 'phone'
  | 'email'
  | 'memberLevel'
  | 'birthday'
  | 'visitCount'
  | 'memberName';

/**
 * Template settings — flat JSONB structure.
 *
 * Step 1: name, cardType
 * Step 2: barcodeType, storeName, issuerName, passValidDays, expiryDate, currency
 * Membership extension: isPaid
 * Step 3-4: TBD (backgroundColor, textColor, etc.)
 */
export interface TemplateSettings {
  name?: string;
  cardType?: CardType;
  barcodeType?: 'qr_code' | 'pdf_417';
  storeName?: string;
  issuerName?: string;
  passValidDays?: number | null;
  expiryDate?: string;
  currency?: 'TWD' | 'ZAR';
  // Step 3-4 fields (TBD)
  issuerLogo?: string;
  /**
   * Push-notification icon (R2 key) — mirrors shared templateSettingsSchema.iconImage.
   * Phase 5 of IconUploader plan (2026-08-31).
   */
  iconImage?: string;
  /**
   * Background image (R2 key) — reserved for next BackgroundUploader plan.
   * Mirrors shared templateSettingsSchema.backgroundImage.
   */
  backgroundImage?: string;
  backgroundColor?: string;
  textColor?: string;
  holderName?: string;
  cardSide?: 'front' | 'back';
  /**
   * Step 3 — 顯示欄位: left-slot display field key.
   * Rule 019 § 4.1 layer 3 of 4 — keep in sync with shared `templateSettingsSchema.leftField`.
   */
  leftField?: CardFieldKey;
  /**
   * Step 3 — 顯示欄位: right-slot display field key.
   * Rule 019 § 4.1 layer 3 of 4 — keep in sync with shared `templateSettingsSchema.rightField`.
   */
  rightField?: CardFieldKey;
  // Membership card extension
  isPaid?: boolean;
  /**
   * Step 3 — Stamp grid: number of rows in the stamp grid (1..4).
   * Mirrors `shared/templateSettingsSchema.stampGridRows` (Rule 019 § 4.1 layer 3 of 4).
   * Used on stamp_card and multipass card types.
   */
  stampGridRows?: 1 | 2 | 3 | 4;
  /**
   * Step 3 — Stamp grid: icon manifest id (e.g. 'bell', 'fire').
   * Mirrors `shared/templateSettingsSchema.stampIconId` (Rule 019 § 4.1 layer 3 of 4).
   */
  stampIconId?: string;
  // ===== Step 4 — 卡片資訊 (Rule 019 § 4.1, layer 3 of 4) =====
  // Mirrors `shared/templateSettingsSchema.description / backFields / links`.
  // Step 4 plan 2026-09-04: see packages/shared/schemas/card.ts for source.
  /**
   * Card description (PassCardPreviewBack Section 1). Max 200 chars per
   * shared schema.
   */
  description?: string;
  /**
   * Back fields shown as label/value rows (PassCardPreviewBack Section 4).
   * PassKit convention is one Label + Value per row.
   */
  backFields?: Array<{ label: string; value: string }>;
  /**
   * Dedicated link fields (PassCardPreviewBack Section 5). PassKit separates
   * `links` from `backFields` — they render in distinct UI areas. URL
   * validation lives in shared/logic/links.ts (UI-layer).
   */
  links?: Array<{ label: string; value: string }>;
  // ===== Step 5 — 地理位置 + 推播訊息 (Rule 019 § 4.1, layer 3 of 4) =====
  // Mirrors `shared/templateSettingsSchema.initialMessage / locations`.
  // Step 5 plan 2026-09-05: see packages/shared/schemas/card.ts for source.
  /**
   * Push-notification body shown after the user downloads the pass
   * (Passcreator "Initial message"). Max 50 chars per INITIAL_MESSAGE_MAX_LENGTH.
   */
  initialMessage?: string;
  /**
   * Geolocation toggle (Passcreator API field). When `true` the pass
   * does NOT trigger geolocation-based notifications; Step 5 in the
   * CardBuilder editor can be skipped. Default `false` (geolocation
   * enabled). Added 2026-09-06.
   */
  locationsDisabled?: boolean;
  /**
   * Geolocation triggers for the pass. Each entry maps to one Apple Wallet
   * pkpass `relevantLocations` row (Passcreator API-aligned). Capped at 10
   * (LOCATIONS_MAX). Per-row shape (2026-09-06 refactor):
   *   - `name` (user-facing label)
   *   - `latitude` / `longitude` (REQUIRED — previously optional)
   *   - `relevantText` (optional lock-screen message; ≤ 100 chars)
   */
  locations?: Array<{
    name: string;
    latitude: number;
    longitude: number;
    relevantText?: string | null;
  }>;
  // ===== Step 5 — Locations max distance (Rule 019 § 4.1, layer 3 of 4) =====
  // Mirrors `shared/templateSettingsSchema.locationsMaxDistance`.
  // Step 5 plan 2026-09-06 rename: was `notificationRadius`; renamed to
  // align with the Passcreator API field name.
  /**
   * Locations max distance in meters — pass-level setting (Passcreator
   * `locationsMaxDistance`). Bounded to [100, 1000] per Apple Wallet /
   * PassKit spec. `null` (= field absent) signals PassKit to use the
   * pass-type default (event/boarding → up to 1000 m; coupon/store/
   * membership → up to 100 m). User-explicit values are stored as
   * integers.
   */
  locationsMaxDistance?: number | null;
  // DEPRECATED 2026-09-06: kept for backward-compat reads from DB rows
  // that pre-date Migration 017 (rename notificationRadius → locationsMaxDistance).
  // Frontend no longer writes this key. New writes use `locationsMaxDistance`.
  notificationRadius?: number | null;
  [key: string]: unknown;
}

/** Input for creating a new template */
export interface CreateTemplateInput {
  /** UUID. If omitted, the DB generates one via gen_random_uuid(). */
  id?: string;
  tenantId: string;
  name?: string;
  /** Card type. NULL = user has not selected a type yet. */
  cardType?: CardType;
  settings?: Partial<TemplateSettings>;
}

/** Input for updating a template */
export interface UpdateTemplateInput {
  name?: string;
  cardType?: CardType;
  settings?: Partial<TemplateSettings>;
  status?: 'draft' | 'published' | 'abandoned';
}

/**
 * Insert a new template row.
 * UUID is generated by the DB via DEFAULT gen_random_uuid().
 * expires_at is auto-set to now() + 24h (draft TTL).
 */
export async function insertTemplate(
  sql: Sql,
  input: CreateTemplateInput,
): Promise<TemplatesRow> {
  const settingsToInsert = (input.settings ?? {}) as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = await (sql<TemplatesRow[]>`
    INSERT INTO templates (
      id,
      tenant_id,
      name,
      card_type,
      settings
    ) VALUES (
      ${input.id ?? sql`gen_random_uuid()`},
      ${input.tenantId},
      ${input.name ?? '未命名卡片'},
      ${input.cardType ?? null},
      ${sql.json(settingsToInsert)}
    )
    RETURNING id, tenant_id, status, name, card_type, settings, created_at, updated_at, expires_at
  ` as any);
  if (!rows[0]) {
    throw new Error('insertTemplate returned no rows');
  }
  return rows[0];
}

/**
 * Find a template by ID.
 * Returns undefined if not found.
 */
export async function findTemplateById(
  sql: Sql,
  id: string,
): Promise<TemplatesRow | undefined> {
  const rows = await sql<TemplatesRow[]>`
    SELECT id, tenant_id, status, name, card_type, settings, created_at, updated_at, expires_at
      FROM templates
     WHERE id = ${id}
     LIMIT 1
  `;
  return rows[0];
}

/**
 * Find all templates belonging to a tenant.
 * Ordered by updated_at DESC (most recent first).
 */
export async function findTemplatesByTenantId(
  sql: Sql,
  tenantId: string,
): Promise<TemplatesRow[]> {
  const rows = await sql<TemplatesRow[]>`
    SELECT id, tenant_id, status, name, card_type, settings, created_at, updated_at, expires_at
      FROM templates
     WHERE tenant_id = ${tenantId}
     ORDER BY updated_at DESC
  `;
  return rows;
}

/**
 * Update a template by ID.
 * Only updates fields that are explicitly provided.
 * When status is set to 'published', expires_at is automatically cleared.
 *
 * IMPORTANT: settings fields are MERGED with existing settings using JSONB's || operator
 * (PostgreSQL JSONB concatenation). This preserves existing fields that are not being
 * updated (e.g., Step 2 only updates storeName/issuerName without wiping Step 1's
 * cardType, and Step 3 only updates issuerLogo/iconImage without wiping Step 2 fields).
 *
 * Implementation note: postgres.js's tagged template injection handles the JSON string
 * safely — the right operand of || is interpolated via `${}` as a parameter, never
 * concatenated into the SQL string directly.
 *
 * Defensive unwrap of corrupted JSONB (Bug #8 + Bug #8.5 / 2026-08-31):
 * The existing `settings` column may have been corrupted by the previous REPLACE
 * bug into one of:
 *   - jsonb ARRAY of partial JSON strings (each push appended a step's payload)
 *     → NESTED unwrap: if `settings -> -1` is itself a jsonb string, parse with
 *       `((settings -> -1) #>> '{}')::jsonb`; if object, passthrough; else `'{}'`
 *       (Bug #8.5: the array tail is usually a string, NOT an object — naive
 *       `settings -> -1` returns a string and `string || object` re-corrupts)
 *   - jsonb STRING of partial JSON (legacy corruption)
 *     → unwrap with `(settings #>> '{}')::jsonb`
 *   - jsonb OBJECT (normal case)
 *     → passthrough
 * Without this defensive CASE WHEN, `corrupted_settings || new_payload` would
 * either grow the array (still corrupting) or yield a non-object type.
 */
export async function updateTemplate(
  sql: Sql,
  id: string,
  input: UpdateTemplateInput,
): Promise<TemplatesRow> {
  // Build dynamic SET clauses using tagged template injection to avoid $N collisions.
  // The id is always passed as ${id} — not as a $N positional placeholder.
  // settings is MERGED with existing settings (not replaced) so partial updates
  // never wipe unrelated fields.

  // Early return if nothing to update
  if (
    input.name === undefined &&
    input.cardType === undefined &&
    input.settings === undefined &&
    input.status === undefined
  ) {
    const existing = await findTemplateById(sql, id);
    if (!existing) {
      throw new Error('updateTemplate: template not found');
    }
    return existing;
  }

  // Build individual SET clauses via tagged template injection
  const setName = input.name !== undefined ? sql`name = ${input.name}` : null;
  const setCardType = input.cardType !== undefined ? sql`card_type = ${input.cardType}` : null;
  // Defensive unwrap: tolerate array/string corruptions in the existing settings column
  // (Bug #8 + Bug #8.5) so that `||` always sees a true jsonb object on the left side.
  // Bug #8.5 fix: WHEN 'array' branch must NESTED-unwrap the last element because
  //   legacy corruption stored `JSON.stringify(obj)` inside the array, so `settings -> -1`
  //   returns a jsonb **string**, not an object. Naive `string || object` would re-corrupt.
  const setSettings = input.settings !== undefined
    ? sql`settings = CASE jsonb_typeof(settings)
                WHEN 'object' THEN settings
                WHEN 'array'  THEN (
                  CASE jsonb_typeof(settings -> -1)
                    WHEN 'string' THEN ((settings -> -1) #>> '{}')::jsonb
                    WHEN 'object' THEN (settings -> -1)
                    ELSE '{}'::jsonb
                  END
                )
                WHEN 'string' THEN (settings #>> '{}')::jsonb
                ELSE settings
              END || ${sql.json(input.settings as any)}`
    : null;
  const setStatus = input.status !== undefined ? sql`status = ${input.status}` : null;

  // Filter out nulls and join with commas
  const clauses = [setName, setCardType, setSettings, setStatus].filter(
    (c): c is NonNullable<typeof c> => c !== null,
  );

  const rows = await sql<TemplatesRow[]>`
    UPDATE templates
       SET ${clauses[0]}
       ${clauses.length > 1 ? sql`, ${clauses[1]}` : sql``}
       ${clauses.length > 2 ? sql`, ${clauses[2]}` : sql``}
       ${clauses.length > 3 ? sql`, ${clauses[3]}` : sql``}
     WHERE id = ${id}
    RETURNING id, tenant_id, status, name, card_type, settings, created_at, updated_at, expires_at
  `;

  if (!rows[0]) {
    throw new Error('updateTemplate: template not found');
  }
  return rows[0];
}

/**
 * Touch a draft template — reset its expires_at to now() + 24h to keep it alive.
 * No-op for published/abandoned templates.
 */
export async function touchExpiresAt(
  sql: Sql,
  id: string,
): Promise<TemplatesRow> {
  const rows = await sql<TemplatesRow[]>`
    UPDATE templates
       SET expires_at = now() + interval '24 hours'
     WHERE id = ${id}
       AND status = 'draft'
    RETURNING id, tenant_id, status, name, card_type, settings, created_at, updated_at, expires_at
  `;
  if (!rows[0]) {
    throw new Error('touchExpiresAt: template not found');
  }
  return rows[0];
}

/**
 * Find the most recent draft template for a tenant.
 * Used when user clicks "從頭建置" to check if a resume-worthy draft exists.
 * Excludes abandoned drafts.
 */
export async function findLatestDraftByTenant(
  sql: Sql,
  tenantId: string,
): Promise<TemplatesRow | null> {
  const rows = await sql<TemplatesRow[]>`
    SELECT id, tenant_id, status, name, card_type, settings, created_at, updated_at, expires_at
      FROM templates
     WHERE tenant_id = ${tenantId}
       AND status = 'draft'
     ORDER BY updated_at DESC
     LIMIT 1
  `;
  return rows[0] ?? null;
}

/**
 * Delete a template by ID.
 */
export async function deleteTemplate(sql: Sql, id: string): Promise<void> {
  await sql`DELETE FROM templates WHERE id = ${id}`;
}
