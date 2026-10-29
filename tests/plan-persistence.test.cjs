const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { context, source, include, day, rule, due, dates, isolatedFunctions, responseHarness } = require("./helpers/app-harness.cjs");

test("existing plans and backup round trips preserve payment bounds", () => {
  const old = context.normalizeState({ startDate: "2026-10-16", recurringRules: [
    rule({ startDate: undefined, limitType: "none" }),
    rule({ startDate: undefined, limitType: "count", instanceLimit: 3 }),
  ]});
  assert.equal(old.recurringRules[0].startDate, "");
  assert.equal(old.recurringRules[1].startDate, "2026-10-16");
  const restored = context.normalizeState(JSON.parse(JSON.stringify({
    startDate: "2026-10-16", recurringRules: [rule()],
  })));
  assert.equal(restored.recurringRules[0].startDate, "2026-12-04");
  assert.equal(restored.recurringRules[0].endDate, "2026-12-25");
});

test("restore rejects unrelated or newer JSON without normalizing it to an empty plan", () => {
  for (const payload of [{}, [], { hello: "world" }, { data: { startingBalance: "bad", recurringRules: [] } }, { startingBalance: 0, recurringRules: [], projectionDays: 1000000000 }, { startingBalance: 0, recurringRules: [], startDate: "2026-02-30" }])
    assert.throws(() => context.readBackupState(payload), /not a valid/);
  const restored = context.readBackupState({ version: 3, data: {
    startDate: "2026-12-18", startingBalance: 1000, recurringRules: [rule()],
  }});
  assert.equal(restored.recurringRules[0].startDate, "2026-12-04");
  assert.equal(restored.recurringRules[0].endDate, "2026-12-25");
  assert.throws(() => context.readBackupState({ version: 99, data: {
    startingBalance: 1000, recurringRules: [],
  }}), /newer app version/);
});

test("storage failure is reported without interrupting the in-memory plan", () => {
  let hidden = true;
  const message = { classList: { add() { hidden = true; }, remove() { hidden = false; } } };
  context.document = { querySelector() { return message; } };
  context.window = { localStorage: { setItem() { throw new Error("quota"); } } };
  const plan = { startingBalance: 1000, recurringRules: [rule()] };
  assert.equal(context.saveState(plan), false);
  assert.equal(hidden, false);
  assert.equal(plan.recurringRules.length, 1);
  let stored;
  context.window.localStorage.setItem = (key, value) => { stored = JSON.parse(value); };
  assert.equal(context.saveState(plan), true);
  assert.equal(hidden, true);
  assert.equal(stored.data.recurringRules[0].endDate, "2026-12-25");
});

test("local plan save time records material edits without relabeling legacy or cosmetic saves", () => {
  let now = Date.parse("2026-10-28T22:00:00Z");
  class SavedDate extends Date { constructor(...args) { super(...(args.length ? args : [now])); } }
  const original = { startingBalance: 1000, lastRefreshDate: "2026-10-28", projectionDays: 30,
    thresholds: { red: 100, yellow: 200, green: 300 }, skippedInstances: {}, recurringRules: [] };
  let stored = JSON.stringify({ version: 3, exportedAt: "2026-10-28T20:00:00Z", data: original });
  const isolated = isolatedFunctions("  function saveState(state)", "  function readBackupState(", {
    Date: SavedDate, STORAGE_KEY: "plan", STORAGE_VERSION: 3, normalizeState: value => value,
    repository: require("../planRepository.js").create({
      storage: { getItem: () => stored, setItem: (key, value) => { stored = value; } },
      planData: { version: 3, normalizeState: value => value },
      fingerprint: require("../driveSync.js").fingerprint, now: () => new SavedDate().toISOString(),
    }),
    window: { DriveSync: require("../driveSync.js"), localStorage: { getItem: () => stored, setItem: (key, value) => { stored = value; } } },
    document: { querySelector: () => null },
  });
  assert.equal(isolated.saveState(original), true);
  assert.equal(JSON.parse(stored).planSavedAt, null, "old save times are not invented");
  const edited = { ...original, startingBalance: 1200 };
  assert.equal(isolated.saveState(edited), true);
  const stamp = JSON.parse(stored).planSavedAt;
  assert.equal(stamp, "2026-10-28T22:00:00.000Z");
  now += 60000;
  isolated.saveState({ ...edited, theme: "dark", rulesCollapsed: true });
  assert.equal(JSON.parse(stored).planSavedAt, stamp);
  isolated.saveState({ ...edited, skippedInstances: { "payment:2026-10-29": true } });
  assert.equal(JSON.parse(stored).planSavedAt, "2026-10-28T22:01:00.000Z");
});

test("local backup download stays quiet, preserves its URL and UTC filename, and reports failures", () => {
  let revoked = 0, clicked = 0, removed = 0, closed = 0, status = "", failure = "", failureTitle = "", filename, payloadAt;
  const timers = [];
  const fixedDate = new Date("2026-10-18T19:20:21.123Z");
  class ExportDate extends Date { constructor() { super(fixedDate); } }
  const ui = isolatedFunctions("  function downloadLocalBackup()", "  exportDataButton.addEventListener", {
    Date: ExportDate, Blob, canDownloadPlan: () => true,
    exportFilename: value => { filename = context.exportFilename(value); return filename; },
    backupPayload: value => { payloadAt = value.toISOString(); return "{}"; },
    document: { createElement: () => ({ addEventListener() {}, click() { clicked++; }, remove() { removed++; } }), body: { appendChild() {} } },
    window: { URL: { createObjectURL: () => "blob:backup", revokeObjectURL: () => { revoked++; } }, setTimeout: (fn, delay) => timers.push({ fn, delay }) },
    closeDataMenu: () => { closed++; },
    showDataStatus: message => { status = message; }, showDataIssue: (message, title) => { failure = message; failureTitle = title; },
  });
  ui.downloadLocalBackup();
  assert.equal(clicked, 1); assert.equal(removed, 1); assert.equal(revoked, 0);
  assert.equal(payloadAt, fixedDate.toISOString());
  assert.equal(filename, "am-i-going-broke-2026-10-18T19-20-21-123Z.json");
  assert.equal(status, ""); assert.equal(closed, 1); assert.equal(failure, "");
  assert.equal(timers[0].delay, 60000); timers[0].fn(); assert.equal(revoked, 1);
  ui.window.URL.createObjectURL = () => { throw new Error("blocked"); };
  ui.downloadLocalBackup();
  assert.match(failureTitle, /download/);
  assert.match(failure, /check Downloads.*plan is unchanged/);
});
