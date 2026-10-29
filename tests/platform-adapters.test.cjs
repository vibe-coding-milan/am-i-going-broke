const test = require("node:test");
const assert = require("node:assert/strict");
const Browser = require("../browserPlatform.js");
const Service = require("../driveServiceClient.js");
const Repository = require("../planRepository.js");
const Data = require("../planData.js");
const Core = require("../forecastCore.js");
const Sync = require("../driveSync.js");

function memory() {
  const values = new Map();
  return { values, getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}

test("storage adapters are lazy and preserve failures instead of acknowledging lost writes", () => {
  let reads = 0;
  const storage = Browser.storage(() => { reads++; throw new Error("quota"); });
  assert.equal(reads, 0);
  assert.throws(() => storage.setItem("plan", "{}"), /quota/);
  assert.throws(() => storage.getItem("plan"), /quota/);
});

test("legacy storage migration keeps keys, plan ownership and save notification path", () => {
  const storage = memory();
  storage.setItem("cash-flow-projector-state-v2", JSON.stringify({ startingBalance: 0, recurringRules: [] }));
  const data = Data.create({ calendar: Core, makeId: () => "legacy" });
  let saves = 0;
  const repository = Repository.create({ storage, planData: data, fingerprint: Sync.fingerprint,
    now: () => "2026-10-28T12:00:00.000Z", saveMigrated(plan) { saves++; repository.save(plan); } });
  const plan = repository.load();
  assert.equal(plan.planOrigin, "personal");
  assert.equal(saves, 1);
  assert.ok(storage.getItem("cash-flow-projector-state-v2"), "legacy data is retained");
  assert.equal(JSON.parse(storage.getItem("cash-flow-projector-state")).version, 3);
  const stamp = repository.savedAt(plan);
  repository.save({ ...plan, rulesCollapsed: true });
  assert.equal(repository.savedAt(plan), stamp);
  assert.equal(repository.savedAt({ ...plan, startingBalance: 1 }), null);
});

test("unavailable/corrupt storage falls back to the current empty draft", () => {
  const data = Data.create({ calendar: Core, makeId: () => "legacy" });
  for (const storage of [{ getItem() { throw new Error("blocked"); } }, { getItem: () => "{" }]) {
    const repository = Repository.create({ storage, planData: data });
    assert.equal(repository.load().planOrigin, "empty");
    assert.throws(() => repository.save(data.cloneDefaultState()));
  }
});

test("browser file handoff and lifecycle retain native event types and deferred URL cleanup", () => {
  const events = [], jobs = [];
  let filename, revoked = 0, clicked = 0, removed = 0, reader;
  const win = {
    Blob, location: { assign: value => events.push(value) },
    URL: { createObjectURL: () => "blob:fixture", revokeObjectURL: () => revoked++ },
    setTimeout: (callback, delay) => jobs.push({ callback, delay }),
    addEventListener: (name, callback) => events.push({ name, callback }),
    FileReader: class { constructor() { reader = this; } readAsText(file) { this.result = file; this.onload(); } },
  };
  const doc = { addEventListener: win.addEventListener, body: { appendChild() {} }, createElement: () => ({
    addEventListener() {}, set download(value) { filename = value; }, click() { clicked++; }, remove() { removed++; },
  }) };
  const platform = Browser.create({ window: win, document: doc });
  const resumed = () => {};
  platform.onResume(resumed); platform.onConnectivity(() => {}, () => {});
  assert.deepEqual(events.map(e => e.name), ["focus", "pageshow", "visibilitychange", "online", "offline"]);
  assert.ok(events.slice(0, 3).every(e => e.callback === resumed));
  let imported;
  platform.readText('{"fictional":true}', text => imported = text);
  assert.equal(imported, reader.result);
  platform.download("{}", "fixture.json");
  assert.equal(filename, "fixture.json"); assert.equal(clicked, 1); assert.equal(removed, 1); assert.equal(revoked, 0);
  assert.equal(jobs[0].delay, 60000); jobs[0].callback(); assert.equal(revoked, 1);
});

test("service endpoint and authorization guards preserve browser-origin boundaries", () => {
  const location = { href: "https://amigoingbroke.me/", origin: "https://amigoingbroke.me" };
  assert.equal(Service.resolveEndpoint("/api/drive-sync.php", location).origin, location.origin);
  for (const endpoint of ["https://foreign.example/api", "https://user:pass@amigoingbroke.me/api", "/api#fragment", "http://[invalid"])
    assert.equal(Service.resolveEndpoint(endpoint, location), null);
  const service = Service.create({ endpoint: new URL("https://amigoingbroke.me/api/drive-sync.php") });
  assert.equal(service.authorizationDestination("https://accounts.google.com/o/oauth2/v2/auth?state=fixture"), "https://accounts.google.com/o/oauth2/v2/auth?state=fixture");
  assert.throws(() => service.authorizationDestination("https://foreign.example/login"));
  assert.throws(() => service.authorizationDestination("https://accounts.google.com/other"));
});

test("Drive requests retain cookies, fresh CSRF, versioned body, timeout and error mapping", async () => {
  const calls = [], jobs = [], cleared = [];
  let csrf = "first", response = { ok: true, json: async () => ({ accountId: "fixture" }) };
  const service = Service.create({ endpoint: new URL("https://amigoingbroke.me/api/drive-sync.php"),
    getSession: () => ({ csrf }), AbortController,
    fetch: async (url, options) => { calls.push({ url, options }); return response; },
    setTimeout: (callback, delay) => { jobs.push({ callback, delay }); return jobs.length; }, clearTimeout: id => cleared.push(id),
  });
  await service.request("status");
  const body = { accountId: "fixture", expectedRevision: "r1", operationId: "operation-1", plan: {} };
  csrf = "renewed";
  await service.request("plan", body);
  assert.equal(calls[0].options.method, "GET");
  assert.equal(calls[1].options.credentials, "same-origin");
  assert.equal(calls[1].options.cache, "no-store");
  assert.equal(calls[1].options.headers["X-Sync-CSRF"], "renewed");
  assert.deepEqual(JSON.parse(calls[1].options.body), body);
  assert.equal(new URL(calls[1].url).searchParams.get("action"), "plan");
  assert.equal(jobs[1].delay, 35000);
  jobs[1].callback(); assert.equal(calls[1].options.signal.aborted, true);
  for (const [remote, expected] of [["csrf", "auth"], ["invalid", "remote"], ["ambiguous", "missing"], ["conflict", "conflict"]]) {
    response = { ok: false, json: async () => ({ error: remote }) };
    await assert.rejects(service.request("plan", body), error => error.code === expected);
  }
  response = { ok: true, json: async () => { throw new Error("HTML instead of JSON"); } };
  await assert.rejects(service.request("status"), error => error.code === "unavailable");
  assert.equal(cleared.length, calls.length);
});
