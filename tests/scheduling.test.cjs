const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { context, source, include, day, rule, due, dates, isolatedFunctions, responseHarness } = require("./helpers/app-harness.cjs");

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

test("red threshold equality matches chart and table danger boundaries", () => {
  const health = require("../projectionHealth.js");
  const result = health.evaluateProjectionHealth(
    [{ date: "2026-12-18", balance: 1000 }, { date: "2026-12-19", balance: 2000 }],
    { redLimit: 1000, yellowLimit: 2500, greenLimit: 5000 });
  assert.equal(result.status, "At Risk");
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

test("whole-item exclusions remain in the ledger without changing balances, including count limits", () => {
  const inactive = rule({ active: false, startDate: "2026-12-04", limitType: "count", instanceLimit: 2 });
  context.state = { startDate: "2026-12-01", projectionDays: 30, startingBalance: 100,
    recurringRules: [inactive], skippedInstances: { "contract::2026-12-04": true } };
  let rows = context.flattenProjectionRows();
  assert.deepEqual(Array.from(rows.filter(r => r.type === "item"), r => r.dateKey), ["2026-12-04", "2026-12-11"]);
  assert.ok(rows.slice(1).every(r => r.skipped && r.wholeExcluded && r.balance === 100));
  inactive.active = true;
  rows = context.flattenProjectionRows();
  assert.equal(rows[1].skipped, true, "independent single-payment exclusion survives re-enabling parent");
  assert.equal(rows[2].skipped, false);
  assert.equal(rows.at(-1).balance, 1100);
});

test("excluded one-time items stay visible outside the window without affecting its forecast", () => {
  context.state = { startDate: "2026-12-01", projectionDays: 30, startingBalance: 100,
    recurringRules: [rule({ active: false, scheduleType: "adhoc", scheduleDate: "2027-01-10" })], skippedInstances: {} };
  const rows = context.flattenProjectionRows();
  assert.equal(rows.at(-1).outsideWindow, true);
  assert.equal(rows.at(-1).wholeExcluded, true);
  assert.equal(rows.at(-1).balance, 100);
  assert.ok(context.projectionPointsFromRows(rows).every(point => point.balance === 100));
});

test("blank optional dates impose no bounds and incomplete date/count schedules invent no dates", () => {
  const item = rule({ startDate: "", endDate: "", limitType: "none" });
  assert.deepEqual(dates(item, "2026-12-01", 14), ["2026-12-04", "2026-12-11"]);
  item.limitType = "date";
  assert.deepEqual(dates(item, "2026-12-01", 14), []);
  item.limitType = "count";
  item.pendingSchedule = true;
  assert.deepEqual(dates(item, "2026-12-01", 14), []);
  const saved = context.normalizeState({ recurringRules: [item], startingBalance: 100 });
  assert.equal(saved.recurringRules[0].startDate, "");
  assert.equal(saved.recurringRules[0].endDate, "");
  item.scheduleType = "biweekly";
  item.scheduleDate = "2026-12-04";
  item.instanceLimit = 2;
  assert.deepEqual(dates(item, "2026-12-01", 60), ["2026-12-04", "2026-12-18"]);
  assert.deepEqual(dates(item, "2026-12-19", 60), []);
  item.scheduleDate = "";
  assert.deepEqual(dates(item, "2026-12-01", 60), []);
  assert.equal(context.normalizeState({ recurringRules: [item] }).recurringRules[0].scheduleDate, "");
});

test("manual order stays within a direction and preserves same-day calculations through backup restoration", () => {
  const plan = context.normalizeState({ startDate: "2026-12-01", startingBalance: 100, projectionDays: 30,
    recurringRules: [
      rule({ id: "salary", direction: "credit", amount: 2000, startDate: "", limitType: "none" }),
      rule({ id: "rent", direction: "debit", amount: 1900, startDate: "", limitType: "none" }),
      rule({ id: "gift", direction: "credit", amount: 50, startDate: "", limitType: "none" }),
    ] });
  plan.startDate = "2026-12-01";
  context.state = plan;
  const before = JSON.stringify(context.flattenProjectionRows());
  assert.equal(context.moveRuleWithinDirection(plan.recurringRules, "gift", "rent"), false);
  assert.equal(context.moveRuleWithinDirection(plan.recurringRules, "gift", "salary"), true);
  assert.deepEqual(Array.from(plan.recurringRules, r => r.id), ["gift", "rent", "salary"]);
  assert.equal(JSON.stringify(context.flattenProjectionRows()), before);
  const restored = context.normalizeState(JSON.parse(JSON.stringify(plan)));
  restored.startDate = "2026-12-01";
  context.state = restored;
  assert.deepEqual(Array.from(restored.recurringRules, r => r.id), ["gift", "rent", "salary"]);
  assert.equal(JSON.stringify(context.flattenProjectionRows()), before);
});

test("opening balance is not displayed as an incoming payment", () => {
  context.state = { startDate: "2026-12-01", projectionDays: 30, startingBalance: 1000, recurringRules: [], skippedInstances: {} };
  const opening = context.flattenProjectionRows()[0];
  assert.equal(opening.credit, null);
  assert.equal(opening.debit, null);
  assert.equal(opening.balance, 1000);
});

test("biweekly count origin remains the first payday across reloads with an explicitly blank optional start", () => {
  const item = rule({ scheduleType: "biweekly", scheduleDate: "2026-10-02", startDate: "",
    limitType: "count", instanceLimit: 2, pendingSchedule: false });
  const restored = context.normalizeState({ startDate: "2026-10-18", recurringRules: [item] }).recurringRules[0];
  assert.equal(restored.startDate, "");
  assert.deepEqual(dates(restored, "2026-10-18", 40), []);
});
