# Chart options refinement plan — October 17, 2026

Status: implemented following the final user-approved layout. Earlier alternatives are retained below as review history; the implementation section supersedes them.

## Evidence

The user-provided desktop screenshot shows Average/High-low grouped at the left, a plain-looking Cushion label/help control, and three target fields stretched across the remaining width.

In the local sample plan, clicking Cushion successfully disabled and re-enabled its chart lines. The reported complete inability to toggle was not reproduced. The unchecked state loses its visible control boundary, making it look like a heading. Browser measurements also show the invisible checkbox is 44px high within a 30px visible label, offset by default margins and extending roughly 6px into the target-form area. Normalize the checkbox hit area and provide an explicit off state.

## Recommended organization

Keep one compact toolbar immediately below the graph. Within it, place a cushion group first: Cushions toggle, help button, then Red/Yellow/Green amount fields. Place Average and High/low in a neighboring overlay group on the same baseline, with a modest gap or divider. Keep the toolbar aligned to the chart container and let related groups wrap deliberately on narrower screens.

- Use the same height, border treatment, checked indicator, focus treatment, and visible off state for all three display toggles.
- Give each amount field an intrinsic/fixed width around 110–130 CSS pixels, sufficient for formatted currency, instead of stretching each column to fill all available space.
- Keep the fields in Red, Yellow, Green order, with restrained existing semantic colors and explicit labels.
- Place the help control immediately after Cushions, with concise help covering the targets and the fact that hiding chart lines does not change their role in the forecast classification.
- Retain one master cushion visibility toggle. Keep editing and visibility separate: clicking a numeric field should only edit it. Do not add individual target toggles in this pass.
- Keep targets editable when lines are hidden, preserve their values and current validation, and avoid moving controls into a sidebar or overlay that reduces or obscures the graph.

## Responsive behavior

Desktop: compact adjacent groups; no equal-width expansion across the entire panel.
Narrow tablet/phone: wrap into clear rows within the existing Chart options disclosure. Keep all three target fields together when they fit and wrap cleanly at the smallest widths. Preserve touch targets, keyboard access, and a tap/focus-accessible help control.

## Proposed verification

Check every toggle on/off by pointer and keyboard, focused field editing without accidental toggling, valid/invalid target ordering, persistence, light/dark modes, and phone/tablet/desktop widths. Confirm visibility changes do not alter balances, categories, or target values. Investigate the reported desktop issue without claiming the user's exact environment was reproduced.

## Final implementation

The agreed order is Average, High/low, Cushions, Red, Yellow, Green. All three toggles sit directly adjacent with identical 52px controls, visible native checkboxes, and explicit checked/unchecked borders and backgrounds. Their checkbox hit areas stay inside their labels.

The three target amounts retain the existing tinted, two-line label/value cards, with a text cursor, compact 112px desktop widths, and 52px overall heights. Their distinct amount-field appearance is preserved rather than restyled as plain inputs. Their top/bottom edges align exactly with the toggle buttons, including when ordering validation appears. The help icon and tooltip were removed as requested. No independent per-color toggles were added.

On narrow screens, the toggles and amount fields form two aligned three-column rows. Values remain editable while cushion lines are off; toggling visibility does not alter targets, health categories, or financial calculations.

## Verification

- Pointer and Space-key checks for all three toggles, including the visible off state and contained checkbox hit areas.
- Typed red-target edit persisted after reload while cushions stayed off; restored the sample's original settings afterwards.
- Invalid ordering still reports the existing error without moving the toggles out of alignment.
- Source syntax, 47 local links, and 21 regressions in each of two time zones passed. Browser checks covered 320px, 393px, and 1280px widths, with no horizontal overflow; light and dark themes retained the target colors. Physical-device and assistive-technology certification are outside this pass.

## Follow-up: connected cushion controls

User feedback supersedes the visible-checkbox treatment above: the native checkboxes are now visually hidden within their controls, preserving keyboard and screen-reader semantics without displaying checkmarks. The desktop toolbar is centered. A shared container groups Cushions with all three target fields; on phones the Cushions control connects to the target row beneath the three aligned toggles. The target fields retain their compact tinted two-line appearance and operate together under one visibility toggle.
