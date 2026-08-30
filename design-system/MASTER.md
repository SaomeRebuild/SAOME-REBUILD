# SAOME Design System — Master

> 暖橘暗色 SaaS UI / 所有頁面實作的 Source of Truth

---

## 1. Color System

### Palette

| Role | Hex | CSS Variable | Usage |
|------|-----|-------------|-------|
| Primary | `#F97316` | `--color-primary` | Buttons, links, main CTA |
| On Primary | `#0F172A` | `--color-on-primary` | Text on primary |
| Secondary | `#FB923C` | `--color-secondary` | Secondary actions, tags |
| On Secondary | `#0F172A` | `--color-on-secondary` | Text on secondary |
| Accent | `#FBBF24` | `--color-accent` | Highlights, badges, CTA hover |
| On Accent | `#0F172A` | `--color-on-accent` | Text on accent |
| Background | `#0F0F23` | `--color-background` | Page background |
| Foreground | `#F8FAFC` | `--color-foreground` | Primary text |
| Card | `#1B1B30` | `--color-card` | Card surfaces |
| Card Foreground | `#F8FAFC` | `--color-card-foreground` | Text on cards |
| Muted | `#27273B` | `--color-muted` | Disabled, placeholder bg |
| Muted Foreground | `#94A3B8` | `--color-muted-foreground` | Secondary text, hints |
| Border | `#2D2D4A` | `--color-border` | Dividers, card borders |
| Ring | `#F97316` | `--color-ring` | Focus ring |
| Destructive | `#EF4444` | `--color-destructive` | Errors, delete |
| Success | `#22C55E` | `--color-success` | Success states |
| Warning | `#F59E0B` | `--color-warning` | Warnings |

### Dark Mode Contrast

All text on dark surfaces meets WCAG 4.5:1 minimum.
- Foreground `#F8FAFC` on Background `#0F0F23`: ~14:1
- Muted Foreground `#94A3B8` on Muted `#27273B`: ~5:1
- On Primary `#0F172A` on Primary `#F97316`: ~7:1

---

## 2. Typography

### Font Stack

| Role | Font | Weights | CSS Variable |
|------|------|---------|-------------|
| Headings | Fredoka | 400, 500, 600, 700 | `--font-family-heading` |
| Body | Nunito | 300, 400, 500, 600, 700 | `--font-family-body` |

```css
@import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:wght@300;400;500;600;700&display=swap');
```

### Usage Rules

- Headings (`h1`–`h6`) always use `--font-family-heading`
- Body text always uses `--font-family-body`
- Never use system fonts as primary (Nunito is fallback)

---

## 3. Spacing Scale (8dp Rhythm)

| Token | Value | Use |
|-------|-------|-----|
| `--spacing-1` | 4px | Tight gaps |
| `--spacing-2` | 8px | Icon padding |
| `--spacing-3` | 12px | Inline gaps |
| `--spacing-4` | 16px | Default padding |
| `--spacing-6` | 24px | Section inner |
| `--spacing-8` | 32px | Card padding |
| `--spacing-12` | 48px | Section gaps |
| `--spacing-16` | 64px | Page margins |
| `--spacing-24` | 96px | Large section gaps |

---

## 4. Border Radius

| Token | Value | Use |
|-------|-------|-----|
| `--radius-sm` | 6px | Badges, small inputs |
| `--radius-md` | 12px | Buttons, inputs |
| `--radius-lg` | 20px | Cards, modals |
| `--radius-xl` | 28px | Large panels |
| `--radius-full` | 9999px | Pills, avatars |

---

## 5. Shadows

| Token | Use |
|-------|-----|
| `--shadow-soft` | Default card, input |
| `--shadow-lifted` | Hovered card, dropdown |
| `--shadow-glow` | Primary button glow on hover |

---

## 6. Motion & Interaction

### Timing Tokens

| Token | Value | Use |
|-------|-------|-----|
| `--transition-fast` | 150ms ease-out | Press feedback |
| `--transition-base` | 200ms ease-out | Hover, scale |
| `--transition-slow` | 400ms ease-out | Page transitions, reveals |

### Interaction Patterns

#### Scale hover (buttons, cards)
```css
transition: transform var(--transition-base), box-shadow var(--transition-base);
cursor: pointer;
```
- Hover: `transform: scale(1.03)`
- Active: `transform: scale(0.97)` (duration: `--transition-fast`)

#### Card hover lift
```css
transition: transform var(--transition-base), box-shadow var(--transition-base);
```
- Hover: `transform: translateY(-2px)` + `box-shadow: var(--shadow-lifted)`

#### Focus ring
```css
:focus-visible {
  outline: 2px solid var(--color-ring);
  outline-offset: 2px;
}
```

#### Scroll reveal
```css
.reveal {
  opacity: 0;
  transform: translateY(12px);
  transition: opacity var(--transition-slow), transform var(--transition-slow);
}
.reveal.visible {
  opacity: 1;
  transform: translateY(0);
}
```

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 7. Icons

- **Library**: Lucide React (`@lucide/react`)
- **Rule**: All interactive icons use `cursor-pointer`
- **No emoji** as icons — SVG only

---

## 8. Anti-Patterns

- No emoji as structural icons
- No `console.log` in production code
- No hardcoded hex colors — use CSS variables
- No inline styles
- No `!important` except in `prefers-reduced-motion`
- No text on pure black (`#000`) — use `--color-background`

---

## 9. Spacing Application Rules

Use these conventions to keep spacing consistent across all components and sections.

### Section-level

| Pattern | Tokens |
|---------|--------|
| Section vertical padding | `py-20 lg:py-28` |
| Section gap (between sections) | `gap-12` to `gap-16` |
| Section heading bottom margin | `mb-12` to `mb-16` |

### Card-level

| Pattern | Tokens |
|---------|--------|
| Card padding | `p-6` (compact) / `p-8` (standard) |
| Card gap between items | `gap-4` |
| Card border radius | `rounded-xl` (`--radius-lg`) |

### Grid gap (multi-column layouts)

| Context | Gap token |
|---------|-----------|
| 2-column grid | `gap-8` |
| 3-column grid | `gap-8 md:gap-12` |
| 4-column grid | `gap-6 md:gap-8` |

### Text elements

| Pattern | Tokens |
|---------|--------|
| Heading ↔ paragraph | `mt-4` to `mt-6` |
| List item gap | `gap-2` to `gap-3` |
| Paragraph line height | `leading-relaxed` |

### Inline / icon

| Pattern | Tokens |
|---------|--------|
| Icon + text gap | `gap-2` |
| Icon padding (in container) | `p-2` |
| Badge / chip padding | `px-3 py-1` |

### Do NOT mix arbitrary values

❌ `gap-7`, `p-7`, `mb-9`, `mt-[18px]`
✅ Use only tokens from the spacing scale above

---

## 10. File Location

Design tokens live in: `frontend/src/index.css` (`@theme` block)

See also:
- `.cursor/rules/uiux/011-uiux-tokens.mdc` — token rule
- `.cursor/rules/uiux/010-uiux-pro-max.mdc` — process rule

---

## 11. Light Mode Tokens

> RN-friendly note: Token values are platform-neutral. Web uses `var(--color-*)` CSS variables; React Native uses the same token objects (`tokens.background.light`).

### Color Mapping (Dark vs Light)

Primary `#F97316` is **consistent** across both modes.

| Token | Dark | Light | Usage |
|-------|------|-------|-------|
| `--color-background` | `#0F0F23` | `#FAFAFA` | Page background |
| `--color-foreground` | `#F8FAFC` | `#0F172A` | Primary text |
| `--color-card` | `#1B1B30` | `#FFFFFF` | Card surfaces |
| `--color-card-foreground` | `#F8FAFC` | `#0F172A` | Text on cards |
| `--color-muted` | `#27273B` | `#F1F5F9` | Disabled bg, subtle surfaces |
| `--color-muted-foreground` | `#94A3B8` | `#64748B` | Secondary text, hints |
| `--color-border` | `#2D2D4A` | `#E2E8F0` | Dividers, card borders |
| `--color-primary` | `#F97316` | `#F97316` | **Unchanged** — CTA, buttons |
| `--color-on-primary` | `#0F172A` | `#FFFFFF` | Text on primary |
| `--color-secondary` | `#FB923C` | `#FB923C` | Secondary actions |
| `--color-on-secondary` | `#0F172A` | `#FFFFFF` | Text on secondary |
| `--color-accent` | `#FBBF24` | `#FBBF24` | Highlights, badges |
| `--color-on-accent` | `#0F172A` | `#0F172A` | Text on accent |
| `--color-destructive` | `#EF4444` | `#EF4444` | Errors |
| `--color-success` | `#22C55E` | `#22C55E` | Success states |
| `--color-warning` | `#F59E0B` | `#F59E0B` | Warnings |
| `--color-ring` | `#F97316` | `#F97316` | Focus ring |

### Light Mode Contrast

All text on light surfaces meets WCAG 4.5:1 minimum.
- Foreground `#0F172A` on Background `#FAFAFA`: ~17:1
- Muted Foreground `#64748B` on Muted `#F1F5F9`: ~5.5:1
- On Primary `#FFFFFF` on Primary `#F97316`: ~4.8:1

### CSS Implementation Pattern

```css
:root,
[data-theme='dark'] {
  --color-background: #0F0F23;
  --color-foreground: #F8FAFC;
  --color-card: #1B1B30;
  --color-card-foreground: #F8FAFC;
  --color-muted: #27273B;
  --color-muted-foreground: #94A3B8;
  --color-border: #2D2D4A;
  /* primary, secondary, accent, destructive, success, warning unchanged */
}

[data-theme='light'] {
  --color-background: #FAFAFA;
  --color-foreground: #0F172A;
  --color-card: #FFFFFF;
  --color-card-foreground: #0F172A;
  --color-muted: #F1F5F9;
  --color-muted-foreground: #64748B;
  --color-border: #E2E8F0;
}

/* Typography, spacing, radius, shadow, transitions: shared across both modes */
```

---

## 12. Three-State Theme System

### State Model

| State | Description | Resolved |
|-------|-------------|----------|
| `'light'` | User explicitly chose light | `light` |
| `'dark'` | User explicitly chose dark | `dark` |
| `'system'` | Follow OS preference | OS dark → `dark`; else `light` |

### Persistence

Theme preference is stored in `localStorage` under key `saome.theme`. RN migration path: replace with `@react-native-async-storage/async-storage`.

### RN Migration Map

| Web Implementation | RN Replacement |
|---------------------|----------------|
| `document.documentElement.dataset.theme` | `StatusBar.setBarStyle()` + subtree re-render via Context |
| `matchMedia('(prefers-color-scheme: dark)')` | `Appearance.addChangeListener` |
| `useStorage` hook | Same hook interface, swap internal to `AsyncStorage` |
| `ThemeProvider` Context | React Context (identical API) |
| `useTheme()` hook | React hook (identical API) |

### No Scroll-Aware Effects in Dashboard Header

`DashboardHeader` must not use `window.scrollY` listeners (RN has no equivalent). Dashboard header uses **static** styling — transparency transition should be avoided or gated by a separate prop.

### Icon Compatibility

Lucide icons (`lucide-react`) are used on web. RN migration swaps to `lucide-react-native` with identical icon names.

---

## 13. Crop Window Pattern（圖片裁切互動）

> **適用元件**：LogoUploader、BackgroundUploader、IconUploader 等所有提供 zoom + crop 的圖片上傳元件。

### 設計意圖

Crop window 是**使用者選定的範圍指示器**，不是「選更大範圍」的工具。zoom 的語意是「在選定範圍內看到更多 src 細節」。

### Crop Window Tokens

| Token | Value | 用途 |
|-------|-------|------|
| `--crop-window-size` | 200px（LogoUploader default） | 固定視覺大小，不隨 scale 變化 |
| `--crop-window-border` | 2px white / 70% | 視覺邊框 |
| `--crop-mask-overlay` | `rgba(0,0,0,0.5)` | 非選取區域的暗色遮罩 |
| `--crop-window-radius` | `--radius-md` | 圓角（與卡片一致） |

### 三層結構 Pattern

```
outer container (fixed layout, pointer events)
├── inner canvas (transform: scale(scale), 只含 image)
├── SVG mask (NOT scaled, fixed size hole at center)
└── border (NOT scaled, fixed size frame at center)
```

只有 image 套 scale → mask 永遠固定 → 「選定範圍內 zoom in 看細節」。

### Zoom 對應 srcSquareSize

| scale | image 視覺大小（相對 base canvas） | mask 看到的細節倍數 |
|-------|------------------------------------|---------------------|
| 0.5   | 50%                                | 0.25x               |
| 1.0   | 100%                               | 1x（基準）          |
| 2.0   | 200%                               | 4x 細節             |
| 3.0   | 300%                               | 9x 細節             |

### Export Crop 對齊 UI Mask（鐵律）

`cropImage()` 算 srcSquareSize **必須**用：

```
srcSquareSize = (cropWindowSize / (baseCanvasWidth * scale)) * naturalWidth
```

**禁止**用 `min(NW, NH) / scale`（會跟 UI mask 在 src 中的 size 不一致，導致 UI 跟 export 視覺位置不同）。

詳見 `.cursor/rules/028-image-uploader-pattern.mdc` § 11 與 `.cursor/skills/saome-image-upload/SKILL.md` § Crop Window Invariant。

### Mobile Drag UX 三軸（必遵守）

詳見 `.cursor/rules/frontend/029-image-crop-mobile-ux.mdc`（Rule 029）。

| 軸 | touch | mouse | pen |
|----|-------|-------|-----|
| sensitivity | 5.0 | 1.0 | 1.0 |
| 順暢度 | ref+DOM | ref+DOM | ref+DOM |
| momentum | on | off | off |

chain overflow 防護：crop stage 用了 inline width 的元件，整條 flex chain 的 flex item 都要加 `min-w-0`；html/body 加 `overflow-x: hidden` 終局保護。
