# Theming

Bermi has two independent appearance preferences:

- **Mode** — Light, Dark or System.
- **Colour** — five designed themes (Bermi Blue, Sunset Orange, Rose Pink, Royal Violet, Emerald Teal) or **Any colour**.

Everything is driven by CSS variables (`--primary`, `--surface`, `--ink`, …) declared in `client/src/index.css`.
Selectors are attribute-based (`[data-accent="rose"]`, `[data-theme="dark"]`), so *any element* can carry its own theme.
The Appearance settings use that for live previews, and the period tracker uses it to wear its own rose palette.

## Any colour

`client/src/lib/customTheme.ts` turns one chosen hex into a full token set for light and dark. Lightness is nudged until
text, muted text and buttons keep WCAG AA contrast (4.5:1). The tokens are applied inline on `<html>` and a copy is cached
in `localStorage["bermi-custom-vars"]` so the inline bootstrap script in `index.html` can apply them before first paint
(no flash). Presets clear the inline values.

## Persistence

`localStorage["bermi-prefs"]` always; for signed-in users also `GET/PUT /api/life/prefs` (newest-wins sync in `PrefsSync`).
The server validates every field (enum values, `#rrggbb` for the custom colour).

## Surfaces

`.hero`, `.tile`, `.tile-glass`, `.tile-accent`, `.dock` and `.glow-btn` are derived from `--primary`, so all themes get them.
Heroes and the dock are always dark with white text; their gradients mix `--primary` with near-black to keep contrast.

## Icons

The in-app logo is the free mark (`client/src/lib/brand.ts`, drawn once): a rounded "b" with a four-point spark.
The favicon follows the chosen icon colour. The installed-app home-screen icon is set by the device and does not change.
