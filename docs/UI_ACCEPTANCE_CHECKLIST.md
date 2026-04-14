# UI Final Acceptance Checklist

## Layout & Hierarchy
- [ ] Desktop uses master-detail split (`~62/38`) and keeps focus on left panel.
- [ ] Mobile uses single-column flow with collapsible right monitor panel.
- [ ] No top/bottom black gutters or viewport gaps on common screen sizes.
- [ ] Top header, stepper, and content panel spacing follows consistent 8/12/16 rhythm.

## Stepper & Navigation
- [ ] Current step is visually strongest; completed steps are clickable.
- [ ] Unfinished steps are clearly disabled and not clickable.
- [ ] Small-screen stepper collapses to `Step x/4 + current title`.
- [ ] Keyboard focus ring is visible on stepper buttons.
- [ ] Progress fill animates via `transform` (scaleX), not layout thrashing `width`.

## Step 1 (Archive Sync)
- [ ] URL input text and placeholder remain readable in light/dark mode.
- [ ] Sync button state cycle works: default -> syncing -> synced.
- [ ] 1-second cooldown prevents premature step switch after sync success.
- [ ] "Reuse last URL" fills the previous successful URL correctly.

## Terminal Monitor
- [ ] Right panel uses dark terminal style with left-aligned data flow.
- [ ] Log tags render with semantic colors: `[DATA] [MATCH] [LOCAL] [SYNC]`.
- [ ] Log rows align in columns (time / tag / message).
- [ ] Logs auto-scroll to latest entries during updates.
- [ ] Logs/Metrics toggle works and keeps panel state stable (with subtle tab transition).
- [ ] Pulse strip and bottom runtime status (`Realtime_Active`, `NODE`, `LATENCY`) are visible.
- [ ] Under load (rapid ticker), UI stays responsive; burst lines do not over-remount motion nodes.

## Forms & Controls
- [ ] All form controls use compact rounded style (`radius-ui` / ~6px) consistently.
- [ ] Focus-visible states use brand ring (`ring-focus-brand` / secondary ring), not ad-hoc `primary-500`.
- [ ] Primary button hover has subtle lift/shadow feedback.
- [ ] Disabled controls are clearly distinguishable and non-interactive.

## Step 4 Editing & Export
- [ ] Editing script fields triggers "unsaved changes" notice.
- [ ] Copy Markdown clears unsaved state.
- [ ] Export PDF clears unsaved state when successful.
- [ ] Error states are readable and actionable (not silent fail).

## Visual Consistency
- [ ] Main text hierarchy uses semantic tokens (`text-on-surface`, `text-on-surface-variant`, `text-fg-subtle`).
- [ ] Card shadows use `shadow-elev-*` / `card-base` / `surface-panel` consistently.
- [ ] Chinese/English mixed labels follow one style pattern throughout.
- [ ] Terminal typography remains monospace and readable in both themes.

## Shell & Routes (Director)
- [ ] Sidebar lists Dashboard, Generator, Editor, Library, **Oracle** with clear active state.
- [ ] Header module chips (Wizard / Performance / Assets) reflect route and are navigable.
- [ ] Dashboard / Editor / Library demo pages match Generator visual language (noise, cards, spacing).

## Cinematic motion & a11y
- [ ] Page and panel transitions use consistent easing (`Director` curve) and short durations (~160–420ms).
- [ ] Avoid blanket `transition-all` on large surfaces; prefer property-scoped transitions.
- [ ] With **prefers-reduced-motion**: stepper scale hints off; terminal SVG loop static; ping ring suppressed; Framer entrances shortened/disabled.
- [ ] No essential information is conveyed by motion alone (motion is enhancement only).
