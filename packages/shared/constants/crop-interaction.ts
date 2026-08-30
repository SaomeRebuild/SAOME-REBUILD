/**
 * Shared crop interaction constants.
 *
 * Per-modality (mouse / pen / touch) controls that are tuned based on user
 * feedback from the 2026-08-30 mobile fix cycle (see
 * `DEV/08-2026/0830-logo-uploader-mobile-fix-cycle.md`).
 *
 * IMPORTANT (per feedback 20260830): momentum and elevated DRAG_SENSITIVITY
 * are TOUCH-ONLY. On desktop:
 *   - Mouse: 1:1 sensitivity (precise, no surprise zoom-in feel), NO momentum
 *     (releases are intentional, not flicks).
 *   - Pen:   1.0x sensitivity, NO momentum (stylus is more precise than finger).
 *
 * RN migration: these constants are platform-agnostic. The hook layer
 * (useImageCrop.web.ts / useImageCrop.native.ts) reads them directly.
 *
 * @module shared/constants/crop-interaction
 */

/**
 * Drag sensitivity multiplier applied to per-modality pointer/touch deltas.
 *
 * - Mouse / Pen: 1.0 = 1:1 pixel mapping (precise control).
 * - Touch: 3.0 — real phones feel "too slow" at 1.0, while 5.0+ feels
 *   jittery / overshoots. 3.0 was selected via iterative user testing
 *   on 2026-08-30 — a 40px finger drag traverses 120px focal shift,
 *   covering the full focal range in ~56px (vs ~34px at 5.0).
 */
export const MOUSE_SENSITIVITY = 1.0;
export const TOUCH_SENSITIVITY = 3.0;

/**
 * Touch momentum / inertia parameters (iOS / Android photo-cropper standard).
 *
 * On release with sufficient velocity, the image continues gliding
 * (`requestAnimationFrame` loop) with decaying velocity. Without this
 * ("一次只能移動一點，要滑好幾次" — user feedback 2026-08-30), users had
 * to re-grab and drag many times for a large image.
 *
 * Mouse / pen pointer releases do NOT trigger momentum — releases are
 * intentional stops on desktop, not flicks.
 */

/** Capture window for velocity computation (recent move history). */
export const MOMENTUM_HISTORY_WINDOW_MS = 120;

/** Velocity threshold (px/ms) below which glide is suppressed.
 *  Lowered from 0.012 → 0.005 so slower swipes (e.g. 2px/500ms × 5.0 = 0.02)
 *  also get momentum. Above this threshold, momentum ticks once per frame. */
export const MOMENTUM_MIN_VELOCITY = 0.005;

/** Per-frame velocity decay (≈16ms frame). Friction coefficient. */
export const MOMENTUM_FRICTION = 0.96;

/** Timestep for momentum rAF loop in ms. */
export const MOMENTUM_FRAME_MS = 16;
