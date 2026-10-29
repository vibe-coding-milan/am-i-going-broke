const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { context, source, include, day, rule, due, dates, isolatedFunctions, responseHarness } = require("./helpers/app-harness.cjs");

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
