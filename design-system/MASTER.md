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
