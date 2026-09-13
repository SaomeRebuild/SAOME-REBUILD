/**
 * CardBuilderEditor — 卡片建置器編輯器主組件
 *
 * 佈局結構：
 * - 上容器：CardBuilderEditorHeader（導航列）
 * - 下容器：左右欄位
 *   - 左：CardBuilderEditorWorkspace（操作區）
 *   - 右：CardBuilderEditorPreview（即時預覽區）— Desktop only
 * - Mobile: CardBuilderEditorPreview 改由 MobilePreviewPanel 提供（Bottom Sheet）
 *
 * 資料流：
 * - 新建模式（無 ?id= URL）：store 為初始狀態
 * - 編輯模式（有 ?id= URL）：mount 時從 API 取得既有的 settings 並載入 store
 * - URL 追蹤：自己監聽 window.location（而非靠父層 prop），這樣 pushState /
 *   navigate 更新 URL 時能即時感應到並 fetch
 */

import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { CardBuilderEditorProps, EditorStep } from './CardBuilderEditor.types';
import { CardBuilderEditorHeader } from './CardBuilderEditorHeader';
import { CardBuilderEditorWorkspace } from './CardBuilderEditorWorkspace';
import { CardBuilderEditorPreview } from './CardBuilderEditorPreview';
import { MobilePreviewPanel } from './MobilePreviewPanel';
import { useCardBuilderStore } from './CardBuilderEditor.store';
import { useAuth } from '@/hooks/useAuth';
import { cardService } from '@/services/cardService';

export function CardBuilderEditor({
  onSave: _onSave,
  onBack: _onBack,
}: CardBuilderEditorProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [searchParams] = useSearchParams();

  // 使用 store 管理卡片編輯器狀態
  const {
    cardName,
    logoText,
    cardId,
    cardType,
    step,
    completedSteps,
    cardSide,
    setCardName,
    setLogoText,
    setStep,
    setCompletedStep,
    setCardSide,
    setCardId,
    setCardType,
    setIssuerName,
    loadSettings,
    reset,
  } = useCardBuilderStore();

  // Auth state — used to pre-fill issuerName from tenant.name
  const { state: authState } = useAuth();

  // 從 URL 讀取 templateId（自己監聽 URL，而非靠父層 prop）
  // 這樣 pushState / navigate 更新 URL 時能即時觸發 fetch
  const templateId = searchParams.get('id');

  // 初始化：根據 URL（新建或編輯）載入資料
  useEffect(() => {
    if (templateId) {
      // 編輯模式：reset 舊的 stale 資料，再 fetch 既有的 template settings
      reset();
      setCardId(templateId);
      setIsLoading(true);
      cardService.getById(templateId)
        .then((template) => {
          loadSettings(template.settings);
          // 修 3 (2026-09-05): mark the Step 4 autosave effect as settled
          // — loadSettings has just hydrated the store, so any subsequent
          // snapshot diff is a real user edit (or a hydration-induced
          // re-render, but both are fine to persist). Without this, edits
          // BEFORE loadSettings completes would race against the fetch
          // and clobber DB with partial data.
          step4LoadSettledRef.current = true;
          // Step 5 (2026-09-05) shares the same outer-fetch timeline as
          // Step 4 — one loadSettings hydrates both. Flip the settled
          // flag for Step 5 at the same time.
          step5LoadSettledRef.current = true;
          // 2026-09-13 fix (current task): isPaid autosave uses a
          // post-load snapshot ref (`isPaidAfterLoadRef`) — read it here
          // RIGHT AFTER loadSettings so the effect's "post-load baseline"
          // reflects the hydrated DB value, not the user's pre-loadSettings
          // accidental toggle. (Refs are not reactive, so the effect won't
          // naturally re-run between mount and user toggle if isPaid
          // didn't change reference; capturing here bridges that gap.)
          isPaidAfterLoadRef.current = useCardBuilderStore.getState().isPaid;
          // cardType 存在 DB card_type 欄位（不在 settings JSONB），需要獨立設定
          if (template.cardType) {
            setCardType(template.cardType);
          }
          // 2026-09-13 swap: `templates.name` (SQL column) now holds the
          // Card Name (pass record name). Load via `setCardName`.
          if (template.name) {
            setCardName(template.name);
          }
          // issuerName：若 template 沒有值，用 tenant.name 預填
          if (!template.settings.issuerName && authState.tenant?.name) {
            setIssuerName(authState.tenant.name);
          }
        })
        .catch((err) => {
          console.error('Failed to load template:', err);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      // 新建模式：reset store 並直接用 tenant.name 預填 issuerName
      reset();
      setCardId(null);
      if (authState.tenant?.name) {
        setIssuerName(authState.tenant.name);
      }
      setIsLoading(false);
    }
  }, [templateId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ============================================================
  // Auto-save: Logo Text changes → debounced PUT /cards/:id
  //
  // 2026-09-13 semantic swap: the Header input now binds to Logo Text
  // (pass header text shown next to issuer logo), NOT to the SQL
  // column `templates.name`. The autosave target is therefore
  // `settings.logoText` (JSONB key), NOT top-level `name`.
  //
  // Card Name autosave: handled by Step 2 onNext (save payload now
  // includes `name: cardName` at top-level → SQL column `templates.name`).
  // Since users edit Card Name via the Step 2 CardNameField, mid-typing
  // edits that don't yet advance past Step 2 aren't autosaved — that's
  // intentional (Step 2 is gated by validation, so partial Card Name
  // shouldn't reach DB). Logo Text in the Header has no equivalent
  // gate because it's the identity anchor for Step 1.
  //
  // Phase 5.1 (2026-09-05): apply baselineArmedRef pattern (Rule 030).
  // Phase 5.2 (2026-09-13): same pattern re-targeted at `logoText`.
  // ============================================================
  const logoTextSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!cardId) return;
    // Hold autosave until loadSettings has resolved (see outer effect).
    // The shared `step4LoadSettledRef` covers both name and Step 4 —
    // they're on the same outer-fetch timeline.
    if (!step4LoadSettledRef.current) return;

    if (logoText === '') return; // Don't save empty Logo Text

    // Debounce: save Logo Text 1s after user stops typing.
    // 2026-09-13 swap: target is `settings.logoText`, not top-level `name`.
    if (logoTextSaveTimerRef.current) clearTimeout(logoTextSaveTimerRef.current);
    logoTextSaveTimerRef.current = setTimeout(() => {
      cardService.update(cardId, { settings: { logoText } }).catch((err) => {
        console.warn('[CardBuilderEditor] logoText auto-save failed:', err);
      });
    }, 1000);

    return () => {
      if (logoTextSaveTimerRef.current) clearTimeout(logoTextSaveTimerRef.current);
    };
  }, [cardId, logoText]);

  // ============================================================
  // Auto-save: isPaid toggle (Step 2 需收費 checkbox) → debounced PUT
  //
  // 2026-09-13 fix (current task): 原本 isPaid 只在 Step 2 的「下一步」
  // handleNext 內被送出，使用者切換 checkbox 後若未點 Next 就離開 Step 2，
  // 變更會丟失。改用與 logoText / Step 4 / Step 5 一樣的
  // baseline-armed + debounce pattern，讓 checkbox 一變更就 debounce 1s 後
  // PUT，避免依賴「點 Next 才存」的 UX 假設。
  //
  // 共用 step4LoadSettledRef：isPaid 跟 Step 4 都在同一個 outer-fetch timeline
  // （loadSettings 一次 hydrate 全部 settings），避免引入新 ref 即可保證
  // fetch 還沒 resolve 時不會 schedule timer 把預設值寫進 DB。
  // ============================================================
  const isPaidSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPaidBaselineArmedRef = useRef(false);
  // 追蹤「loadSettings 完成後第一次看到的 isPaid 值」當 baseline 對照。
  // null = loadSettings 還沒完成 / 還沒 snapshot。詳見下方 effect 註解。
  const isPaidAfterLoadRef = useRef<boolean | null>(null);
  const isPaid = useCardBuilderStore((s) => s.isPaid);

  // Reset baseline-armed flag + post-load snapshot whenever cardId
  // changes — a new template session is starting.
  useEffect(() => {
    isPaidBaselineArmedRef.current = false;
    isPaidAfterLoadRef.current = null;
  }, [cardId]);

  useEffect(() => {
    if (!cardId) return;
    // 跟 logoText 一樣守 step4LoadSettledRef：loadSettings 還沒 resolve 前
    // 不排 timer（預設值 false 寫進 DB 會跟 membership_tiers 等其他欄位
    // 衝突 — Rule 032 silent overwrite）。
    if (!step4LoadSettledRef.current) return;

    // 2026-09-13 fix (current task, refined): baseline-arm 用「loadSettings
    // 完成後第一次看到 isPaid 值」當基準，而不是第一次 effect run。
    //
    // 原因：Step 4 / Step 5 的 autosave 依賴 [cardId, description/backFields/
    // links/...]，loadSettings hydrate 時 description 等會從預設值變成
    // 真實值，effect 自然 re-run 並 seed baseline。但 isPaid 是 boolean，
    // loadSettings hydrate 後若 DB 的 isPaid === 預設值 (false)，
    // React selector 不會 re-render，effect 也不會 re-run，
    // baselineArmedRef 就停在 false — 第一次 user toggle 會被當成
    // baseline seed（flip 為 true + return），PUT 永遠不出去。
    //
    // 修法：另開一個 `isPaidAfterLoadRef` 追蹤「loadSettings 完成後
    // 第一次看到的 isPaid 值」。在 effect 內若 loadSettled=true 且
    // isPaidAfterLoadRef 還是 null，表示 loadSettings 剛完成、還沒
    // snapshot 此時的值 → 寫進 ref、return。等下一次 effect run（user
    // toggle 觸發）才會進入真正的 diff 邏輯。
    if (isPaidAfterLoadRef.current === null) {
      isPaidAfterLoadRef.current = isPaid;
      return;
    }

    // Diff: only schedule when isPaid changes from the post-load baseline.
    if (isPaid === isPaidAfterLoadRef.current) return;
    isPaidAfterLoadRef.current = isPaid;

    // Debounce 1s after the user toggles the checkbox. 後端 schema 已允許
    // `isPaid: z.boolean().optional()`，所以 `false` 也是有效值（不必像
    // logoText 那樣擋空字串）。
    if (isPaidSaveTimerRef.current) clearTimeout(isPaidSaveTimerRef.current);
    isPaidSaveTimerRef.current = setTimeout(() => {
      // Re-read latest value at fire time (防 closure stale — 跟 Step 4/5
      // 邏輯對齊：若 user 在 1s debounce 內又 toggle，timer fire 時拿到
      // 最新值而不是 effect run 時的值）。
      const finalIsPaid = useCardBuilderStore.getState().isPaid;
      cardService.update(cardId, { settings: { isPaid: finalIsPaid } }).catch((err) => {
        console.warn('[CardBuilderEditor] isPaid auto-save failed:', err);
      });
    }, 1000);

    return () => {
      if (isPaidSaveTimerRef.current) clearTimeout(isPaidSaveTimerRef.current);
    };
  }, [cardId, isPaid]);

  // ============================================================
  // Auto-save: Step 4 fields (description / backFields / links) → debounced PUT.
  //
  // Bug observed 2026-09-05: Step 4 edits did not persist unless the user
  // clicked "下一步" AND isStep4Valid() returned true. In-progress typing
  // was lost on reload / step navigation. Auto-save keeps the draft alive
  // even when the user fills only one of the three sub-fields.
  //
  // JSON.stringify snapshot guard (lastStep4SnapshotRef):
  //   - Zustand selectors return a fresh array reference on every render,
  //     so depending on `backFields` / `links` directly would cause the
  //     effect to fire on every render of any consumer.
  //   - The snapshot guard skips the PUT when the serialized payload hasn't
  //     changed since the last attempt — keeps DB writes to "real edits".
  // ============================================================
  const step4SaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastStep4SnapshotRef = useRef<string>('');

  // Pull Step 4 state from the store (will rerun the effect on store change).
  // We select individual fields so Zustand's referential equality can short-
  // circuit the re-render when nothing changed.
  const description = useCardBuilderStore((s) => s.description);
  const backFields = useCardBuilderStore((s) => s.backFields);
  const links = useCardBuilderStore((s) => s.links);

  // Bug-fix 2026-09-05 (round 2 — 修 3): even with the baseline-arm
  // pattern below, user edits BEFORE `loadSettings` completes would
  // schedule a timer (the snapshot diff against the empty baseline is
  // "real" to the effect) and that timer would PUT empty-or-partial
  // data over the DB. Solution: a `step4LoadSettledRef` is flipped to
  // true inside the outer URL-watching effect's `.then(loadSettings)`
  // callback. While settled=false, autosave refuses to schedule a
  // timer — preventing the DB-clobber race.
  const step4BaselineArmedRef = useRef(false);
  const step4LoadSettledRef = useRef(false);

  // Reset the "baseline armed" + "load settled" flags whenever cardId
  // changes — a new template session is starting.
  useEffect(() => {
    step4BaselineArmedRef.current = false;
    step4LoadSettledRef.current = false;
    lastStep4SnapshotRef.current = '';
  }, [cardId]);

  useEffect(() => {
    if (!cardId) return;

    const snapshot = JSON.stringify({
      description,
      backFields,
      links,
    });

    // First run after cardId is set / changed: just note the current snapshot
    // as the baseline. We do NOT schedule a timer — the current values may
    // be `reset()` defaults (description='', backFields=[{empty}], links=[])
    // if `loadSettings` hasn't completed yet. The subsequent re-run that
    // loadSettings triggers (with real values) will diff against this
    // baseline and legitimately schedule a save.
    if (!step4BaselineArmedRef.current) {
      step4BaselineArmedRef.current = true;
      lastStep4SnapshotRef.current = snapshot;
      return;
    }

    // 修 3 (2026-09-05): while `loadSettings` hasn't completed, refuse
    // to schedule a timer. The user's edits to the empty default
    // snapshot are real to them but NOT yet "real data" — we can't
    // trust them as autosave inputs because they would clobber whatever
    // loadSettings is about to hydrate from DB. The outer URL-watching
    // effect's `.then(loadSettings)` callback flips
    // `step4LoadSettledRef.current = true` once hydration is done.
    if (!step4LoadSettledRef.current) {
      // Keep baseline in sync with whatever the store currently shows so
      // the first diff after settle doesn't false-positive on the
      // cumulative change since first run.
      lastStep4SnapshotRef.current = snapshot;
      return;
    }

    if (snapshot === lastStep4SnapshotRef.current) return;
    lastStep4SnapshotRef.current = snapshot;

    if (step4SaveTimerRef.current) clearTimeout(step4SaveTimerRef.current);
    step4SaveTimerRef.current = setTimeout(() => {
      // Read the latest values from the store at fire time so we don't
      // capture a stale closure.
      const s = useCardBuilderStore.getState();
      cardService
        .update(cardId, {
          settings: {
            description: s.description,
            backFields: s.backFields,
            links: s.links,
          },
        })
        .catch((err) => {
          console.warn('[CardBuilderEditor] Step 4 auto-save failed:', err);
        });
    }, 1000);

    return () => {
      if (step4SaveTimerRef.current) clearTimeout(step4SaveTimerRef.current);
    };
  }, [cardId, description, backFields, links]);

  // ============================================================
  // Step 5 — 地理位置 + 推播訊息 autosave (2026-09-05)
  // ============================================================
  // Mirrors the Step 4 autosave pattern verbatim: baseline-armed ref +
  // loadSettled ref + JSON.stringify snapshot diff. Step 5 has NO required
  // fields so we save as soon as anything is non-default (description or
  // any location row). The baseline-arm + loadSettled guards are the
  // same logic as Step 4 — without them, an effect that fires before
  // loadSettings resolves would PUT empty defaults into DB (Rule 032
  // silent overwrite).
  const step5SaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastStep5SnapshotRef = useRef<string>('');

  const initialMessage = useCardBuilderStore((s) => s.initialMessage);
  const locationsDisabled = useCardBuilderStore((s) => s.locationsDisabled);
  const locationsMaxDistance = useCardBuilderStore((s) => s.locationsMaxDistance);
  const locations = useCardBuilderStore((s) => s.locations);

  const step5BaselineArmedRef = useRef(false);
  const step5LoadSettledRef = useRef(false);

  // Reset on session boundary (cardId change = new template session).
  useEffect(() => {
    step5BaselineArmedRef.current = false;
    step5LoadSettledRef.current = false;
    lastStep5SnapshotRef.current = '';
  }, [cardId]);

  useEffect(() => {
    if (!cardId) return;

    const snapshot = JSON.stringify({
      initialMessage,
      locationsDisabled,
      locationsMaxDistance,
      locations,
    });

    // First run: seed the baseline. Don't schedule a timer — the store
    // still holds empty defaults at this point.
    if (!step5BaselineArmedRef.current) {
      step5BaselineArmedRef.current = true;
      lastStep5SnapshotRef.current = snapshot;
      return;
    }

    // If loadSettings hasn't completed yet, hold the timer. Any user edits
    // before loadSettings settles are pre-baseline — saving them would
    // race against the upcoming hydration.
    if (!step5LoadSettledRef.current) {
      lastStep5SnapshotRef.current = snapshot;
      return;
    }

    if (snapshot === lastStep5SnapshotRef.current) return;
    lastStep5SnapshotRef.current = snapshot;

    if (step5SaveTimerRef.current) clearTimeout(step5SaveTimerRef.current);
    step5SaveTimerRef.current = setTimeout(() => {
      // Read the latest values from the store at fire time so we don't
      // capture a stale closure.
      const s = useCardBuilderStore.getState();

      // ===== Fix 400 (2026-09-09): field-level validation gate =====
      // Distinguish from `isStep5Valid()` in CardBuilderEditorWorkspace.tsx
      // (which gates the "Next" button and requires ALL fields valid —
      // ≥1 location row + valid locationsMaxDistance).
      //
      // For autosave we want to SAVE partial state as the user types, so
      // we only block specific cases that would 400 from backend:
      //   - `locationsMaxDistance` is set to a non-null value that is NOT
      //     a valid integer in [100, 1000].
      //   - any `locations` row has empty name or out-of-range lat/lng.
      //
      // Null `locationsMaxDistance` ("use pass-type default") and empty
      // `locations` array are VALID partial states — backend accepts them.
      //
      // Without this gate, an autosave that fires with corrupted store
      // data (e.g. `locationsMaxDistance: 10` from pre-clamp migration
      // rows, or a row missing required fields) would PUT invalid data
      // → backend returns 400.
      const lmd = s.locationsMaxDistance;
      if (lmd !== null && (!Number.isInteger(lmd) || lmd < 100 || lmd > 1000)) {
        console.warn('[CardBuilderEditor] Step 5 autosave skipped — locationsMaxDistance out of range:', lmd);
        return;
      }
      const hasInvalidRow = (s.locations ?? []).some(
        (l) =>
          !l.name ||
          l.name.trim().length === 0 ||
          !Number.isFinite(l.latitude) ||
          l.latitude < -90 ||
          l.latitude > 90 ||
          !Number.isFinite(l.longitude) ||
          l.longitude < -180 ||
          l.longitude > 180,
      );
      if (hasInvalidRow) {
        console.warn('[CardBuilderEditor] Step 5 autosave skipped — invalid location row');
        return;
      }

      // Fix 400 (2026-09-09): s.locations === null is NOT a valid optional
      // value for z.array().optional(). Omit the key entirely so Zod receives
      // undefined (which .optional() accepts) instead of null (which it rejects).
      const locationsPayload = s.locations
        ? s.locations.map((l) => ({
            name: l.name,
            latitude: l.latitude,
            longitude: l.longitude,
            relevantText: l.relevantText,
          }))
        : undefined;

      // 2026-09-06 refactor: when locationsDisabled=true the store has already
      // cleared locations + locationsMaxDistance (via setLocationsDisabled(true)).
      // Echo them as-is so the DB keeps no stale data.
      cardService
        .update(cardId, {
          settings: {
            initialMessage: s.initialMessage,
            locationsDisabled: s.locationsDisabled,
            locationsMaxDistance: s.locationsMaxDistance,
            locations: locationsPayload,
          },
        })
        .catch((err) => {
          console.warn('[CardBuilderEditor] Step 5 auto-save failed:', err);
        });
    }, 1000);

    return () => {
      if (step5SaveTimerRef.current) {
        clearTimeout(step5SaveTimerRef.current);
        step5SaveTimerRef.current = null;
      }
    };
  }, [cardId, initialMessage, locationsDisabled, locationsMaxDistance, locations]);

  // ============================================================
  // Auto-save keep-alive: touch TTL every 5 minutes
  // ============================================================
  const touchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!cardId) return;

    // Touch immediately on mount / cardId change
    cardService.touch(cardId).catch((err) => {
      console.warn('[CardBuilderEditor] touch failed:', err);
    });

    // Re-touch every 5 minutes to keep the draft alive
    touchTimerRef.current = setInterval(() => {
      if (cardId) {
        cardService.touch(cardId).catch((err) => {
          console.warn('[CardBuilderEditor] touch keep-alive failed:', err);
        });
      }
    }, 5 * 60 * 1000);

    return () => {
      if (touchTimerRef.current) {
        clearInterval(touchTimerRef.current);
        touchTimerRef.current = null;
      }
    };
  }, [cardId]);

  async function handleStepChange(newStep: EditorStep) {
    if (newStep < step) {
      setStep(newStep);
      return;
    }

    // Read current values directly from store to avoid stale closure
    const currentCardType = useCardBuilderStore.getState().cardType;
    // 2026-09-13 swap: `name` → `cardName` (SQL column) + `logoText` (JSONB).
    // The create payload now sends `cardName` as top-level `name` so the
    // SQL column gets the Card Name, and `logoText` in settings so the
    // JSONB has the pass header text.
    const currentCardName = useCardBuilderStore.getState().cardName;
    const currentLogoText = useCardBuilderStore.getState().logoText;

    if (newStep === 2 && currentCardType) {
      // Step 1 完成：cardType 已經知道
      if (!cardId) {
        // 新建：建立草稿（含 cardType + Logo Text seed for preview identity）
        try {
          const template = await cardService.create({
            name: currentCardName || '未命名卡片',
            cardType: currentCardType,
            settings: {
              isPaid: false,
              // Logo Text defaults to Card Name on first create so the
              // preview isn't empty — the user can override in the Header
              // input at any time. Setting it here also means the SQL
              // `templates.name` value matches the seed value visible in
              // the preview immediately after Step 1.
              logoText: currentLogoText || currentCardName || '未命名卡片',
            },
          });
          setCardId(template.id);
        } catch (err) {
          console.error('Failed to create draft on Step 1 complete:', err);
          return; // 不跳 step
        }
      } else {
        // 繼續：更新既有草稿（從 resume 回來的）
        try {
          await cardService.update(cardId, {
            name: currentCardName,
            cardType: currentCardType,
            // logoText handled by the Header autosave effect — only the
            // cardType and cardName matter at Step 1 completion.
          });
        } catch (err) {
          console.error('Failed to update draft on Step 1 continue:', err);
          // 不 block 前進，update 失敗只是沒存到
        }
      }
      setCompletedStep(1);
      setStep(newStep);
    } else if (newStep > step) {
      console.log('[handleStepChange] newStep > step, calling setStep:', newStep);
      setStep(newStep);
      console.log('[handleStepChange] setStep called');
    }
  }

  return (
    <div className="flex min-w-0 h-full w-full flex-col overflow-hidden">
      {/* min-w-0: see comment in the flex-row div below. Without it, the
          crop stage's inline width propagates through this outer wrapper
          to the page wrapper. */}
      {/* Loading state while fetching template */}
      {isLoading && (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      )}

      {!isLoading && (
        <>
        {/* 上容器：導航列
            2026-09-13 swap: Header input now binds to `logoText` (pass
            header text) instead of `name` (record name). Card Name is
            shown as a non-editable sub-line under the title. The
            isStep1Blocked gate keys off `logoText` because that's what
            must be filled to advance past Step 1 cleanly. */}
        <CardBuilderEditorHeader
          logoText={logoText}
          onLogoTextChange={setLogoText}
          cardName={cardName}
          step={step}
          onStepChange={handleStepChange}
          completedSteps={completedSteps}
          isStep1Blocked={!logoText.trim() || !cardType}
        />

        {/* 下容器：左右欄位
            min-w-0 on both the outer wrapper and the inner lg:flex-row is
            defensive — without it, the LogoUploader crop stage's inline
            width (e.g. 329px on a 412px viewport) sets this flex item's
            min-content, which propagates up to the page wrapper. With
            min-w-0 + overflow-hidden, the flex item stays at the parent
            width and the overflow is clipped. See feedback 20260830. */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden lg:flex-row">
          {/* 左欄位：操作區 — 2/3 寬度 */}
          <CardBuilderEditorWorkspace
            step={step}
            onStepChange={handleStepChange}
            cardType={cardType}
            cardId={cardId}
            onCardTypeChange={useCardBuilderStore.getState().setCardType}
            onSave={async (id, settings) => {
              await cardService.update(id, { settings });
            }}
            onBack={_onBack}
            className="min-w-0 flex-2 lg:w-2/3"
          />

          {/* 右欄位：即時預覽區 — 1/3 寬度，Desktop only */}
          <CardBuilderEditorPreview
            cardSide={cardSide}
            onCardSideChange={setCardSide}
            className="flex-1 lg:w-1/3"
          />
        </div>

        {/* Mobile 預覽面板（Bottom Sheet） */}
        <MobilePreviewPanel
          cardSide={cardSide}
          onCardSideChange={setCardSide}
        />
        </>
      )}
    </div>
  );
}
