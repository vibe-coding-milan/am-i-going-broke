# Forecast response behavior

The header answers “Am I Going Broke?” with the approved cheeky inventory in `content/projectionAnswerCopy.js`. These are presentation changes; forecast calculations, categories, and persisted plan data are unchanged.

## Selection and playback

- Select from the projected-below-zero pool first; otherwise select by Healthy, Building, Stable, Tight, or At Risk. No-data plans have a neutral prompt without animation.
- Pick once on page load and when the category changes. A valid forecast edit within the same category repeats the same phrase, rather than shuffling on every edit.
- Show one, two, then three dots over one second, then reveal one character every 40 milliseconds. The answer's completed layout is reserved throughout playback.
- Forecast updates cancel old timers. Changes to cash, horizon, payment rules, exclusions, or cushion thresholds can replay the sequence. Cosmetic changes and resizing do not.
- Display immediately for reduced motion; switching reduced motion on during playback completes the current answer immediately. Screen readers receive only the completed response and its forecast-period context.

## Layout and scope

On desktop, the response sits beside the question with aligned text baselines when enough space is available. On mobile, it wraps beneath the question at the same left edge. Keep the logo, headline, Data menu, chart, and payment editing usable. There is no underline or additional preference control.

## Validation

The project check runs 18 regressions in each of two time zones, including timing, interrupted updates, zero-crossing priority, stable phrase selection, and reduced motion. Manual browser checks cover phone and desktop layout and valid edit replay. Actual Pixel Firefox, Android Chrome, iOS Safari, and screen-reader announcements still need device verification.
