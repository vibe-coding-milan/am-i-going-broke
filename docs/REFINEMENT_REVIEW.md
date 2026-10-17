# Refinement review — October 16, 2026

Status: implemented following user approval. The original review is retained below; the implementation supersedes the slider, balance-date control, and header treatment from the first mobile refresh.

The user requested a narrower scope after inspecting the mobile refresh. The priority is a forward-looking forecast with fewer visible controls, direct chart interaction, and a clear lowest balance date. Desktop remains a guardrail.

## Captured surfaces

1. Desktop forecast at 1280 × 900: functional, but the slider and summary add weight; cushion fields read as a separate control group.
2. Mobile forecast at 393 × 852: working responsive layout, but summary metrics consume substantial space above the chart.
3. Mobile transactions at 393 × 852: readable, but balance pills and the occurrence control compete with the payment amount.

Screenshots are saved in the session's mobile-refresh/refinement-audit artifact directory as 01-desktop.png, 02-mobile.png, and 03-transactions.png.

## Recommended next pass

- Replace the visible slider and previous/next buttons with desktop hover and mobile tap inspection directly on the chart. Tapping already exists; hover does not. Preserve a focusable chart with keyboard day navigation and an accessible date/balance readout. Avoid blocking vertical page scrolling.
- Keep lowest balance and its date persistent. Make net change secondary; put ending balance in inspection. Reduce summary height rather than squeezing the plot.
- Remove the user-selectable balance date and restore today-based forecasting. Keep payment start/end dates: these describe expected cash movements, including a final paycheck after work ends. Existing stored plans need an explicit, safe transition so an old balance is not silently represented as today's confirmed balance.
- Group the cushion visibility switch and target fields visibly, with average and high/low as neighboring display options. Keep target fields available when their chart overlay is off.
- Refine narrow transaction rows: small date, name and signed amount aligned, quieter running balance, consistent occurrence-control placement. Retain the desktop table.
- Shorten the pagination action to “Show more”; place the visible/total count outside the button. The current long label and shared nowrap button styling can overflow. Exact clipping was reported by the user but was not reproduced in this capture because all 22 rows were already revealed.
- Replace the long handwritten answer with a brief “Nope.” or “Yep.” and remove the explanatory hero paragraph. Retain current health categories. Answer should refer only to whether the entered forecast drops below zero within the selected horizon; no answer before adequate data. Type once, reserve layout space, honor reduced motion, and expose complete text to assistive technology. Do not cycle synonyms or replay on each edit.

## Limits and scope

This is a focused layout and implementation review, not full accessibility or device certification. The captures do not verify actual Pixel Firefox, iOS Safari, screen readers, or touch scrolling. No new categories, analytics, integrations, policy changes, or financial calculations are proposed. Keep existing safeguards and backup compatibility.

## Implementation validation

- All 16 regression tests pass in America/New_York and Pacific/Auckland; syntax, local links, and whitespace checks pass.
- Desktop keyboard inspection reaches the final date and shows the exact ending balance without altering calculations.
- Phone review at 393 pixels confirms a smaller summary and more space for the chart. The Show more button fits at 320 pixels with its count displayed separately.
- Last-confirmed balance dates and count-limited payment anchors survive normalization to a today-based forecast.
- Header tests distinguish zero crossing from cushion classification and verify that updates do not replay the typing effect.
- Actual Pixel Firefox, Chrome Android, Safari iOS, assistive technology, and Google Drive authorization/transfers remain unverified in this session.
