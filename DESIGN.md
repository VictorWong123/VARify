# VARify Design System

## Stack

- React 19 + TypeScript
- Vite 6, dev proxy `/api` → `http://localhost:8080`
- Tailwind CSS 4.1 (CSS-first config via `@theme` in `src/index.css`)
- lucide-react for icons
- Fonts: Space Grotesk (display), Inter (UI), JetBrains Mono (numeric) — loaded from Google Fonts in `index.css`

## Theme

Dark broadcast VAR booth. Single theme. No light mode.

Scene: a video assistant referee in a booth at Levi's Stadium during a 2026 World Cup match, two monitors in front of them, dim ambient light, headset on. The screen reads instantly under pressure.

## Color (OKLCH, mapped to Tailwind 4 `@theme`)

All custom tokens use OKLCH. Neutrals carry a slight cool tint toward the Pacific hue (240) — never pure `#000` or `#fff`.

### Custom tokens in `@theme`

```css
@theme {
  /* Surface */
  --color-deep:        oklch(0.13 0.015 240);
  --color-panel:       oklch(0.17 0.018 240);
  --color-elev:        oklch(0.21 0.020 240);
  --color-sunken:      oklch(0.10 0.018 240);

  /* Lines */
  --color-line:        oklch(0.28 0.015 240);
  --color-line-strong: oklch(0.40 0.020 240);

  /* Ink */
  --color-ink:         oklch(0.96 0.005 240);
  --color-ink-2:       oklch(0.74 0.010 240);
  --color-ink-3:       oklch(0.54 0.015 240);
  --color-ink-dim:     oklch(0.40 0.015 240);

  /* Bay Area accents */
  --color-pacific:     oklch(0.66 0.16 240);
  --color-pacific-dim: oklch(0.46 0.12 240);
  --color-amber-bay:   oklch(0.80 0.16 75);

  /* Signal — verdict only */
  --color-card-yellow: oklch(0.86 0.18 95);
  --color-card-red:    oklch(0.62 0.22 25);
  --color-pitch:       oklch(0.62 0.13 145);
}
```

Tailwind classes: `bg-deep`, `text-ink-2`, `border-line`, `text-pacific`, etc.

### Color strategy

Committed-toward-full-palette. The dark surface dominates (~70%), Pacific blue carries identity and live state (~15%), amber accents agent voice and scanning highlights (~5%), signal colors (yellow/red/pitch) fire only on actual verdicts.

## Typography

Two display families plus mono:

- **Space Grotesk** — hero "VARIFY", verdict text, top HUD lockup. Tight, broadcast-confident.
- **Inter** — all UI: labels, buttons, body, headings inside panels.
- **JetBrains Mono** — every numeric: timestamps, CAM IDs, confidence percentage, file sizes, latency counters, the broadcast clock.

Numbers use `font-variant-numeric: tabular-nums` everywhere.

### Scale (Tailwind utilities)

- `text-[10px]` / `text-xs` — eyebrow caps and meta
- `text-sm` — body default in compact panels
- `text-base` — body in spacious panels
- `text-2xl` / `text-3xl` — section headings
- Custom hero size: 96–120px Space Grotesk via inline `text-[100px]` or similar

## Spacing

Standard Tailwind scale. Varied rhythm:
- Top HUD: dense (px-4 py-3)
- Hero block: generous (py-12 / py-16)
- Panels: 20 / 24 / 28
- Card padding: 16 / 20

## Radius

- `rounded-md` (6px) — chips, inline tags
- `rounded-lg` (8px) — buttons, inputs
- `rounded-xl` (12px) — panels
- `rounded-2xl` (16px) — hero blocks, verdict banner

## Elevation

No drop shadows on the page background. Elevation comes from:
1. Surface lightness step (`bg-deep` → `bg-panel` → `bg-elev`).
2. A 1px top inner highlight on key panels (`shadow-[inset_0_1px_0_oklch(1_0_0_/_0.05)]`).
3. The `border-line` outline.

## Motion

Tailwind classes use these durations:
- `duration-150` — hover, focus
- `duration-200` — most transitions
- `duration-300` — verdict reveal
- `duration-700` — confidence dial sweep

Easing — define one custom curve in `index.css`:
```css
.ease-out-quart { transition-timing-function: cubic-bezier(0.165, 0.84, 0.44, 1); }
```

Animate only `opacity`, `transform`, `filter`. Never `width`, `height`, `top`, `left`, `padding`.

## Layout

Max-width 1280px (`max-w-7xl`), centered. Padded `px-4` on mobile, `px-6` to `px-8` on desktop.

### Idle / empty state

```
[ TopHUD                                            ]
[ Hero — huge VARIFY display                        ]
[ Source picker (presets | upload) | Briefing pad   ]
[ IFAB Law 12 explainer (full width)                ]
```

### Results state

```
[ TopHUD                                                          ]
[ Verdict banner (full width)                                     ]
[ Camera rail 320 | Agent panel 1fr | Confidence + key moment 360 ]
[ Evidence timeline (full width)                                  ]
[ Gemini observation + model trace                                ]
[ IFAB Law 12 explainer                                           ]
```

Below 1024px: single column. Camera rail goes horizontal-scroll. Evidence timeline collapses to per-angle stacked rows.

## Component specs

### TopHUD (broadcast bar)

Sticky, 56px, blurred dark backdrop:
- Left: `BAY AREA · 2026` lockup with a small Pacific dot. Mono.
- Center: `MATCH REVIEW · {HH:MM:SS PT}` — live clock, mono, ink-2.
- Right: `● LIVE` (Pacific pulse) + system status pill (`pipeline · gemini → rocketride → gemma` in mono ink-3).

### Hero (idle only)

- Tiny eyebrow: `2026 · BAY AREA · MATCH OPERATIONS`
- Display: `VARIFY` — Space Grotesk 800, ~120px, ink, slight negative tracking.
- Subtitle: `AI Referee Assistant for Card Decisions` — Inter, ink-2.
- Card glyph anchored top-right: red over yellow, rotated, layered, real tactile feel (no emoji).

### Source picker

Two-column when room allows:
- **Reference incidents** (left) — the 3 preset rows. Each row: small thumbnail or icon block, title, subtitle, signal-color verdict pill. Active state: Pacific ring + soft pacific-soft background.
- **Upload custom clip** (right) — dashed perimeter card with `Drop clips into the booth`. Below: list of selected files as CAM 01 / CAM 02 stack with file size mono.

### Briefing pad (idle right column)

A passive panel that mirrors the VAR·AI agent voice in idle:
```
●  VAR·AI       STANDING BY
─────────────────────────────────────
Awaiting incident clip.
I'll review three things:
  · Contact frame
  · Player intent
  · Ball playability
```
Inter ink-2, with tabular bullets.

### Scanning state — replaces results panel

When `isAnalyzing`:
- Same panel chrome.
- Header: `●  VAR·AI · SCANNING FEEDS · {timer}`.
- Steps stack:
  - `01  GEMINI · video telemetry`
  - `02  ROCKETRIDE · incident report`
  - `03  GEMMA · contact severity`
  - `04  VAR·AI · brief assembly`
- Each step has a 2px progress bar (transform: scaleX). As each completes, the line gets a `✓` and a small annotation in amber: "contact frame at :07".

### Verdict banner

Full-width when results arrive. Composition:
- Left: tilted card glyph (yellow/red/pitch) in the signal color, ~96px tall, real tactile feel, slight shadow.
- Center: 
  - Eyebrow: `OFFICIAL DECISION`
  - Headline: Space Grotesk 700, ~44px, ink. Word the decision plainly: `Yellow Card`, `Red Card`, `No Card · Play On`.
  - Rule strip: `reckless` / `excessive force` / etc. as a chip in amber on bg-elev.
- Right: confidence dial (SVG arc 144px) with mono percentage centered.

### Confidence dial

SVG, 3/4 arc (270deg), 144×144. Track is `border-line` color. Fill stroke is Pacific. `stroke-linecap: round`. Animates `stroke-dashoffset` from full to `(1 - value)` on mount using `duration-700` + `ease-out-quart`. Mono percentage centered, weight 700.

### Camera rail (results)

Vertical stack of camera cards. Each card:
- Header: `CAM 0X` mono + filename truncated + size in mono.
- 16:9 thumbnail video element (the same uploaded file or a preset placeholder block).
- Below thumbnail: badges showing how many evidence pins reference this angle: `:07  :08  :09` mono in pacific-soft pills.
- Active highlight (synced with agent voice): 1px Pacific ring + soft amber outer glow.

If single clip, the rail collapses to a single, larger card.

### AgentPanel — VAR·AI brief

The signature surface.
- Header row: pulsing Pacific dot + `VAR·AI` (mono) + `LIVE ANALYSIS` cap label + elapsed timer + RE-BRIEF button on the right.
- Body: streamed brief. Inter 16/1.55. The visible portion ends with a blinking amber block cursor.
- Below body: a tabular list of "anchor points" — one row per sentence, with the angle it references (CAM 01) and the timestamp the sentence is anchored to.
- Re-brief button: small, mono, with a refresh glyph. Resets stream cursor to 0.

Synced highlight logic: as the streaming cursor crosses tokens like `CAM 01`, `Angle 1`, or the angle's label, the corresponding rail card gets the active ring until the next angle is mentioned.

### Evidence timeline

Full-width band beneath the main grid.
- One row per angle. Each row: CAM badge on the left, then a horizontal `bg-sunken` track. Pins at the moment timestamps.
- Time scale runs along the bottom: `:00 :02 :04 :06 :08 :10 :12`. Mono.
- Pins: 10px Pacific circles with a 1px outer ring. The pin synced with the streaming brief pulses amber.
- Pins are buttons. Click to seek the corresponding video to `timestampSeconds` (or parsed `timestamp`).

### Gemini observation

A subdued panel below the main grid:
- Eyebrow: `STEP 01 · GEMINI VISUAL EXTRACTION`
- Italic Inter, ink-2: the geminiSummary in quotes.

### Model trace

Anchored to the workspace bottom. Inline pipeline visualization:
```
GEMINI  ──▶  ROCKETRIDE  ──▶  GEMMA
3.5 Flash    orchestration    9B · GMI Cloud
```
Mono, ink-3, with thin lines (1px line color) connecting the stages.

### IFAB Law 12 explainer

Editorial 3-column reference panel:
- Eyebrow: `IFAB LAW 12 · CARD GUIDELINES`
- Three columns, each headed by a decision pill (No Card / Yellow / Red) in the signal color.
- Body copy ink-2, line length 60–70ch per column.

## Absolute compliance

- No side-stripe borders (the rule strip uses background tint + chip, not `border-left`).
- No gradient text. Decision text is solid signal color.
- No glassmorphism. Panels are flat tinted surfaces with 1px borders + inset highlight.
- No emoji in interface text. Real SVG glyphs only.
- No em dashes in copy. Hyphens or colons.
- Inter/Space Grotesk in display, Mono for numbers — never gimmick fonts.

## Accessibility

- All interactive elements: visible focus ring `outline-2 outline-pacific outline-offset-2`.
- Streaming brief: rendered into an `aria-live="polite"` region, with the full final text mirrored offscreen for screen readers (no partial-word announcements).
- Card signal colors paired with text labels — never color-only.
- Confidence dial has `aria-label="Confidence {value} percent"`.
- Min 4.5:1 contrast for ink-2 over the surface it sits on. Spot-check ink-3 stays at 3:1 minimum (used only for meta).

## Integration notes

- The frontend POSTs `video` as one or many files under the same field name. Backend signature is `@RequestParam("video") List<MultipartFile> videos`.
- Presets short-circuit the network call when the backend errors — they exist only because the backend has no mock mode.
- `EvidenceMoment.timestampSeconds` is preferred over parsing `timestamp` for video seeking.
- `keyMoments[]` is preferred over `evidence[]` when both are present; they may overlap.
- The frontend should be robust to `confidence` being either 0–1 or 0–100 (normalize on display).
