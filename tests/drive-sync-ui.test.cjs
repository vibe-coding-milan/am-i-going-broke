const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../driveSyncUI.js'), 'utf8');

function fixture(flag, engine = {}) {
  let queries = 0;
  const context = vm.createContext({ URL, location: { href: 'https://amigoingbroke.me/', origin: 'https://amigoingbroke.me' },
    document: { querySelector(selector) { queries++; assert.equal(selector, 'meta[name="google-drive-sync-endpoint"]'); return flag === null ? null : { getAttribute: () => flag }; } },
    DriveSync: engine,
    fetch() { throw new Error('Disabled sync must make no requests'); },
  });
  Object.defineProperty(context, 'localStorage', { get() { throw new Error('Disabled sync must not access storage'); } });
  vm.runInContext(source, context);
  return { api: context.DriveSyncUI, queries: () => queries };
}
test('empty and absent feature flags leave the interface and existing app completely untouched', () => {
  for (const flag of ['', '   ', null]) {
    const f = fixture(flag);
    assert.equal(f.api.mount({ getPlan() { throw new Error('Must not inspect financial state'); } }), null);
    assert.equal(f.queries(), 1);
  }
});
test('an unavailable engine safely disables its optional interface', () => {
  assert.equal(fixture('/api/drive-sync.php', null).api.mount({}), null);
});
test('a foreign, credential-bearing, or malformed service URL is rejected before accessing storage', () => {
  for (const flag of ['https://untrusted.example/api', 'https://name:password@amigoingbroke.me/api', 'http://[invalid', '/api#fragment']) {
    assert.equal(fixture(flag).api.mount({}), null);
  }
});

const view = state => fixture('').api.connectionView({ available: true, ...state });
test('new and existing local-only users get one connect action before any sync switch', () => {
  const result = view({ authenticated: false });
  assert.equal(result.action, 'Connect Google Drive');
  assert.equal(result.setup, true);
  assert.equal(result.toggle, false);
  assert.match(result.description, /Different plans are reviewed/);
});
test('legacy Drive backup authorization never appears as automatic sync consent', () => {
  const result = view({ legacy: true });
  assert.equal(result.action, 'Connect Google Drive');
  assert.equal(result.toggle, false);
  assert.match(result.description, /sync your saved plan/);
  assert.equal(result.setup, true, 'old manual authorization never enables sync by itself');
});
test('an authenticated account still needs explicit setup on this device', () => {
  const result = view({ authenticated: true });
  assert.equal(result.action, 'Connect Google Drive');
  assert.equal(result.setup, true);
  assert.equal(result.toggle, false);
});
test('an established connection uses the pause/resume switch without a second setup action', () => {
  const result = view({ authenticated: true, ready: true });
  assert.equal(result.setup, false);
  assert.equal(result.toggle, true);
  assert.match(result.description, /When automatic sync is on/);
});
test('expired authorization takes precedence over remembered setup', () => {
  const result = view({ authenticated: true, ready: true, expired: true });
  assert.equal(result.action, 'Reconnect Google Drive');
  assert.equal(result.toggle, false);
});
test('another account requires deliberate review even when previously configured', () => {
  const result = view({ authenticated: true, ready: true, otherAccount: true });
  assert.equal(result.action, 'Set up this account');
  assert.equal(result.toggle, false);
  assert.match(result.description, /nothing will upload automatically/);
});
test('service outages offer no connection or toggle that could imply successful setup', () => {
  const result = view({ available: false, authenticated: true, ready: true });
  assert.equal(result.setup, false);
  assert.equal(result.toggle, false);
  assert.match(result.description, /file backups remain available/);
  const existing = view({ available: false, remembered: true });
  assert.equal(existing.setup, false);
  assert.equal(existing.toggle, true, 'an existing user can still pause pending transfers during an outage');
});

test('rapid foreground returns schedule a trailing refresh instead of losing the device check', () => {
  let now = 100000, checks = 0, job = null;
  const context = vm.createContext({ Date: { now: () => now }, resumeTimer: null, lastCheck: 0,
    document: { visibilityState: 'visible' }, controller: { check() { checks++; } },
    setTimeout(fn, wait) { job = { fn, wait }; return 1; }, clearTimeout() { job = null; },
  });
  const start = source.indexOf('    function resume()');
  const end = source.indexOf('    window.addEventListener("focus"', start);
  vm.runInContext(source.slice(start, end), context);
  context.resume(); assert.equal(checks, 1);
  now += 1000; context.resume(); assert.equal(checks, 1); assert.equal(job.wait, 9000);
  now += 9000; job.fn(); assert.equal(checks, 2);
  now += 1000; context.resume();
  context.document.visibilityState = 'hidden'; context.resume();
  assert.equal(job, null); assert.equal(checks, 2);
});

test('confirmation cancellation returns to sync settings while ordinary Data dialogs retain their menu', async () => {
  const app = fs.readFileSync(require('node:path').join(__dirname, '../app.js'), 'utf8');
  for (const fromSync of [false, true]) {
    let closed, focused = '';
    const focusTarget = { disabled: false, focus() { focused = 'origin'; } };
    const sync = { open: fromSync, contains: () => true, close() { this.open = false; }, showModal() { this.open = true; } };
    const dialog = { classList: { toggle() {} }, addEventListener(event, fn) { closed = fn; }, removeEventListener() {}, showModal() {} };
    const menu = { open: true, contains: () => true, setAttribute() { this.open = true; }, querySelector: () => focusTarget };
    const ctx = vm.createContext({ Promise, document: { activeElement: focusTarget, querySelector(selector) { return selector === '.sync-settings' ? sync : { classList: { toggle() {} } }; } },
      canDownloadPlan: () => true, dataDialog: dialog, dataDialogTitle: {}, dataDialogMessage: {}, dataDialogConfirm: { classList: { toggle() {} } },
      dataDialogCancel: { classList: { toggle() {} } }, dataMenu: menu, closeDataMenu() { menu.open = false; } });
    const start = app.indexOf('  function requestDataConfirmation(');
    vm.runInContext(app.slice(start, app.indexOf('  function showDataIssue(', start)), ctx);
    const pending = ctx.requestDataConfirmation({ title: 'Restore?', message: 'Confirm replacement', action: 'Restore' });
    assert.equal(sync.open, false); assert.equal(menu.open, false);
    dialog.returnValue = ''; closed(); assert.equal(await pending, false);
    assert.equal(sync.open, fromSync); assert.equal(menu.open, !fromSync);
    assert.equal(focused, 'origin');
  }
});
