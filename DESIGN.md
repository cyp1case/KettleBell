# Kettlebell TV workout — design

Visual spec for `/player` (TV) and `/editor` (computer browser). Read it with `PLAN.md`.

**Rule:** this file decides how things look. `PLAN.md` decides what exists and how it behaves. If they disagree, follow `PLAN.md` and report the conflict. Do not add screens, controls, or labels because a mockup shows them unless `PLAN.md` allows them (see Open questions).

Mockups: the "Kettlebell App" design canvas, https://claude.ai/artifact/J8EWKrFnojREWpWLYmBto5 (private to the owner until shared). Everything needed to build is written below, so the canvas is reference only.

## Theme: Neon Iron

Near-black surfaces, one neon per phase, everything else quiet so the video and the rail own the screen.

### Colors

| Token | Hex | Use |
| --- | --- | --- |
| Void | `#08090B` | Page background |
| Carbon | `#121418` | Panels, status bar, rail, cards |
| Graphite | `#1C1F25` | Raised controls, empty rail track, chips |
| Line | `#2A2F37` | Borders and dividers |
| Mist | `#9AA3AF` | Secondary text, labels, disabled text |
| Chalk | `#F2F4F7` | Primary text |
| Volt | `#C8FF2E` | Work phase, Start, selected item, Finished |
| Ion | `#2EE6FF` | Next and Rest phases, rest times, TV ready, Skip, links |
| Pulse | `#FF3DCB` | Clip failed, Stop |
| Flare | `#FF2D55` | Reserved. Not used yet. Likely errors |
| Ember | `#FF7A1A` | Reserved. Not used yet. Likely warnings |

Text on a Volt fill is Void. Never put Chalk text on Volt.

Glow: a neon element may carry `box-shadow`/`text-shadow` of `0 0 24–34px` in its own color at 40% alpha. Only the active phase color glows. Panels, borders and text in Mist never glow.

### Type

Fonts: **Barlow Condensed** 600/700/800 for display, numbers, buttons and chips. **Barlow** 400/500/600 for body and labels. Both are SIL OFL. The app stays on the LAN, so bundle the `.woff2` files with the app; do not load them from Google Fonts at runtime. Fallbacks: `'Arial Narrow', sans-serif` and `system-ui, sans-serif`.

| Role | TV (1080p) | Editor |
| --- | --- | --- |
| Rail digits | Condensed 800, 150px | — (editor shows no clock) |
| Ready / Finished headline | Condensed 800, 220px, uppercase | — |
| Status bar value | Condensed 800, 64px, uppercase | — |
| Status bar label | Barlow 600, 24px, caps, 0.14em tracking, Mist | — |
| Rail label (Next / Work / Rest) | Barlow 700, 30px, caps, 0.18em, phase color | — |
| Video caption | Condensed 700, 36px, uppercase | — |
| Page title | — | Condensed 800, 36px, uppercase |
| Selected workout name | — | Condensed 800, 40px, uppercase |
| Row name | — | Condensed 700, 24px, uppercase |
| Buttons, chips, nav | — | Condensed 700–800, 17–26px, caps, 0.08em |
| Body | — | Barlow 400–600, 15px |
| Small label | — | Barlow 600, 12–13px, caps, 0.14em, Mist |

### Shape

Radii: 22px TV panels, 18px video region, 20px editor panels, 16px cards and large buttons, 12px small buttons and tiles, 999px chips and pills. Borders 1px Line; selected or active items use a 1.5px border in their phase color. Minimum click target 44px.

## TV — `/player`

Reference frame 1920×1080. Scale proportionally to the TV's viewport (size from `vw`/`vh` or a fixed 1920×1080 stage scaled to fit); keep the same proportions.

### Layout

- 32px outer padding, 28px gap between the status bar and the body.
- **Status bar:** full width, 156px tall, Carbon, three equal slots separated by Line dividers, 40px side padding. Slots left to right: exercise slot (label Now, Last, or Now with an em dash value), Up next, Circuit. No fourth slot.
- **Video region:** left and center. The YouTube iframe is 16:9 (1352×760 at 1080p), centered, 18px radius. Nothing overlaps it.
- **Caption:** directly under the iframe, left aligned to it: a 12px dot in the phase color, then the exercise whose clip is on screen.
- **Rail:** right column 360px wide, 32px from the video region, Carbon, 22px radius. Top to bottom: phase label, digits `M:SS`, then the column. The column is 132px wide, fills the remaining height, Graphite track, phase-color fill anchored to the bottom, height = remaining ÷ phase duration.

### Phase colors

| Phase | Rail label | Color | Exercise slot value color |
| --- | --- | --- | --- |
| Intro | Next | Ion | Em dash in Mist |
| Work | Work | Volt, with glow | Volt, with glow |
| Rest | Rest | Ion | Chalk |

Up next and Circuit values are always Chalk.

### Screens (canvas boards in flow order)

1. **Ready** — no status bar, no rail. Centered: kettlebell line icon in Ion, "READY" 220px in Ion with glow.
2. **Next (intro)** — Now —, Up next Swing, Circuit A 1 of 2. Swing how-to in the video. Rail: Next, Ion.
3. **Work** — Now Swing (Volt), Up next Squat, Circuit A 1 of 2. Swing song. Rail: Work, Volt.
4. **Rest between passes** — Last Squat, Up next Swing, Circuit A 2 of 2. Swing how-to. Rail: Rest, Ion.
5. **Finished** — no status bar, no rail, no video. Centered: check-circle icon in Volt, "FINISHED" 220px in Volt with glow, the workout name in Condensed 700 72px. Waits for Done.

Labels for every phase must match the normative timeline in `PLAN.md`.

### Overlays (inside the video region only)

The status bar and rail keep running underneath all three.

- **Tap once to allow sound** — the video region gets a 1.5px Ion border. Centered: speaker icon in Ion (110px), "TAP ONCE TO ALLOW SOUND" Condensed 800 72px in Chalk.
- **Clip ended** — the panel fully covers the iframe: Carbon fill, no border change, nothing from YouTube shows through. Centered: the exercise name Condensed 800 72px in Chalk, uppercase. No icon, no helper line.
- **Clip failed** — the video region gets a 2px Pulse border. Centered: alert-circle icon in Pulse, "CLIP FAILED" Condensed 800 72px in Pulse.

## Editor — `/editor`

Computer browser only. No phone layout. Fluid page, content max width 1400px, 32px side padding.

### Frame

- **Top bar:** kettlebell icon in Volt, "KETTLEBELL EDITOR" (Editor in Mist). Right: the TV status pill.
  - TV ready: Carbon pill, Line border, Ion dot, "TV ready".
  - Running: Volt border, Volt dot with glow, "Running on TV" in Volt.
- **Sidebar:** 200px. How-tos, Songs, Exercises, Circuits, Workouts as 48px nav items. Current item: Graphite fill with a 3px Volt bar on its left edge.

### Workouts page

Two columns under the page title: a compact list on the left (about 340–440px) and the selected workout's detail on the right (the rest of the width). They stack when the window is narrow.

- **List rows** stay short no matter how big a workout is. Each row: the name, the block sequence as chips (`A × 2`, `B × 1`, `A × 2`), and its **Start on TV** button on the row. Clicking the row selects it. Selected row: Graphite fill and a 1.5px Volt border.
- **Detail panel:** Carbon, 20px radius. Header: name, the block sequence as chips after the label "Runs", and an Edit button. Then each circuit in the workout once, in first-appearance order: "Circuit A", exercise count, "Rest 0:20" in Ion. Under it, its slots as a wrapping grid of tiles (min 150px wide): slot number in Mist, exercise name, work time in Volt. The panel scrolls inside itself (max height about 44rem) instead of growing the page.
- **Start on TV:** Volt fill, Void text. Disabled: Carbon fill, Line border, Mist text, with the reason in Mist ("A session is already on the TV").
- **+ New** button beside the title: Graphite, Line border.

### While running

Above the two columns, a session panel: Carbon with a 1.5px Volt border and a soft Volt glow. Left: "On the TV now" label, the workout name 48px in Volt, its block chips, one line in Mist. Right: **Pause** (Graphite, 72px tall), **Skip** (Ion outline), **Stop** (Pulse outline). The editor shows no countdown and no current exercise, because the player reports only ready, running or finished. All Start buttons are disabled; editing stays available.

### Not yet mocked

How-tos page (start and stop times), Songs page, Exercises page (picking a how-to and a song), Circuits page (slots, reordering, rest), delete confirmations, the editor's Finished state with Done, and refused-save messages. Use the tokens above for them.

## Open questions for the owner

Each needs a decision before the phase that builds it. Until decided, follow `PLAN.md` and leave the item out.

1. **Helper lines.** The mockups add short Mist lines that `PLAN.md` does not specify: Ready ("Start a workout from the editor on your computer."), Finished ("Press Done in the editor to return to Ready."), and one line under each overlay. Keep or remove? **Decided: removed.** No helper lines on the TV.
2. **Paused look on the TV.** `PLAN.md` only freezes the rail. A frozen rail can look like a hang. Add a "Paused" label in the rail?
3. **Pause or Resume in the editor.** The player reports only ready, running, finished, so the editor cannot know the session is paused. Proposed: add `paused` to what the player reports.
4. **Circuit naming.** The fixture circuit has no name; the mockups call it A.
5. **Fresh heartbeat.** `PLAN.md` says "a few seconds". Pick a number.
6. **Reserved colors.** Flare and Ember are unused until someone assigns them (for example Flare for clip failed and Ember for warnings, freeing Pulse).
