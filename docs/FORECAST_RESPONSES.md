# Forecast response behavior

The header answers “Am I Going Broke?” with the approved cheeky inventory in `content/projectionAnswerCopy.js`. These are presentation changes; forecast calculations, categories, and persisted plan data are unchanged.

## Selection and playback

- Select from the projected-below-zero pool first; otherwise select by Healthy, Building, Stable, Tight, or At Risk. No-data plans have a neutral prompt without animation.
- Pick on page load, valid forecast edits, and explicit Update forecast actions. Choose from the matching scenario and avoid the immediately previous phrase when alternatives exist. Cosmetic updates do not reshuffle the phrase.
- Show one, two, then three dots over one second, then reveal one character every 40 milliseconds. The answer's completed layout is reserved throughout playback.
- Forecast updates cancel old timers. Changes to cash, horizon, payment rules, exclusions, or cushion thresholds can replay the sequence. Cosmetic changes and resizing do not.
- Display immediately for reduced motion; switching reduced motion on during playback completes the current answer immediately. Screen readers receive only the completed response and its forecast-period context.

## Layout and scope

The response uses the exact same font, weight, and responsive size as the question. Both share one inline text flow, wrapping naturally across subsequent lines as needed. The visible typed prefix and hidden untyped suffix reserve the completed layout. Keep the logo, headline, Data menu, chart, and payment editing usable. Affirmative zero-crossing answers use coral/red, negative answers use purple in dark mode and blue in light mode, and thinking dots remain neutral. Outcome words remain explicit so meaning does not depend on color. There is no underline or additional preference control.

## Validation

The project check runs 18 regressions in each of two time zones, including timing, interrupted updates, zero-crossing priority, scenario-specific randomization and unchanged-render stability, and reduced motion. Manual browser checks cover phone and desktop layout and valid edit replay. Actual Pixel Firefox, Android Chrome, iOS Safari, and screen-reader announcements still need device verification.
