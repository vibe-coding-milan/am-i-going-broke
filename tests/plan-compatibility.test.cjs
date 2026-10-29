const test = require("node:test");
const assert = require("node:assert/strict");
const Core = require("../forecastCore.js");
const Data = require("../planData.js");
const Sync = require("../driveSync.js");
const fixture = require("./fixtures/plan-compatibility.json");
const data = Data.create({ calendar: { ...Core, todayInputValue: () => fixture.today }, makeId: () => "fixture-id" });
const plain = value => JSON.parse(JSON.stringify(value));

for (const example of fixture.cases) test("pre-refactor compatibility: " + example.name, () => {
  const plan = data.normalizeState(example.input);
  assert.deepEqual(plain(plan), example.expectedNormalized);
  const rows = Core.flattenProjectionRows(plan);
  assert.deepEqual(plain(rows), example.expectedRows);
  assert.deepEqual(Core.projectionPointsFromRows(rows, plan), example.expectedPoints);
  const backup = JSON.parse(data.backupPayload(plan, new Date("2026-10-28T19:20:21.123Z")));
  assert.equal(backup.version, 3);
  assert.equal(backup.exportedAt, "2026-10-28T19:20:21.123Z");
  assert.deepEqual(backup.data, plain(plan));
});
for (const example of fixture.syncCases) test("shared sync contract: " + example.name, () => {
  assert.equal(Sync.validPlan(example.plan), example.valid);
});
