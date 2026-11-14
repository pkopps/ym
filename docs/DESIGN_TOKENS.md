# Web design tokens

Tokens live in `packages/branding/src/brand.css` (mirrored for native apps in `packages/branding/src/tokens.ts`). `apps/web/src/app/globals.css` overrides only the radius scale and the shadow for the web. Use a token for every colour, type size, radius, spacing value and shadow in web CSS. If a value has no token, pick the nearest one rather than adding a raw value.

## Tokens

| Group | Token | Value | Use |
| --- | --- | --- | --- |
| Text | `--ym-color-ink` | `#14281d` | Headings, body text, field text |
| | `--ym-color-ink-soft` | `#2d4736` | Secondary body text |
| | `--ym-color-muted` | `#66756a` | Labels, hints, empty states |
| Surfaces | `--ym-color-surface` | `#f7f5ef` | Page background, quiet fills |
| | `--ym-color-surface-strong` | `#f0eadc` | Neutral chips, tracks, placeholders |
| | `--ym-color-card` | `rgba(255,255,255,0.88)` | Cards and panels |
| | `--ym-color-white` | `#ffffff` | Fields, dialogs, menus, text on brand |
| | `--ym-color-border` | `rgba(20,40,29,0.12)` | Every hairline |
| Brand | `--ym-color-primary` | `#2f7d4c` | Primary buttons, selected outline |
| | `--ym-color-primary-strong` | `#205938` | Hover, links, text buttons |
| | `--ym-color-primary-soft` | `#c5dbc9` | Selected or recommended borders |
| | `--ym-color-primary-tint` | `#eaf3ec` | Selected fills, success notices, focus ring |
| Warning | `--ym-color-accent` | `#e29a45` | Warning accent |
| | `--ym-color-accent-strong` | `#8a581b` | Warning text, selected map pins |
| | `--ym-color-accent-soft` | `#f6d9b6` | Warning borders |
| | `--ym-color-accent-tint` | `#fbefe0` | Warning fills |
| Status | `--ym-color-success` | `#23754f` | Success text |
| | `--ym-color-danger` | `#b84d41` | Errors, destructive buttons |
| | `--ym-color-danger-tint` | `#f6e4e1` | Error fills |
| Type | `--ym-text-xs` … `--ym-text-2xl` | 12, 14, 16, 20, 24, 32px | Six sizes |
| Radius (web) | `--ym-radius-sm` / `md` / `lg` | 4 / 6 / 8px | Fields and tags / cards, panels, notices / dialogs, media |
| | `--ym-radius-pill` | 999px | Buttons, chips |
| Spacing | `--ym-space-1` … `--ym-space-8` | 4, 8, 12, 16, 24, 32, 48, 64px | Padding, margin, gap |
| Shadow | `--ym-shadow-soft` | `0 1px 3px rgba(20,40,29,0.06)` on web | The one elevation |

The request named the roles ink, muted, surface, background, border, brand, brand-hover, success, warning and danger. The existing names were kept so the native apps and current CSS keep working: background is `surface`, surface is `card`/`white`, brand is `primary`, brand-hover is `primary-strong`, warning is `accent`.

## Component looks

- **Buttons**: `.button` (primary), `.button-secondary`, `.button-danger` are pills with a 3rem minimum height. Text buttons (`.text-link-button`, `.journey-text-button`) are `primary-strong`, underlined.
- **Form fields**: 1px `border`, `radius-sm`, `white` fill, `ink` text. `.input` and `.form-field` controls pad `space-3 space-4`.
- **Cards and panels**: 1px `border`, `radius-md`, `card` fill, `shadow-soft`. No gradients.
- **Empty states**: `muted`, centred.
- **Errors**: `danger`, weight 600; boxed errors use `danger-tint` with `radius-md`.
- **Utilities**: `.u-*` classes at the end of `globals.css` (margin, padding, gap, alignment) replace inline `style` overrides. Reach for them instead of `style={{}}`.

## Audit, November 2026

Distinct values in `globals.css` before and after consolidation:

| | Before | After | What is left |
| --- | --- | --- | --- |
| Hex colours | 106 | 15 | Unused dark footer and app-banner rules, loader illustration, winter blue |
| `rgba()` colours | 124 | 59 | Almost all inside decorative gradients |
| Font sizes | 60 | 19 | Six tokens, twelve fluid heading sizes, one 52px glyph |
| Radii | 25 | 10 | Four tokens, `0`, `50%`, brand mark |
| Shadows | 19 | 6 | One shadow, focus ring, two insets, `none` |
| Raw spacing values | 69 | 23 | See below |
| Inline `style={{}}` | 126 | 1 | Arrival progress width (computed) |

### Values that did not map cleanly

These were left as they are rather than forced onto a token.

- **Fluid heading sizes** (12 `clamp()` declarations, for example `.hero h1`, `.section-header h2`, `.journey-page h1`, `.auth-page-header h1`). They scale with the viewport and sit above the 32px top of the scale. They need a decision on one or two display sizes.
- **Spacing between steps**: `1.25rem`/`20px` (13 uses), `10px` (9), `1.2rem` (6), `14px` (4), `18px` (3), `1.75rem`/`28px` (4), `6px` (2) and a few singles. Each is 2px or more from the nearest step. The scale has no 20px step; adding one would absorb most of them.
- **Decorative gradients**: page hero background, service tile image wash, provider landing story and mower strip, map viewport, loading skeleton shimmer, loading preview.
- **Illustration colours**: lawn-mower loader SVG fills and strokes, two `drop-shadow()` filters.
- **Winter blue** `#3a74d8` and its hover fill: no blue in the palette. Both rules are currently unused.
- **Unused rules on a dark surface**: `.site-footer*`, `.app-banner*`, `.store-badge`. No component references them; deleting them is a separate cleanup.
- **Brand mark frame** radius (18px, 15px on small screens): a logo shape, not a UI surface.
- **Home page**: `.service-tile-card` keeps its white-to-sand gradient, and seven spacing values in rules the home page renders were kept exactly (`0.15rem`, `0.35rem` ×2, `0.55rem`, `0.85rem`, `0.9rem`, `0.95rem`) so the page does not reflow.
