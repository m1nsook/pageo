# Website theme controls

The **Design site → Theme** tab controls the appearance of the **published static website**, not the Paglora desktop application's appearance.

## Color mode

- **System** (default): visitors see light or dark based on their operating system preference, using only CSS media queries.
- **Light**: public pages always use Paglora's light palette.
- **Dark**: public pages always use Paglora's dark palette.

No JavaScript, login, or server is needed. Mode is stored in `site.json`, and applies to both live preview and exported HTML.

## Accent color

Choose Paglora blue, violet, teal, orange or rose, or use the built-in color picker for any six-digit hex value. The accent controls links, active sidebar navigation and focus/selected states. It is validated by the Rust backend and injected as a site-level CSS custom property.

```json
{
  "themeMode": "system",
  "accentColor": "#2196f3"
}
```

Existing projects have both fields filled with safe defaults at read time; their existing `site.json` remains valid. Other site designer options (navigation positions, header, footer, links, width and logo) are unchanged.

Your local `theme/custom.css` is always loaded **after** designer presets. You can override colors, typography, components, and other styles in source without Paglora rewriting your hand-authored CSS.

## Theme and font scope

Geist Variable is packaged locally in exported sites. This milestone ships the Latin font subset and falls back to installed fonts for other writing systems. Theme controls affect public docs only; the desktop studio's Light/Dark/System setting is independent.
