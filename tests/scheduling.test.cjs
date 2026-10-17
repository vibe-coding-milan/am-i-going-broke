const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

// Exercise the actual functions without starting the browser UI or changing saved data.
const source = fs.readFileSync(require("node:path").join(__dirname, "../app.js"), "utf8");
const context = vm.createContext({ Date, Intl, console });
function include(from, to) {
  const start = source.indexOf(from);
  const end = source.indexOf(to, start);
  assert.ok(start >= 0 && end > start, "Test bridge must match app function boundaries");
  vm.runInContext(source.slice(start, end), context);
}
include("  function todayInputValue()", "  function saveState(state)");
include("  function parseNumericValue(", "  function loadState()");
include("  function isRuleBaseDueOnDate(", "  function interpolateColor(");
include("  function ruleInputError(", "  function validateRuleField(");
include("  function flattenProjectionRows()", "  function evaluateProjectionHealth(");

const day = value => context.parseInputDate(value);
const rule = overrides => ({
  id: "contract", name: "Contract paycheck", active: true, direction: "credit",
  amount: 1000, scheduleType: "weekly", dayOfWeek: 5,
  startDate: "2026-12-04", limitType: "date", endDate: "2026-12-25",
  ...overrides,
});
const due = (item, date, start = "2026-10-16") =>
  context.isRuleDueOnDate(item, day(date), day(start));
const dates = (item, start, days) => {
  const result = context.generateProjection({
    startDate: start, projectionDays: days, startingBalance: 0, recurringRules: [item],
  });
  return Array.from(result).flatMap(d => Array.from(d.items).map(i => i.dateKey));
};

test("weekly income uses inclusive first and last eligible payment dates", () => {
  assert.equal(due(rule(), "2026-11-27"), false);
  assert.equal(due(rule(), "2026-12-04"), true);
  assert.equal(due(rule(), "2026-12-25"), true);
  assert.equal(due(rule(), "2027-01-01"), false);
});
test("two contracts leave an unpaid gap and resume in the new year", () => {
  const first = rule();
  const second = rule({ id: "next", startDate: "2027-01-15", endDate: "2027-03-26" });
  assert.deepEqual(dates(first, "2026-12-18", 36), ["2026-12-18", "2026-12-25"]);
  assert.deepEqual(dates(second, "2026-12-18", 36), ["2027-01-15", "2027-01-22"]);
});
test("monthly expenses start on schedule and clamp to the final day of short months", () => {
  const item = rule({ direction: "debit", scheduleType: "monthly", dayOfMonth: 31,
    startDate: "2027-01-15", endDate: "2027-02-28" });
  assert.deepEqual(dates(item, "2027-01-01", 90), ["2027-01-31", "2027-02-28"]);
});
test("biweekly cadence survives fall and spring daylight-saving changes", () => {
  const fall = rule({ scheduleType: "biweekly", scheduleDate: "2026-10-23",
    startDate: "2026-10-23", endDate: "2026-11-30" });
  assert.deepEqual(dates(fall, "2026-10-16", 46), ["2026-10-23", "2026-11-06", "2026-11-20"]);
  const spring = rule({ scheduleType: "biweekly", scheduleDate: "2027-03-05",
    startDate: "2027-03-05", endDate: "2027-04-02" });
  assert.deepEqual(dates(spring, "2027-03-01", 35), ["2027-03-05", "2027-03-19", "2027-04-02"]);
});
test("daily iteration never duplicates a local date at daylight-saving boundaries", () => {
  for (const start of ["2026-10-16", "2027-03-01", "2026-09-15", "2027-03-25"]) {
    const keys = Array.from({ length: 45 }, (_, i) =>
      context.dateInputValue(context.addDays(day(start), i)));
    assert.equal(new Set(keys).size, 45);
    for (let i = 1; i < keys.length; i++)
      assert.equal(context.calendarDayNumber(day(keys[i])) - context.calendarDayNumber(day(keys[i - 1])), 1);
  }
});
test("rent is charged only once on November 1", () => {
  const rent = rule({ scheduleType: "monthly", dayOfMonth: 1,
    startDate: "", limitType: "none", direction: "debit" });
  assert.deepEqual(dates(rent, "2026-10-16", 90), ["2026-11-01", "2026-12-01", "2027-01-01"]);
});
test("count-limited recurring items finish and do not restart after forecast refresh", () => {
  const item = rule({ startDate: "2026-10-23", limitType: "count", instanceLimit: 3 });
  assert.deepEqual(dates(item, "2026-10-16", 60), ["2026-10-23", "2026-10-30", "2026-11-06"]);
  assert.deepEqual(dates(item, "2026-11-01", 40), ["2026-11-06"]);
  assert.deepEqual(dates(item, "2026-11-07", 40), []);
});
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
test("one-time dates are independent of hidden recurring bounds", () => {
  const item = rule({ scheduleType: "adhoc", scheduleDate: "2027-01-08" });
  assert.deepEqual(dates(item, "2027-01-01", 20), ["2027-01-08"]);
});
test("invalid date ranges, negative expenses and malformed values are rejected", () => {
  assert.ok(context.ruleInputError(rule(), "startDate", "2026-12-26"));
  assert.ok(context.ruleInputError(rule(), "endDate", "2026-12-01"));
  assert.ok(context.ruleInputError(rule(), "startDate", "2026-02-30"));
  for (const value of ["-50", "abc", "", "1.234", "1-2"])
    assert.ok(context.ruleInputError(rule(), "amount", value));
  for (const value of ["0", "1250.50", "$1,250.50", ".50"])
    assert.equal(context.ruleInputError(rule(), "amount", value), "");
  assert.ok(context.ruleInputError(rule(), "dayOfMonth", "32"));
  assert.ok(context.ruleInputError(rule(), "instanceLimit", "0"));
  assert.equal(context.ruleInputError(rule(), "endDate", "2026-12-04"), "");
});
test("ledger balances, scenario exclusions and chart day keys agree", () => {
  context.state = { startDate: "2026-12-18", projectionDays: 40, startingBalance: 100,
    recurringRules: [rule()], skippedInstances: { "contract::2026-12-25": true } };
  const rows = context.flattenProjectionRows();
  assert.equal(rows.at(-1).balance, 1100);
  const points = context.projectionPointsFromRows(rows);
  assert.equal(points.at(-1).balance, 1100);
  assert.equal(points.find(p => p.date === "2026-12-25").balance, 1100);
});

include("  function readBackupState(", "  function backupPayload(");
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

test("red threshold equality matches chart and table danger boundaries", () => {
  const health = require("../projectionHealth.js");
  const result = health.evaluateProjectionHealth(
    [{ date: "2026-12-18", balance: 1000 }, { date: "2026-12-19", balance: 2000 }],
    { redLimit: 1000, yellowLimit: 2500, greenLimit: 5000 });
  assert.equal(result.status, "At Risk");
});

include("  function saveState(state)", "  function readBackupState(");
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

test("today-based forecasts retain the balance confirmation date and original count anchor", () => {
  const saved = context.normalizeState({ startDate: "2026-01-01", lastRefreshDate: "2026-01-01",
    startingBalance: 750, recurringRules: [rule({ startDate: "", limitType: "count", instanceLimit: 3 })] });
  assert.equal(saved.startDate, context.todayInputValue());
  assert.equal(saved.lastRefreshDate, "2026-01-01");
  assert.equal(saved.startingBalance, 750);
  assert.equal(saved.recurringRules[0].startDate, "2026-01-01");
  assert.equal(context.normalizeState({ startDate: "2099-01-01" }).startDate, context.todayInputValue());
});

// Simulated time checks the real response component without waiting or touching browser data.
function responseHarness(reduced = false) {
  let now = 0, nextId = 0;
  const timers = new Map();
  const children = {};
  const element = { className: "", attrs: {}, innerHTML: "",
    setAttribute(key, value) { this.attrs[key] = value; },
    querySelector(selector) { return children[selector] ||= { textContent: "" }; } };
  const motion = { matches: reduced, addEventListener(type, callback) { this.change = callback; } };
  const headerContext = vm.createContext({
    Math: Object.assign(Object.create(Math), { random: () => 0 }),
    matchMedia: () => motion,
    setTimeout(callback, delay) { const id = ++nextId; timers.set(id, { callback, at: now + delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
  });
  for (const file of ["content/projectionAnswerCopy.js", "components/projectionAnswer.js"])
    vm.runInContext(fs.readFileSync(require("node:path").join(__dirname, "..", file), "utf8"), headerContext);
  return { element, motion, timers,
    header: headerContext.ProjectionAnswer.create(element),
    visual: () => children[".projection-answer-text"].textContent,
    announcement: () => children[".projection-answer-announcement"].textContent,
    advance(milliseconds) {
      const target = now + milliseconds;
      while (true) {
        const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > target) break;
        now = next[1].at; timers.delete(next[0]); next[1].callback();
      }
      now = target;
    },
  };
}

test("response thinks for a second, types at a readable pace, and announces only the complete answer", () => {
  const h = responseHarness();
  h.header.update({ hasProjectionData: false });
  assert.equal(h.visual(), "Let's see the numbers.");
  assert.equal(h.timers.size, 0);
  h.header.update({ hasProjectionData: true, status: "At Risk", dropsBelowZero: false, forecastKey: "first" });
  assert.equal(h.visual(), ".");
  h.advance(666);
  assert.equal(h.visual(), "...");
  assert.equal(h.announcement(), "");
  h.advance(374);
  assert.equal(h.visual(), "N");
  assert.equal(h.element.attrs["aria-busy"], "true");
  h.advance(10000);
  assert.equal(h.visual(), "Not yet. Too close, babe.");
  assert.match(h.announcement(), /^Not yet.*selected forecast period/);
  assert.equal(h.element.attrs["aria-busy"], "false");
});

test("new edits replace unfinished responses; unchanged renders do not replay or reshuffle", () => {
  const h = responseHarness();
  h.header.update({ hasProjectionData: true, status: "Healthy", forecastKey: "one" });
  h.advance(1160);
  assert.equal(h.visual(), "Nope");
  h.header.update({ hasProjectionData: true, status: "Healthy", dropsBelowZero: true, forecastKey: "two" });
  assert.equal(h.visual(), ".");
  h.advance(10000);
  assert.equal(h.visual(), "Yep. Have you considered a life of crime?");
  h.header.update({ hasProjectionData: true, status: "Healthy", dropsBelowZero: true, forecastKey: "two" });
  assert.equal(h.timers.size, 0);
  h.header.update({ hasProjectionData: true, status: "Healthy", dropsBelowZero: true, forecastKey: "three" });
  assert.equal(h.visual(), ".");
  h.advance(10000);
  assert.equal(h.visual(), "Yep. Have you considered a life of crime?");
});

test("reduced motion skips both effects and can finish a response already in progress", () => {
  const h = responseHarness(true);
  h.header.update({ hasProjectionData: true, status: "Tight", forecastKey: "one" });
  assert.match(h.visual(), /^Not yet\./);
  assert.equal(h.timers.size, 0);
  h.motion.matches = false;
  h.header.update({ hasProjectionData: true, status: "Healthy", forecastKey: "two" });
  assert.equal(h.visual(), ".");
  h.motion.matches = true; h.motion.change();
  assert.equal(h.visual(), "Nope. Actually, you can take me out to dinner.");
  assert.equal(h.timers.size, 0);
});
