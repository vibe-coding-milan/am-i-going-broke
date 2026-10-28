const test = require('node:test');
const assert = require('node:assert/strict');
const Sync = require('../driveSync.js');

const clone = value => JSON.parse(JSON.stringify(value));
const plan = (balance = 1000) => ({
  startDate: '2026-10-28', lastRefreshDate: '2026-10-28', startingBalance: balance,
  projectionDays: 30, thresholds: { red: 100, yellow: 200, green: 300 },
  skippedInstances: {}, recurringRules: [],
});
async function settle() { for (let i = 0; i < 20; i++) await Promise.resolve(); }
function clock() {
  let now = 0, next = 1;
  const jobs = new Map();
  return {
    now: () => now,
    setTimeout(fn, ms) { const id = next++; jobs.set(id, { at: now + ms, fn }); return id; },
    clearTimeout(id) { jobs.delete(id); },
    async tick(ms) {
      const end = now + ms;
      for (;;) {
        const first = [...jobs.entries()].filter(([, j]) => j.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!first) break;
        now = first[1].at; jobs.delete(first[0]); first[1].fn(); await settle();
      }
      now = end; await settle();
    },
    pending: () => jobs.size,
  };
}
function harness(options = {}) {
  const time = clock(), saved = [], writes = [], statuses = [], adopted = [];
  const accountId = 'account-a';
  let remote = options.remote === undefined ? { accountId, revision: 'r1', plan: plan(), savedAt: 'initial' } : clone(options.remote);
  let counter = 1;
  let record = options.record === undefined ? {
    schema: 1, accountId, enabled: true, revision: 'r1', base: Sync.fingerprint(plan()),
    local: plan(), savedAt: 'initial', sample: false,
  } : clone(options.record);
  let readFailure = null, writeFailure = null, gate = null;
  let reads = 0;
  const storage = {
    load: () => record && clone(record),
    save(id, value) { assert.equal(id, accountId); record = clone(value); saved.push(clone(value)); },
  };
  const transport = {
    async read(request) {
      reads++; assert.equal(request.accountId, accountId);
      if (readFailure) throw readFailure;
      return clone(remote);
    },
    async write(request) {
      writes.push(clone(request));
      if (gate) await gate;
      if (writeFailure) throw writeFailure;
      assert.equal(request.accountId, accountId);
      if (request.expectedRevision !== remote.revision) throw Object.assign(new Error('stale'), { code: 'conflict' });
      remote = { accountId, revision: 'r' + ++counter, plan: clone(request.plan), savedAt: 'saved-' + counter };
      return clone(remote);
    },
  };
  const engine = Sync.create({ accountId, storage, transport: options.transport || transport, clock: time, random: options.random || (() => 0),
    onStatus: value => statuses.push(value), onRemote: value => adopted.push(value) });
  return {
    engine, time, writes, saved, statuses, adopted, transport, storage,
    remote: () => clone(remote), record: () => clone(record), reads: () => reads,
    changeRemote(value) { remote = clone(value); },
    failReads(error) { readFailure = error; }, failWrites(error) { writeFailure = error; },
    holdWrites(promise) { gate = promise; },
    async ready() { engine.authorize(accountId); await time.tick(0); },
  };
}

test('five seconds of inactivity combines cash and payment edits into one upload', async () => {
  const h = harness(); await h.ready();
  h.engine.setPlan(plan(1100)); await h.time.tick(2000);
  h.engine.setPlan(plan(1200)); await h.time.tick(4999);
  assert.equal(h.writes.length, 0);
  await h.time.tick(1);
  assert.equal(h.writes.length, 1);
  assert.equal(h.remote().plan.startingBalance, 1200);
  assert.equal(h.engine.snapshot().status, 'synced');
});

test('cash, payments and transaction exclusions batch together while cosmetic state stays local', async () => {
  const h = harness(); await h.ready();
  const edited = plan(1500);
  edited.recurringRules = [
    { id: 'pay', name: 'Pay', amount: 200, direction: 'credit', scheduleType: 'adhoc', scheduleDate: '2026-11-01' },
    { id: 'bill', name: 'Bill', amount: 50, direction: 'debit', scheduleType: 'adhoc', scheduleDate: '2026-11-02' },
  ];
  h.engine.setPlan(edited); await h.time.tick(3000);
  edited.recurringRules[1].amount = 75; h.engine.setPlan(edited); await h.time.tick(3000);
  edited.skippedInstances = { 'bill:2026-11-02': true }; h.engine.setPlan(edited);
  await h.time.tick(4999); assert.equal(h.writes.length, 0);
  await h.time.tick(1); assert.equal(h.writes.length, 1);
  assert.deepEqual(h.writes[0].plan.skippedInstances, edited.skippedInstances);
  assert.equal(h.writes[0].plan.recurringRules[1].amount, 75);
  const reads = h.reads();
  h.engine.setPlan({ ...edited, rulesCollapsed: true, theme: 'light' });
  await h.time.tick(60000); assert.equal(h.writes.length, 1); assert.equal(h.reads(), reads);
});

test('phone, work computer and new tablet converge without restore or extra uploads', async () => {
  const phone = harness(); await phone.ready();
  const work = harness({ transport: phone.transport, record: null });
  work.engine.setPlan(plan(0)); work.engine.authorize('account-a'); work.engine.enable(true);
  await work.time.tick(0);
  assert.equal(work.adopted.at(-1).startingBalance, 1000);
  phone.engine.setPlan(plan(1400)); await phone.time.tick(5000);
  work.engine.check(); await work.time.tick(0);
  assert.equal(work.adopted.at(-1).startingBalance, 1400);
  work.engine.setPlan(plan(1300)); await work.time.tick(5000);
  phone.engine.check(); await phone.time.tick(0);
  assert.equal(phone.adopted.at(-1).startingBalance, 1300);
  const tablet = harness({ transport: phone.transport, record: null });
  tablet.engine.setPlan(plan(0)); tablet.engine.authorize('account-a'); tablet.engine.enable(true);
  await tablet.time.tick(0);
  assert.equal(tablet.adopted.at(-1).startingBalance, 1300);
  assert.equal(phone.writes.length, 2, 'new devices and foreground checks perform no uploads');
});

test('offline phone and work edits preserve both candidates through conflict and restart', async () => {
  const phone = harness(); await phone.ready();
  const work = harness({ transport: phone.transport }); await work.ready();
  phone.engine.setOnline(false); phone.engine.setPlan(plan(800));
  work.engine.setPlan(plan(1600)); await work.time.tick(5000);
  phone.engine.setOnline(true); await phone.time.tick(5000);
  assert.equal(phone.engine.snapshot().status, 'conflict');
  assert.equal(phone.record().conflict.local.startingBalance, 800);
  assert.equal(phone.record().conflict.remote.plan.startingBalance, 1600);
  const reopened = harness({ transport: phone.transport, record: phone.record() }); await reopened.ready();
  assert.equal(reopened.engine.snapshot().status, 'conflict');
  assert.equal(phone.writes.length, 1);
  await reopened.engine.resolveConflict('local');
  assert.equal(phone.remote().plan.startingBalance, 800);
  assert.equal(reopened.record().recovery.remote.plan.startingBalance, 1600);
  assert.equal(reopened.engine.recovery().local.startingBalance, 800);
  assert.equal(reopened.engine.recovery().remote.plan.startingBalance, 1600);
  const recovery = reopened.engine.recovery(); recovery.local.startingBalance = -1;
  assert.equal(reopened.engine.recovery().local.startingBalance, 800, 'recovery UI cannot mutate the durable candidates');
});

test('cosmetic changes and generated export timestamps cause no sync or outbox writes', async () => {
  const h = harness(); await h.ready();
  const savedBefore = h.saved.length, readsBefore = h.reads();
  h.engine.setPlan({ ...plan(), rulesCollapsed: true, ruleGroups: { moneyInOpen: false }, exportedAt: 'later', startDate: '2026-10-29' });
  await h.time.tick(60000);
  assert.equal(h.writes.length, 0); assert.equal(h.saved.length, savedBefore); assert.equal(h.reads(), readsBefore);
});

test('a reverted edit makes no Drive write', async () => {
  const h = harness(); await h.ready();
  h.engine.setPlan(plan(2)); h.engine.setPlan(plan()); await h.time.tick(5000);
  assert.equal(h.writes.length, 0);
});

test('continuous valid edits flush at the maximum wait without uploading intermediate keystrokes', async () => {
  const h = harness(); await h.ready();
  for (let i = 1; i <= 8; i++) {
    h.engine.setEditing(true); h.engine.setPlan(plan(1000 + i)); h.engine.setEditing(false);
    await h.time.tick(4000);
  }
  assert.equal(h.writes.length, 1); assert.equal(h.writes[0].plan.startingBalance, 1008);
});

test('samples and incomplete drafts cancel a queued upload', async () => {
  for (const update of [{ ...plan(2), sampleScenario: 'income-bills' }, { ...plan(2), startingBalance: NaN }]) {
    const h = harness(); await h.ready(); h.engine.setPlan(plan(1)); h.engine.setPlan(update);
    await h.time.tick(60000); assert.equal(h.writes.length, 0);
    assert.ok(['sample', 'invalid'].includes(h.engine.snapshot().status));
  }
});

test('offline changes survive restart and cannot upload until the same account is authorized', async () => {
  const h = harness(); await h.ready(); h.engine.setOnline(false); h.engine.setPlan(plan(80));
  await h.time.tick(60000); assert.equal(h.writes.length, 0);
  assert.equal(h.record().local.startingBalance, 80); h.engine.destroy();
  const restarted = harness({ record: h.record(), remote: h.remote() });
  await restarted.time.tick(60000); assert.equal(restarted.writes.length, 0);
  restarted.engine.authorize('another-account'); await restarted.time.tick(60000);
  assert.equal(restarted.engine.snapshot().status, 'account'); assert.equal(restarted.writes.length, 0);
  restarted.engine.authorize('account-a'); await restarted.time.tick(0);
  assert.equal(restarted.writes.length, 1); assert.equal(restarted.remote().plan.startingBalance, 80);
});

test('an account-mismatched outbox is rejected before any network access', () => {
  assert.throws(() => harness({ record: { accountId: 'another-account' } }), /Account mismatch/);
});

test('an empty new device adopts the existing Drive plan without overwriting it', async () => {
  const h = harness({ record: null }); h.engine.setPlan(plan(0)); h.engine.enable(true); await h.ready();
  assert.equal(h.writes.length, 0); assert.equal(h.adopted.length, 1);
  assert.equal(h.adopted[0].startingBalance, 1000);
});

test('first setup with two different plans preserves both and requires a choice', async () => {
  const h = harness({ record: null }); h.engine.setPlan(plan(80)); h.engine.enable(true); await h.ready();
  assert.equal(h.engine.snapshot().status, 'conflict'); assert.equal(h.writes.length, 0);
  assert.equal(h.record().conflict.local.startingBalance, 80);
  assert.equal(h.record().conflict.remote.plan.startingBalance, 1000);
  await h.engine.resolveConflict('local');
  assert.equal(h.remote().plan.startingBalance, 80);
  assert.equal(h.record().recovery.remote.plan.startingBalance, 1000);
});

test('an unchanged device adopts a newer remote plan with its original cash-as-of date', async () => {
  const h = harness(); await h.ready();
  h.changeRemote({ accountId: 'account-a', revision: 'r2', plan: { ...plan(80), lastRefreshDate: '2026-10-27' }, savedAt: 'remote' });
  await h.engine.flush(); assert.equal(h.writes.length, 0);
  assert.equal(h.adopted[0].lastRefreshDate, '2026-10-27');
});

test('concurrent device edits do not overwrite either candidate', async () => {
  const h = harness(); await h.ready(); h.engine.setPlan(plan(80));
  h.changeRemote({ accountId: 'account-a', revision: 'r2', plan: plan(90), savedAt: 'remote' });
  await h.time.tick(5000); assert.equal(h.writes.length, 0); assert.equal(h.engine.snapshot().status, 'conflict');
  await h.engine.resolveConflict('remote'); assert.equal(h.adopted[0].startingBalance, 90);
  assert.equal(h.record().recovery.local.startingBalance, 80);
});

test('a remote change while the conflict dialog is open requires reconciliation again', async () => {
  const h = harness(); await h.ready(); h.engine.setPlan(plan(80));
  h.changeRemote({ accountId: 'account-a', revision: 'r2', plan: plan(90), savedAt: 'remote' });
  await h.time.tick(5000);
  h.changeRemote({ accountId: 'account-a', revision: 'r3', plan: plan(95), savedAt: 'newer' });
  await h.engine.resolveConflict('local'); assert.equal(h.writes.length, 0);
  assert.equal(h.engine.snapshot().status, 'conflict');
});

test('a deleted Drive plan is not silently recreated', async () => {
  const h = harness(); await h.ready(); h.engine.setPlan(plan(80));
  h.changeRemote({ accountId: 'account-a', revision: null, plan: null, savedAt: null });
  await h.time.tick(5000); assert.equal(h.writes.length, 0); assert.equal(h.engine.snapshot().status, 'missing');
});

test('an untouched empty account creates no files and starts no recurring writes', async () => {
  const h = harness({ record: null, remote: { accountId: 'account-a', revision: null, plan: null, savedAt: null } });
  h.engine.setPlan(plan(0)); h.engine.enable(true); await h.ready(); await h.time.tick(60000);
  assert.equal(h.writes.length, 0); assert.equal(h.time.pending(), 0);
});

test('disabling sync cancels queued work without deleting the local plan', async () => {
  const h = harness(); await h.ready(); h.engine.setPlan(plan(80)); h.engine.enable(false);
  await h.time.tick(60000); assert.equal(h.writes.length, 0);
  assert.equal(h.record().local.startingBalance, 80); assert.equal(h.engine.snapshot().status, 'off');
});

test('authorization failures pause quietly until an explicit reconnect', async () => {
  const h = harness(); await h.ready(); h.failReads({ code: 'auth' }); h.engine.setPlan(plan(80));
  await h.time.tick(60000); assert.equal(h.engine.snapshot().status, 'reconnect');
  const reads = h.reads(); await h.time.tick(60000); assert.equal(h.reads(), reads);
  h.failReads(null); h.engine.authorize('account-a'); await h.time.tick(0);
  assert.equal(h.remote().plan.startingBalance, 80);
});

test('temporary errors back off and additional edits do not cause a retry storm', async () => {
  const h = harness(); await h.ready(); h.failReads(new Error('offline service'));
  h.engine.setPlan(plan(80)); await h.time.tick(5000);
  assert.equal(h.engine.snapshot().status, 'retrying'); const reads = h.reads();
  h.engine.setPlan(plan(90)); await h.time.tick(9999); assert.equal(h.reads(), reads);
  h.failReads(null); await h.time.tick(1); assert.equal(h.remote().plan.startingBalance, 90);
});

test('temporary failures add jitter without letting new edits bypass backoff', async () => {
  const h = harness({ random: () => 0.5 }); await h.ready();
  h.failReads(new Error('temporarily limited'));
  h.engine.setPlan(plan(80)); await h.time.tick(5000);
  const reads = h.reads();
  h.engine.setPlan(plan(90)); h.failReads(null);
  await h.time.tick(10499); assert.equal(h.reads(), reads);
  await h.time.tick(1); assert.equal(h.remote().plan.startingBalance, 90);
  assert.equal(h.writes.length, 1);
});

test('edits during an upload are queued and never falsely marked saved', async () => {
  const h = harness(); await h.ready(); let release;
  h.holdWrites(new Promise(resolve => { release = resolve; }));
  h.engine.setPlan(plan(80)); await h.time.tick(5000); assert.equal(h.writes.length, 1);
  h.engine.setPlan(plan(90)); await h.time.tick(5000); assert.equal(h.writes.length, 1);
  release(); await settle(); assert.equal(h.engine.snapshot().status, 'pending');
  assert.equal(h.remote().plan.startingBalance, 80);
  await h.time.tick(5000); assert.equal(h.writes.length, 2); assert.equal(h.remote().plan.startingBalance, 90);
});

test('a lost successful acknowledgement is reconciled without uploading twice', async () => {
  const h = harness(); await h.ready(); const write = h.transport.write;
  h.transport.write = async request => { await write(request); throw new Error('response lost'); };
  h.engine.setPlan(plan(80)); await h.time.tick(5000); await h.time.tick(10000);
  assert.equal(h.writes.length, 1); assert.equal(h.engine.snapshot().status, 'synced');
});

test('a stale write rejected by the server never falls back to unconditional overwrite', async () => {
  const h = harness(); await h.ready(); h.failWrites({ code: 'conflict' });
  h.engine.setPlan(plan(80)); await h.time.tick(60000);
  assert.equal(h.writes.length, 1); assert.equal(h.engine.snapshot().status, 'conflict');
  assert.equal(h.remote().plan.startingBalance, 1000);
});

test('storage failures block uploads rather than claim a recoverable pending change', async () => {
  const h = harness(); await h.ready(); h.storage.save = () => { throw new Error('quota'); };
  h.engine.setPlan(plan(80)); await h.time.tick(60000);
  assert.equal(h.writes.length, 0); assert.equal(h.engine.snapshot().status, 'storage');
});

test('malformed remote plans and wrong-account responses are not applied', async () => {
  for (const remote of [
    { accountId: 'account-a', plan: { unrelated: true }, revision: 'bad' },
    { accountId: 'other-account', plan: plan(), revision: 'r2' },
  ]) {
    const h = harness(); await h.ready(); h.changeRemote(remote); await h.engine.flush();
    assert.equal(h.adopted.length, 0); assert.equal(h.writes.length, 0);
    assert.ok(['remote', 'account'].includes(h.engine.snapshot().status));
  }
});

test('invalid payment dates and unfinished schedules stay local', () => {
  const payment = { id: 'p', name: 'Rent', amount: 100, direction: 'debit', scheduleType: 'adhoc', scheduleDate: '2026-02-30' };
  assert.equal(Sync.validPlan({ ...plan(), recurringRules: [payment] }), false);
  assert.equal(Sync.validPlan({ ...plan(), recurringRules: [{ ...payment, scheduleDate: '2026-10-28', pendingSchedule: true }] }), false);
});

test('background/resume checks with unchanged data cause no repeated storage or Drive writes', async () => {
  const h = harness(); await h.ready(); const count = h.saved.length;
  for (let i = 0; i < 4; i++) { h.engine.check(); await h.time.tick(0); }
  assert.equal(h.saved.length, count); assert.equal(h.writes.length, 0);
});

test('changes made while a conflict is open update the preserved local candidate', async () => {
  const h = harness({ record: null }); h.engine.setPlan(plan(80)); h.engine.enable(true); await h.ready();
  h.engine.setPlan(plan(85));
  assert.equal(h.engine.snapshot().conflict.local.startingBalance, 85);
  assert.equal(h.record().conflict.local.startingBalance, 85);
  assert.equal(h.writes.length, 0);
});

test('a second device winning an atomic write leaves the losing device in a recoverable conflict', async () => {
  const h = harness(); await h.ready(); const write = h.transport.write;
  h.transport.write = async request => {
    h.changeRemote({ accountId: 'account-a', revision: 'r2', plan: plan(95), savedAt: 'second-device' });
    return write(request);
  };
  h.engine.setPlan(plan(80)); await h.time.tick(5000);
  assert.equal(h.remote().plan.startingBalance, 95);
  assert.equal(h.engine.snapshot().status, 'conflict');
  assert.equal(h.engine.snapshot().conflict.remote.plan.startingBalance, 95);
  assert.equal(h.record().local.startingBalance, 80);
});

test('closing during upload does not drop the durable pending plan', async () => {
  const h = harness(); await h.ready(); let release;
  h.holdWrites(new Promise(resolve => { release = resolve; }));
  h.engine.setPlan(plan(80)); await h.time.tick(5000); h.engine.destroy();
  assert.equal(h.record().local.startingBalance, 80);
  release(); await settle();
  const next = harness({ record: h.record(), remote: h.remote() }); await next.ready();
  assert.equal(next.writes.length, 0); assert.equal(next.engine.snapshot().status, 'synced');
});

test('connecting from an example retrieves the personal Drive plan without uploading the example', async () => {
  const h = harness({ record: null }); h.engine.setPlan({ ...plan(80), sampleScenario: 'test' });
  h.engine.enable(true); await h.ready(); h.engine.retrieve(); await h.time.tick(0); await h.time.tick(60000);
  assert.equal(h.writes.length, 0); assert.equal(h.engine.snapshot().status, 'synced');
  assert.equal(h.adopted.at(-1).startingBalance, 1000);
  assert.equal(h.record().sample, false);
});

test('device focus events do not bypass the inactivity timer', async () => {
  const h = harness(); await h.ready(); h.engine.setPlan(plan(80));
  await h.time.tick(1000); h.engine.check(); await h.time.tick(1000);
  h.engine.check(); await h.time.tick(2999); assert.equal(h.writes.length, 0);
  await h.time.tick(1); assert.equal(h.writes.length, 1);
});

test('an unfinished input pauses uploads until its committed change is valid', async () => {
  const h = harness(); await h.ready(); h.engine.setPlan(plan(80)); h.engine.setEditing(true);
  await h.time.tick(60000); assert.equal(h.writes.length, 0);
  h.engine.setPlan(plan(90)); h.engine.setEditing(false); await h.time.tick(5000);
  assert.equal(h.remote().plan.startingBalance, 90);
});

test('actual one-time payment schema and inactive end limits remain syncable', () => {
  const oneTime = { id: 'p', name: 'Trip', amount: 100, direction: 'debit', scheduleType: 'adhoc', scheduleDate: '2026-11-01' };
  assert.equal(Sync.validPlan({ ...plan(), recurringRules: [oneTime] }), true);
  const monthly = { ...oneTime, scheduleType: 'monthly', dayOfMonth: 5, limitType: 'none', startDate: '2026-11-01', endDate: '2026-10-01' };
  assert.equal(Sync.validPlan({ ...plan(), recurringRules: [monthly] }), true);
});

test('an upload acknowledgement never claims an unfinished input was saved', async () => {
  const h = harness(); await h.ready(); let release;
  h.holdWrites(new Promise(resolve => { release = resolve; }));
  h.engine.setPlan(plan(80)); await h.time.tick(5000);
  h.engine.setEditing(true); release(); await settle();
  assert.equal(h.engine.snapshot().status, 'editing');
  const reads = h.reads(); h.engine.setEditing(false); await h.time.tick(5000);
  assert.equal(h.engine.snapshot().status, 'synced'); assert.equal(h.reads(), reads);
});

test('a restored Drive destination resumes only after an explicit retry', async () => {
  const h = harness(); await h.ready(); h.engine.setPlan(plan(80));
  const previous = h.remote(); h.changeRemote({ accountId: 'account-a', revision: null, plan: null, savedAt: null });
  await h.time.tick(5000); assert.equal(h.engine.snapshot().status, 'missing');
  h.changeRemote(previous); await h.engine.retry(); assert.equal(h.remote().plan.startingBalance, 80);
});

test('explicit replacement preserves local recovery and never blindly overwrites a newly recreated remote', async () => {
  const h = harness(); await h.ready(); h.engine.setPlan(plan(80));
  h.changeRemote({ accountId: 'account-a', revision: null, plan: null, savedAt: null });
  await h.time.tick(5000);
  h.changeRemote({ accountId: 'account-a', revision: 'r3', plan: plan(95), savedAt: 'another-device' });
  await h.engine.recreateRemote();
  assert.equal(h.writes.length, 0); assert.equal(h.engine.snapshot().status, 'conflict');
  assert.equal(h.record().recovery.local.startingBalance, 80);
});

test('edited examples stay local on resume, but explicit Drive retrieval replaces them without writes', async () => {
  const h = harness({ record: null });
  h.engine.setPlan({ ...plan(89000), sampleScenario: 'edited', planOrigin: 'example' });
  h.engine.enable(true); await h.ready();
  h.engine.check(); await h.time.tick(60000);
  assert.equal(h.writes.length, 0); assert.equal(h.adopted.length, 0);
  assert.equal(h.engine.snapshot().status, 'sample');
  h.engine.retrieve(); await h.time.tick(0);
  assert.equal(h.writes.length, 0); assert.equal(h.adopted.at(-1).startingBalance, 1000);
});

test('connecting an example to an account with no plan never creates a fictional file', async () => {
  const h = harness({ record: null, remote: { accountId: 'account-a', revision: null, plan: null } });
  h.engine.setPlan({ ...plan(8000), sampleScenario: 'fictional' });
  h.engine.enable(true); await h.ready(); h.engine.retrieve(); await h.time.tick(60000);
  assert.equal(h.engine.snapshot().status, 'noPlan');
  assert.equal(h.writes.length, 0); assert.equal(h.adopted.length, 0);
});

test('introductory state and an untouched personal draft retrieve Drive without publishing defaults', async () => {
  for (const origin of ['empty', 'personal']) {
    const h = harness({ record: null });
    h.engine.setPlan({ ...plan(0), planOrigin: origin, hasPersonalData: false });
    h.engine.enable(true); await h.ready();
    assert.equal(h.writes.length, 0); assert.equal(h.adopted.at(-1).startingBalance, 1000);
  }
});

test('explicit personal zero dollars requires review against a different Drive plan', async () => {
  const h = harness({ record: null });
  h.engine.setPlan({ ...plan(0), planOrigin: 'personal', hasPersonalData: true });
  h.engine.enable(true); await h.ready();
  assert.equal(h.engine.snapshot().status, 'conflict');
  assert.equal(h.writes.length, 0); assert.equal(h.adopted.length, 0);
});

test('a confirmed synced reset still clears the shared plan, and subsequent examples stay local', async () => {
  const h = harness(); await h.ready();
  h.engine.setPlan({ ...plan(0), planOrigin: 'empty', hasPersonalData: false, clearedPlan: true });
  await h.time.tick(5000);
  assert.equal(h.writes.length, 1); assert.equal(h.remote().plan.startingBalance, 0);
  h.engine.setPlan({ ...plan(950), sampleScenario: 'Cash shortfall', planOrigin: 'example' });
  h.engine.check(); await h.time.tick(60000);
  assert.equal(h.writes.length, 1); assert.equal(h.adopted.length, 0);
});

test('an example edit during Drive retrieval cancels adoption without publishing either version', async () => {
  let release;
  const readGate = new Promise(resolve => { release = resolve; });
  const h = harness({ record: null, transport: {
    read: () => readGate, write: () => { throw new Error('Example must never upload'); },
  } });
  h.engine.setPlan({ ...plan(100), sampleScenario: 'fictional' });
  h.engine.enable(true); await h.ready(); h.engine.retrieve(); await h.time.tick(0);
  h.engine.setPlan({ ...plan(200), sampleScenario: 'edited fictional' });
  release({ accountId: 'account-a', revision: 'r1', plan: plan(900) }); await settle();
  assert.equal(h.adopted.length, 0); assert.equal(h.record().local.startingBalance, 200);
});
