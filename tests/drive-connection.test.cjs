const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Sync = require('../driveSync.js');
const Connection = require('../driveConnection.js');
const source = fs.readFileSync(require('node:path').join(__dirname, '../app.js'), 'utf8');
const plan = (balance = 1000) => ({ startingBalance: balance, lastRefreshDate: '2026-10-28', startDate: '2026-10-28',
  projectionDays: 30, thresholds: { red: 100, yellow: 200, green: 300 }, skippedInstances: {}, recurringRules: [] });
const cloud = value => ({ id: 'existing', plan: value, savedAt: '2026-10-27T18:00:00Z' });
function include(ctx, from, to) { const start = source.indexOf(from); assert.ok(start >= 0); vm.runInContext(source.slice(start, source.indexOf(to, start)), ctx); }

test('fresh empty session adopts an existing real plan instead of proposing an upload', () => {
  assert.equal(Connection.decide(plan(0), cloud(plan())), 'adopt');
});
test('two existing different plans require review regardless of apparent recency', () => {
  assert.equal(Connection.decide(plan(1100), cloud(plan())), 'review');
});
test('matching financial data ignores appearance and export metadata', () => {
  assert.equal(Connection.decide({ ...plan(), rulesCollapsed: true }, cloud({ ...plan(), exportedAt: 'later' })), 'same');
});
test('empty or absent Drive plans cannot replace a populated device by default', () => {
  assert.equal(Connection.decide(plan(), cloud(plan(0))), 'empty-drive');
  assert.equal(Connection.decide(plan(), null), 'local-only');
  assert.equal(Connection.decide(plan(0), null), 'empty');
});
test('examples and malformed cloud data never take the automatic adoption path', () => {
  assert.equal(Connection.decide({ ...plan(0), sampleScenario: 'example' }, cloud(plan())), 'review');
  assert.equal(Connection.decide(plan(0), cloud({ ...plan(), sampleScenario: 'example' })), 'review');
  assert.throws(() => Connection.decide(plan(0), cloud({ startingBalance: 1000 })));
});

function saveHarness({ local = plan(), remote = cloud(plan(900)), accepted = true, draft = false } = {}) {
  const requests = [], messages = [], confirmations = [];
  const ctx = vm.createContext({ Date, JSON, URLSearchParams, window: { DriveSync: Sync, DriveConnection: Connection }, state: local,
    automaticDriveSync: null, driveConnection: null, showDataIssue: async (message, title) => messages.push({ message, title }),
    showDriveIssue: async error => { throw error; }, showDataStatus: message => messages.push({ message }),
    setLocalStorageValue() {}, syncDriveStatus() {}, DRIVE_BACKUP_AT_STORAGE_KEY: 'at',
    backupPayload: at => JSON.stringify({ version: 3, exportedAt: at.toISOString(), data: ctx.state }),
    requestDataConfirmation: async copy => { confirmations.push(copy); return accepted; },
    driveRequest: async (url, options) => { requests.push({ url, ...options }); return { json: async () => ({ id: 'new-file' }) }; },
  });
  include(ctx, '  function createDriveBackup(', '  async function readDriveConnection(');
  include(ctx, '  async function saveBackupToDrive(', '  function restoreBackupFromDrive(');
  ctx.hasDriveDraft = () => draft;
  ctx.readDriveConnection = async () => remote;
  return { ctx, requests, messages, confirmations };
}
test('empty, example and unfinished plans make no authorization request or file write', async () => {
  for (const options of [{ local: plan(0) }, { local: { ...plan(), sampleScenario: 'example' } }, { draft: true }]) {
    const h = saveHarness(options); h.ctx.readDriveConnection = () => { throw new Error('Must not authorize'); };
    await h.ctx.saveBackupToDrive(); assert.equal(h.requests.length, 0); assert.equal(h.confirmations.length, 0);
  }
});
test('saving with an existing Drive plan names its recency and cancellation writes nothing', async () => {
  const h = saveHarness({ accepted: false }); await h.ctx.saveBackupToDrive();
  assert.equal(h.requests.length, 0); assert.equal(h.confirmations.length, 1);
  assert.match(h.confirmations[0].message, /900\.00/); assert.match(h.confirmations[0].message, /will be kept/);
  assert.equal(h.confirmations[0].title, 'Save a separate Drive copy?');
});
test('a deliberate backup creates a new timestamped file and never PATCHes an older file', async () => {
  const h = saveHarness(); await h.ctx.saveBackupToDrive();
  assert.equal(h.requests.length, 1); assert.equal(h.requests[0].method, 'POST');
  assert.match(h.requests[0].url, /uploadType=multipart/);
  assert.match(h.requests[0].body, /am-i-going-broke-backup-\d{4}-/);
  assert.doesNotMatch(h.requests[0].url, /existing/);
});
test('unchanged data and changes during the review produce no new Drive file', async () => {
  const same = saveHarness({ remote: cloud(plan()) }); await same.ctx.saveBackupToDrive(); assert.equal(same.requests.length, 0);
  const changed = saveHarness(); changed.ctx.requestDataConfirmation = async () => { changed.ctx.state = plan(1500); return true; };
  await changed.ctx.saveBackupToDrive(); assert.equal(changed.requests.length, 0);
  assert.match(changed.messages.at(-1).message, /plan changed/);
});
test('connection discovery reads the active account afresh, preferring a current plan over snapshots', async () => {
  const requests = [];
  const copies = [{ id: 'copy', modifiedTime: '2026-10-28T14:00:00Z', appProperties: { purpose: 'manual-backup' } },
    { id: 'current', modifiedTime: '2026-10-27T14:00:00Z', appProperties: { purpose: 'sync-current' } }];
  const ctx = vm.createContext({ URLSearchParams, JSON, window: { DriveSync: Sync },
    readBackupState: parsed => parsed.data, driveRequest: async url => {
      requests.push(url);
      return url.includes('alt=media') ? { text: async () => JSON.stringify({ format: 1, plan: plan(), savedAt: '2026-10-27T14:00:00Z' }) } : { json: async () => ({ files: copies }) };
    } });
  include(ctx, '  async function readDriveConnection(', '  function hasDriveDraft(');
  const found = await ctx.readDriveConnection(); assert.equal(found.id, 'current');
  assert.equal(found.plan.startingBalance, 1000); assert.equal(requests.length, 2);
  await assert.rejects(ctx.readDriveConnection('deleted'), error => error.status === 404);
});
