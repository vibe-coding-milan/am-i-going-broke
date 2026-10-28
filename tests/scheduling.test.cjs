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

test("local plan save time records material edits without relabeling legacy or cosmetic saves", () => {
  let now = Date.parse("2026-10-28T22:00:00Z");
  class SavedDate extends Date { constructor(...args) { super(...(args.length ? args : [now])); } }
  const original = { startingBalance: 1000, lastRefreshDate: "2026-10-28", projectionDays: 30,
    thresholds: { red: 100, yellow: 200, green: 300 }, skippedInstances: {}, recurringRules: [] };
  let stored = JSON.stringify({ version: 3, exportedAt: "2026-10-28T20:00:00Z", data: original });
  const isolated = isolatedFunctions("  function saveState(state)", "  function readBackupState(", {
    Date: SavedDate, STORAGE_KEY: "plan", STORAGE_VERSION: 3, normalizeState: value => value,
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
function responseHarness(reduced = false, sessionStorage) {
  let now = 0, nextId = 0;
  const timers = new Map();
  const children = {};
  const element = { className: "", attrs: {}, innerHTML: "",
    setAttribute(key, value) { this.attrs[key] = value; },
    querySelector(selector) { return children[selector] ||= { textContent: "" }; } };
  const motion = { matches: reduced, addEventListener(type, callback) { this.change = callback; } };
  const headerContext = vm.createContext({
    sessionStorage,
    Math: Object.assign(Object.create(Math), { random: () => 0 }),
    matchMedia: () => motion,
    setTimeout(callback, delay) { const id = ++nextId; timers.set(id, { callback, at: now + delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
  });
  for (const file of ["content/projectionAnswerCopy.js", "components/projectionAnswer.js"])
    vm.runInContext(fs.readFileSync(require("node:path").join(__dirname, "..", file), "utf8"), headerContext);
  return { element, motion, timers,
    header: headerContext.ProjectionAnswer.create(element),
    visual: () => children[element.className.includes("is-thinking") ? ".projection-answer-thinking" : ".projection-answer-text"].textContent.replace(/\u00a0/g, " "),
    announcement: () => children[".projection-answer-announcement"].textContent,
    remainder: () => children[".projection-answer-sizer"].textContent.replace(/\u00a0/g, " "),
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
  assert.equal(h.visual() + h.remainder(), "Not yet. Too close, babe.");
  assert.equal(h.element.attrs["aria-busy"], "true");
  h.advance(10000);
  assert.equal(h.visual(), "Not yet. Too close, babe.");
  assert.equal(h.remainder(), "");
  assert.match(h.announcement(), /^Not yet.*selected forecast period/);
  assert.equal(h.element.attrs["aria-busy"], "false");
});

test("new edits refresh scenario responses; unchanged renders do not replay or reshuffle", () => {
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
  assert.equal(h.visual(), "Yep. How attached are you to that extra kidney?");
  assert.equal(h.element.attrs["data-answer"], "yes");
  h.header.update({ hasProjectionData: true, status: "Healthy", dropsBelowZero: true, forecastKey: "three", refresh: true });
  h.advance(10000);
  assert.equal(h.visual(), "Yep. The bills would like a word.");
});

test("reduced motion skips both effects and can finish a response already in progress", () => {
  const h = responseHarness(true);
  h.header.update({ hasProjectionData: true, status: "Tight", forecastKey: "one" });
  assert.match(h.visual(), /^Not yet\./);
  assert.equal(h.element.attrs["data-answer"], "no");
  assert.equal(h.timers.size, 0);
  h.motion.matches = false;
  h.header.update({ hasProjectionData: true, status: "Healthy", forecastKey: "two" });
  assert.equal(h.visual(), ".");
  h.motion.matches = true; h.motion.change();
  assert.equal(h.visual(), "Nope. Actually, you can take me out to dinner.");
  assert.equal(h.timers.size, 0);
});

function isolatedFunctions(from, to, globals) {
  const isolated = vm.createContext(globals);
  const start = source.indexOf(from), end = source.indexOf(to, start);
  assert.ok(start >= 0 && end > start);
  vm.runInContext(source.slice(start, end), isolated);
  return isolated;
}

test("compact forecast summary preserves low dates and specific risk warnings without duplicate metrics", () => {
  const summaryElement = { innerHTML: "" };
  let hasData = true;
  let points = [{ date: "2026-10-17", balance: 6800 }, { date: "2026-11-14", balance: 3865 }];
  let answer;
  const summaryContext = vm.createContext({
    answerRefreshRequested: false,
    projectionSummary: summaryElement,
    state: { thresholds: { red: 1000 } },
    summarizeProjection: () => ({ projectionHealth: { status: "Tight" } }),
    hasProjectionData: () => hasData,
    projectionPointsFromRows: () => points,
    formatCurrency: value => "$" + value,
    formatProjectionHealthDate: value => value,
    projectionAnswer: { update: value => { answer = value; } },
  });
  const start = source.indexOf("  function firstProjectionPointBelow(");
  const end = source.indexOf("  function summarizeProjection(", start);
  vm.runInContext(source.slice(start, end), summaryContext);
  const renderStart = source.indexOf("  function renderSummary(");
  const renderEnd = source.indexOf("  function renderProjectionChart(", renderStart);
  vm.runInContext(source.slice(renderStart, renderEnd), summaryContext);
  summaryContext.renderSummary([]);
  assert.match(summaryElement.innerHTML, /Lowest balance.*\$3865.*2026-11-14/);
  assert.doesNotMatch(summaryElement.innerHTML, /Net change|Over \d+ days|health-status|forecast-risk-note/);
  points = [{ date: "2026-10-17", balance: 800 }, { date: "2026-11-01", balance: -200 }];
  summaryContext.renderSummary([]);
  assert.match(summaryElement.innerHTML, /Below \$0 on 2026-11-01/);
  assert.equal(answer.dropsBelowZero, true);
  points = [{ date: "2026-10-17", balance: 1000 }];
  summaryContext.renderSummary([]);
  assert.match(summaryElement.innerHTML, /Reaches your red cushion on 2026-10-17/);
  assert.equal(answer.dropsBelowZero, false);
  hasData = false;
  summaryContext.renderSummary([]);
  assert.match(summaryElement.innerHTML, /Lowest balance.*—/);
  assert.doesNotMatch(summaryElement.innerHTML, /forecast-risk-note/);
  assert.equal(answer.hasProjectionData, false);
});

test("answers follow existing forecast statuses without inferred trend or expense categories", () => {
  const h = responseHarness(true);
  assert.deepEqual(Object.keys(h.header.copy.responses).sort(),
    ["empty", "broke", "Healthy", "Building", "Stable", "Tight", "At Risk"].sort());
  const inventory = Object.values(h.header.copy.responses).flat();
  assert.equal(inventory.length, 93);
  assert.equal(new Set(inventory).size, 93);
  for (const status of ["Healthy", "Building", "Stable", "Tight", "At Risk"]) {
    for (const metrics of [
      { startBalance: 5000, minBalance: 4000, endBalance: 4500, netChange: -500 },
      { startBalance: 5000, minBalance: 4000, endBalance: 5500, netChange: 500 },
    ]) {
      h.header.update({ hasProjectionData: true, status, metrics, hasMajorExpense: true, refresh: true });
      assert.equal(h.header.category, status);
      assert.ok(h.header.copy.responses[status].includes(h.header.answer));
    }
    h.header.update({ hasProjectionData: true, status, dropsBelowZero: true });
    assert.equal(h.header.category, "broke");
    assert.equal(h.element.attrs["data-answer"], "yes");
  }
});

test("no-data answers rotate on explicit refresh and stay still on cosmetic renders", () => {
  const h = responseHarness(true);
  h.header.update({ hasProjectionData: false });
  const first = h.header.answer;
  h.header.update({ hasProjectionData: false });
  assert.equal(h.header.answer, first);
  h.header.update({ hasProjectionData: false, refresh: true });
  assert.equal(h.header.answer, "Girl, I don't even know you.");
  assert.equal(h.element.attrs["data-answer"], "empty");
  assert.equal(h.timers.size, 0);
});


test("each scenario exhausts its pool before repeating across edits and reloads", () => {
  const stored = new Map();
  const storage = { getItem: key => stored.get(key) || null, setItem: (key, value) => stored.set(key, value) };
  let h = responseHarness(true, storage);
  const size = h.header.copy.responses.Healthy.length;
  const answers = [];
  for (let i = 0; i < size; i++) {
    if (i % 2) h = responseHarness(true, storage);
    h.header.update({ hasProjectionData: true, status: "Healthy", forecastKey: String(i) });
    answers.push(h.header.answer);
    // Visiting another scenario does not reset Healthy's rotation.
    h.header.update({ hasProjectionData: true, status: "Tight", forecastKey: String(i) });
  }
  assert.equal(new Set(answers).size, size);
  h = responseHarness(true, storage);
  h.header.update({ hasProjectionData: true, status: "Healthy" });
  assert.ok(answers.includes(h.header.answer));
});

test("rotation survives unavailable or malformed session storage", () => {
  for (const storage of [
    { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } },
    { getItem: () => '{invalid', setItem() {} },
    { getItem: () => '{"Stable":42}', setItem() {} },
  ]) {
    const h = responseHarness(true, storage);
    const answers = [];
    for (let i = 0; i < h.header.copy.responses.Stable.length; i++) {
      h.header.update({ hasProjectionData: true, status: "Stable", forecastKey: String(i) });
      answers.push(h.header.answer);
    }
    assert.equal(new Set(answers).size, answers.length);
  }
});

// Usability release: protect forecast semantics while changing presentation and defaults.
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


test("biweekly count origin remains the first payday across reloads with an explicitly blank optional start", () => {
  const item = rule({ scheduleType: "biweekly", scheduleDate: "2026-10-02", startDate: "",
    limitType: "count", instanceLimit: 2, pendingSchedule: false });
  const restored = context.normalizeState({ startDate: "2026-10-18", recurringRules: [item] }).recurringRules[0];
  assert.equal(restored.startDate, "");
  assert.deepEqual(dates(restored, "2026-10-18", 40), []);
});

include("  function canDownloadPlan()", "  function renderSummary(");
include("  function createSampleRule(", "  function applySampleScenario(");
test("plan origin protects examples and preserves explicit and legacy zero-dollar personal plans", () => {
  const empty = context.cloneDefaultState();
  assert.equal(context.normalizeState(empty).planOrigin, 'empty');
  assert.equal(context.normalizeState(empty).hasPersonalData, false);
  for (const plan of [
    { ...empty, planOrigin: 'personal', hasPersonalData: true },
    { startingBalance: 0, recurringRules: [] },
  ]) {
    context.state = context.normalizeState(plan);
    assert.equal(context.state.planOrigin, 'personal');
    assert.equal(context.canDownloadPlan(), true);
    assert.equal(context.hasProjectionData(), true);
  }
  context.state = context.normalizeState({ ...empty, sampleScenario: 'Edited example', startingBalance: 15000 });
  assert.equal(context.state.planOrigin, 'example');
  assert.equal(context.canDownloadPlan(), false);
  context.state = context.readBackupState({ data: empty });
  assert.equal(context.state.planOrigin, 'personal', 'an explicitly imported zero-dollar plan is personal');
  context.state = context.readBackupState({ data: { ...empty, sampleScenario: 'Old example' } });
  assert.equal(context.state.planOrigin, 'example');
});

test("empty and example downloads create no file or download URL", () => {
  for (const sampleScenario of ['', 'Edited example']) {
    let message = '';
    const ui = isolatedFunctions("  function downloadLocalBackup()", "  exportDataButton.addEventListener", {
      state: { sampleScenario }, canDownloadPlan: () => false,
      showDataStatus: text => { message = text; },
      Blob() { throw new Error('Must not create a file'); },
    });
    ui.downloadLocalBackup();
    assert.equal(message, '', 'unavailable downloads stay quiet');
  }
});

test("starting personally discards all fictional financial inputs without a reset confirmation", () => {
  let focused = 0, selected = 0, saved;
  const ui = isolatedFunctions("  function startPersonalPlan()", '  document.querySelector("#start-own-plan")', {
    state: { planOrigin: 'example', sampleScenario: 'Edited', startingBalance: 999, recurringRules: [{ name: 'Fake' }] },
    cloneDefaultState: () => JSON.parse(JSON.stringify(context.cloneDefaultState())),
    dataActionStatus: { classList: { add() {} } },
    clearRemovalUndo() {}, persistAndRender() { saved = ui.state; },
    startingBalanceInput: { focus() { focused++; }, select() { selected++; } },
  });
  ui.startPersonalPlan();
  assert.equal(saved.planOrigin, 'empty'); assert.equal(saved.hasPersonalData, false);
  assert.equal(saved.sampleScenario, ''); assert.equal(saved.recurringRules.length, 0);
  assert.equal(saved.startingBalance, 0); assert.equal(focused, 1); assert.equal(selected, 1);
  ui.state.planOrigin = 'personal'; ui.state.hasPersonalData = true;
  const existing = ui.state; ui.startPersonalPlan(); assert.equal(ui.state, existing);
});

test("fictional life stories reveal their promised outcomes across horizons and calendar boundaries", () => {
  const RealDate = Date;
  const outcomes = sample => {
    context.state = sample;
    const balances = Array.from(context.flattenProjectionRows()).filter(row => !row.outsideWindow).map(row => row.balance);
    assert.ok(balances.length > 0 && balances.every(Number.isFinite));
    return { low: Math.min(...balances), end: balances.at(-1) };
  };
  try {
    for (const year of [2026, 2028]) for (let month = 0; month < 12; month++) {
      for (const date of [1, 15, 28, new RealDate(year, month + 1, 0).getDate()]) {
        const now = new RealDate(year, month, date, 12);
        context.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : [now])); } };
        for (const key of Array.from(context.SAMPLE_SCENARIO_KEYS)) {
          const example = context.buildSampleScenario(key);
          const sample = example.state;
          assert.ok(example.label && example.story, key);
          assert.equal(require('../driveSync.js').validPlan(sample), true, key);
          const near = outcomes({ ...sample, projectionDays: 30 });
          const far = outcomes({ ...sample, projectionDays: key === 'tight' ? 90 : ['debt', 'layoff'].includes(key) ? 365 : 180 });
          const message = `${key} ${now}: near=${near.low}, far=${far.low}`;
          if (key === 'risk') assert.ok(near.low < 0, message);
          else assert.ok(near.low >= 0, message);
          if (['layoff', 'gigs', 'tight', 'debt'].includes(key)) assert.ok(far.low < 0, message);
          if (key === 'layoff') assert.ok(outcomes({ ...sample, projectionDays: 180 }).low >= 0, message);
          if (key === 'emergency') {
            const yearEnd = outcomes({ ...sample, projectionDays: 365 });
            assert.ok(far.low >= 0 && far.low < sample.thresholds.red, message);
            assert.ok(yearEnd.end > sample.startingBalance, message);
          }
          if (key === 'healthy') assert.ok(outcomes({ ...sample, projectionDays: 365 }).low >= sample.thresholds.green, message);
          if (key === 'growing') assert.ok(far.low >= 0 && far.end > sample.startingBalance + 6000, message);
        }
      }
    }
  } finally { context.Date = RealDate; }
});

test("every example supports all forecast periods and retains its story through normalization", () => {
  const cushionSets = new Set();
  for (const key of Array.from(context.SAMPLE_SCENARIO_KEYS)) {
    const example = context.buildSampleScenario(key);
    const stored = context.normalizeState({ ...example.state, sampleScenario: example.label,
      sampleScenarioKey: key, sampleStory: example.story });
    assert.equal(stored.sampleStory, example.story);
    assert.equal(stored.planOrigin, 'example');
    assert.equal(stored.hasPersonalData, false);
    assert.ok(stored.thresholds.red < stored.thresholds.yellow && stored.thresholds.yellow < stored.thresholds.green);
    cushionSets.add(JSON.stringify(stored.thresholds));
    for (const projectionDays of [30, 60, 90, 120, 180, 365]) {
      context.state = { ...stored, projectionDays };
      const rows = Array.from(context.flattenProjectionRows());
      assert.ok(rows.length > 0 && rows.every(row => Number.isFinite(row.balance)), `${key}: ${projectionDays}`);
    }
  }
  assert.equal(cushionSets.size, context.SAMPLE_SCENARIO_KEYS.length);
  assert.equal(context.cloneDefaultState().thresholds.red, 1000, "example targets do not change personal defaults");
});

test("layoff income and financed emergency costs stop at the limits stated in their stories", () => {
  const layoff = context.buildSampleScenario('layoff').state;
  const income = Array.from(context.generateProjection({ ...layoff, projectionDays: 365 }))
    .flatMap(day => Array.from(day.items).map(item => ({ ...item, date: context.dateInputValue(day.date) })));
  const benefits = income.filter(item => item.name === 'Temporary unemployment benefits');
  assert.equal(benefits.length, 26);
  assert.equal(benefits.at(-1).date, context.dateInputValue(context.addDays(context.parseInputDate(layoff.startDate), 182)));
  assert.equal(income.filter(item => item.name === 'Severance payout').length, 1);
  assert.equal(income.filter(item => item.name === 'Final paycheck').length, 1);
  const emergency = context.buildSampleScenario('emergency').state;
  const costs = Array.from(context.generateProjection({ ...emergency, projectionDays: 365 }))
    .flatMap(day => Array.from(day.items)).filter(item => /plumber|Hotel|Repair/.test(item.name));
  assert.equal(costs.filter(item => item.name === 'Repair card payment').length, 4);
  assert.equal(costs.reduce((sum, item) => sum + item.amount, 0), 8900, 'cash stages plus card repayments count each expense once');
});


test("example payment IDs remain unique even when the clock and random source repeat", () => {
  const RealDate = Date;
  context.Date = class extends RealDate { static now() { return 12345; } };
  vm.runInContext('var originalSampleRandom = Math.random; Math.random = function () { return 0; };', context);
  try {
    for (const key of Array.from(context.SAMPLE_SCENARIO_KEYS)) {
      const sample = context.buildSampleScenario(key).state;
      assert.equal(new Set(Array.from(sample.recurringRules, rule => rule.id)).size, sample.recurringRules.length, key);
      assert.equal(require('../driveSync.js').validPlan(sample), true, key);
    }
  } finally {
    context.Date = RealDate;
    vm.runInContext('Math.random = originalSampleRandom;', context);
  }
});
