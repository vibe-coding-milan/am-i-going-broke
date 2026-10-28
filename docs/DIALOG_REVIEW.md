# Data dialog layout review — October 28, 2026

Prepared locally; not published or deployed.

## Confirmed issues and fix

The owner reported text spilling outside the pills in Update Drive backup. Reproduced using the current app with simulated Drive responses: the desktop flex row compressed Download backup first to 175px with 190px of content, and Update backup to 126px with 132px of content. The shared button rule prohibited wrapping. A simulated long API message also exceeded its text column and was clipped horizontally.

Use a two-column action grid at every width, with Download backup first spanning both columns and Cancel/primary action below. Permit button labels and message text to wrap. Bound the dialog to the available viewport width and height, with vertical scrolling for long messages and short screens. Refresh stylesheet URLs on all three HTML pages.

## Flow checks

1. **Update Drive backup — fixed.** Reproduced the owner's exact reported layout; corrected pills contain their labels. Drive responses and access tokens were simulated locally; no real Google files were changed.
2. **Reset confirmation — pass for layout and cancellation.** Inspected without confirming Clear plan. Cancel and Escape dismiss and restore the Data menu; button-to-button Tab/Shift+Tab navigation was verified.
3. **File import — pass for invalid-file error and restore-preview layout.** An unrelated JSON file opens the error dialog. A fictional valid backup opens the preview with balance/date/timezone and replacement warning. Cancel preserves the current plan; no real plan was restored.
4. **Long Drive error — fixed.** A simulated error containing a long unbroken reference now wraps inside the message column. In a short landscape viewport the dialog scrolls; focusing Got it brings the action into view.

## Responsive and theme checks

In-app browser: 1280×720 desktop, 768×1024 tablet, 390×844 and 320×568 phones, and 568×320 landscape. Final overwrite-dialog measurements show equal scroll/client widths for the dialog and all three buttons at each size. Buttons are at least 44px high and grow for wrapped labels. Inspected light and dark themes. A local fixture with a 200% root font size verifies wrapping under enlarged text; this is not an OS text-setting or browser-zoom certification.

Local screenshots and detailed measurements are retained in the ignored dialog audit folder. Fixtures use the real application HTML/JavaScript/CSS with local-only simulated Drive authorization/responses and fictional backup files.

## Validation limits

Syntax, 68 local link checks, and 33 regressions in each of two time zones passed (66 total). These regressions cover scheduling and existing backup behaviors; visual layout was checked separately in the browser.

Physical Android/iOS devices, mobile virtual keyboards, browser chrome changes, screen readers, and full accessibility compliance remain unverified. Firefox compatibility testing was interrupted by concurrent user activity and is not claimed. Google's consent/error screens are outside the app's shared dialog component. Real OAuth, live Drive transfers, download failures, and browser-storage quota failures were not forced during this layout review.
