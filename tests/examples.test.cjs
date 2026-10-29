const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { context, source, include, day, rule, due, dates, isolatedFunctions, responseHarness } = require("./helpers/app-harness.cjs");

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
