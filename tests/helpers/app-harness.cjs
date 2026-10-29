const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "../../app.js"), "utf8");
const context = vm.createContext({ Date, Intl, console, document: {} });
context.window = context;
for (const file of ["forecastCore.js", "planData.js", "planRepository.js", "browserPlatform.js"])
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../..", file), "utf8"), context);
function include(from, to) {
  const start = source.indexOf(from), end = source.indexOf(to, start);
  assert.ok(start >= 0 && end > start, "UI test bridge must match app boundaries: " + from);
  vm.runInContext(source.slice(start, end), context);
}
// Only the page initializer and UI functions need a VM bridge; shared modules load whole.
include("  var platform =", "  function saveState(state)");
include("  function parseNumericValue(", "  function loadState()");
include("  function readBackupState(", "  function backupPayload(");
include("  function saveState(state)", "  function readBackupState(");
include("  function flattenProjectionRows()", "  function evaluateProjectionHealth(");
include("  function canDownloadPlan()", "  function renderSummary(");
include("  function createSampleRule(", "  function applySampleScenario(");
const day = value => context.parseInputDate(value);
const rule = overrides => ({
  id: "contract", name: "Contract paycheck", active: true, direction: "credit",
  amount: 1000, scheduleType: "weekly", dayOfWeek: 5,
  startDate: "2026-12-04", limitType: "date", endDate: "2026-12-25", ...overrides,
});
const due = (item, date, start = "2026-10-16") => context.isRuleDueOnDate(item, day(date), day(start));
const dates = (item, start, days) => Array.from(context.generateProjection({
  startDate: start, projectionDays: days, startingBalance: 0, recurringRules: [item],
})).flatMap(d => Array.from(d.items).map(i => i.dateKey));
function isolatedFunctions(from, to, globals) {
  if (globals.window?.URL && globals.document) globals.platform = require("../../browserPlatform.js").create({
    window: { ...globals.window, Blob: globals.Blob }, document: globals.document,
  });
  const isolated = vm.createContext(globals);
  const start = source.indexOf(from), end = source.indexOf(to, start);
  assert.ok(start >= 0 && end > start);
  vm.runInContext(source.slice(start, end), isolated);
  return isolated;
}
context.repository = require("../../planRepository.js").create({
  storage: require("../../browserPlatform.js").storage(() => context.window.localStorage),
  planData: context.planData,
});
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
    vm.runInContext(fs.readFileSync(require("node:path").join(__dirname, "../..", file), "utf8"), headerContext);
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

module.exports = { context, source, include, day, rule, due, dates, isolatedFunctions, responseHarness };
