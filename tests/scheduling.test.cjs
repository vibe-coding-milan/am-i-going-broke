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
