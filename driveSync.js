(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DriveSync = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // Sync financial meaning, not rendering state, generated dates, or export timestamps.
  function planData(plan) {
    return {
      lastRefreshDate: plan.lastRefreshDate || plan.startDate,
      startingBalance: plan.startingBalance,
      projectionDays: plan.projectionDays,
      thresholds: plan.thresholds,
      skippedInstances: plan.skippedInstances || {},
      recurringRules: plan.recurringRules,
    };
  }

  function stableJSON(value) {
    if (typeof value === "number" && !Number.isFinite(value)) throw new Error("Invalid number");
    if (Array.isArray(value)) return "[" + value.map(stableJSON).join(",") + "]";
    if (value && typeof value === "object") {
      return "{" + Object.keys(value).filter(function (key) {
        return value[key] !== undefined;
      }).sort().map(function (key) {
        return JSON.stringify(key) + ":" + stableJSON(value[key]);
      }).join(",") + "}";
    }
    return JSON.stringify(value);
  }

  function fingerprint(plan) { return stableJSON(planData(plan)); }
  function copy(value) { return JSON.parse(JSON.stringify(value)); }

  function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
    var date = new Date(value + "T12:00:00Z");
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  function validPlan(plan) {
    return !!plan && Number.isFinite(plan.startingBalance) &&
      validDate(plan.lastRefreshDate || plan.startDate) &&
      [30, 60, 90, 120, 180, 365].indexOf(plan.projectionDays) !== -1 &&
      !!plan.thresholds && ["red", "yellow", "green"].every(function (key) {
        return Number.isFinite(plan.thresholds[key]);
      }) && plan.thresholds.red <= plan.thresholds.yellow &&
      plan.thresholds.yellow <= plan.thresholds.green &&
      Array.isArray(plan.recurringRules) && plan.recurringRules.length <= 500 &&
      new Set(plan.recurringRules.map(function (rule) { return rule && rule.id; })).size === plan.recurringRules.length &&
      plan.recurringRules.every(function (rule) {
        return !!rule && typeof rule.id === "string" && rule.id.length > 0 &&
          typeof rule.name === "string" && rule.name.trim().length > 0 &&
          Number.isFinite(rule.amount) && rule.amount >= 0 && !rule.pendingSchedule &&
          ["credit", "debit"].indexOf(rule.direction) !== -1 &&
          ["weekly", "biweekly", "monthly", "adhoc"].indexOf(rule.scheduleType) !== -1 &&
          (!rule.startDate || validDate(rule.startDate)) &&
          (!rule.endDate || validDate(rule.endDate)) &&
          (rule.limitType !== "date" || !(rule.startDate && rule.endDate) || rule.startDate <= rule.endDate) &&
          (rule.scheduleType !== "monthly" || (Number.isInteger(rule.dayOfMonth) && rule.dayOfMonth >= 1 && rule.dayOfMonth <= 31)) &&
          (["weekly", "biweekly"].indexOf(rule.scheduleType) === -1 ||
            (Number.isInteger(rule.dayOfWeek) && rule.dayOfWeek >= 0 && rule.dayOfWeek <= 6)) &&
          (["biweekly", "adhoc"].indexOf(rule.scheduleType) === -1 || validDate(rule.scheduleDate)) &&
          (rule.limitType !== "count" || (Number.isInteger(rule.instanceLimit) && rule.instanceLimit > 0)) &&
          (rule.limitType !== "count" || ["biweekly", "adhoc"].indexOf(rule.scheduleType) !== -1 || validDate(rule.startDate)) &&
          (rule.limitType !== "date" || validDate(rule.endDate));
      });
  }

  function emptyPlan(plan) {
    return plan.startingBalance === 0 && plan.recurringRules.length === 0;
  }

  function create(options) {
    if (!options || !options.accountId || !options.storage || !options.transport ||
        typeof options.transport.read !== "function" || typeof options.transport.write !== "function") {
      throw new Error("Sync requires an account-bound durable store and versioned transport");
    }
    var accountId = options.accountId;
    var clock = options.clock || {
      now: Date.now,
      setTimeout: function (fn, delay) { return setTimeout(fn, delay); },
      clearTimeout: function (id) { clearTimeout(id); },
    };
    var delay = options.delay == null ? 5000 : options.delay;
    var maxWait = options.maxWait == null ? 30000 : options.maxWait;
    var validate = options.validate || validPlan;
    var timer = null;
    var firstEditAt = null;
    var lastEditAt = null;
    var inFlight = null;
    var online = true;
    var editing = false;
    var destroyed = false;
    var paused = null;
    var retryCount = 0;
    var retryNotBefore = 0;
    var conflict = null;
    var status = "off";
    var pendingOperation = null;
    var stored = options.storage.load(accountId);
    if (stored && stored.accountId !== accountId) throw new Error("Account mismatch in saved sync state");
    var record = stored ? copy(stored) : {
      schema: 1, accountId: accountId, enabled: false, revision: null,
      base: null, local: null, savedAt: null, sample: false,
    };
    if (record.schema !== 1) throw new Error("Unsupported saved sync format");
    if (record.local) record.local = copy(planData(record.local));
    // Even an opted-in returning user must establish a valid server session first.
    var authenticated = false;

    function emit(next) {
      if (destroyed) return;
      status = next;
      if (options.onStatus) options.onStatus(snapshot());
    }

    function snapshot() {
      return {
        status: status, enabled: record.enabled, accountId: accountId,
        savedAt: record.savedAt, revision: record.revision,
        conflict: conflict ? copy(conflict) : null,
      };
    }

    function persist() {
      try { options.storage.save(accountId, copy(record)); return true; }
      catch (error) { paused = "storage"; emit("storage"); return false; }
    }

    function cancelTimer() {
      if (timer !== null) clock.clearTimeout(timer);
      timer = null;
    }

    function eligible() {
      return !destroyed && record.enabled && authenticated && !paused && !editing &&
        record.local && !record.sample && validate(record.local);
    }

    function dirty() { return record.local && fingerprint(record.local) !== record.base; }

    function schedule(wait) {
      cancelTimer();
      if (!eligible()) {
        if (!destroyed) emit(!record.enabled ? "off" : (paused || (editing ? "editing" : (!authenticated ? "reconnect" :
          (record.sample ? "sample" : (record.local ? "invalid" : "local"))))));
        return;
      }
      if (!online) { emit("offline"); return; }
      if (inFlight) return;
      emit(retryNotBefore > clock.now() ? "retrying" : (dirty() ? "pending" : "checking"));
      timer = clock.setTimeout(function () { timer = null; flush(); }, Math.max(0, wait, retryNotBefore - clock.now()));
    }

    function setPlan(plan) {
      if (destroyed) return;
      var local;
      try { local = copy(planData(plan)); }
      catch (error) { paused = "invalid"; cancelTimer(); emit("invalid"); return; }
      var sample = !!plan.sampleScenario;
      if (record.local && stableJSON(local) === stableJSON(record.local) && sample === record.sample) return;
      record.local = local;
      record.sample = sample;
      if (conflict) {
        conflict.local = copy(local);
        record.conflict = copy(conflict);
      }
      pendingOperation = null;
      if (paused === "invalid") paused = null;
      if (!persist()) { cancelTimer(); return; }
      cancelTimer();
      if (sample || !validate(local)) {
        firstEditAt = null;
        emit(sample ? "sample" : "invalid");
        return;
      }
      if (!record.enabled) { emit("off"); return; }
      if (!authenticated) { emit("reconnect"); return; }
      if (paused) { emit(paused); return; }
      if (firstEditAt === null) firstEditAt = clock.now();
      lastEditAt = clock.now();
      schedule(Math.min(delay, Math.max(0, firstEditAt + maxWait - clock.now())));
    }

    function verifyRemote(remote) {
      if (!remote || remote.accountId !== accountId) throw Object.assign(new Error("Account changed"), { code: "account" });
      if (remote.plan !== null && (!validate(remote.plan) || !remote.revision)) {
        throw Object.assign(new Error("Invalid remote plan"), { code: "remote" });
      }
      return remote;
    }

    function fail(error) {
      var code = error && error.code;
      if (["auth", "account", "missing", "remote", "conflict"].indexOf(code) !== -1) {
        paused = code === "auth" ? "reconnect" : code;
        if (code === "auth") authenticated = false;
        emit(paused);
      } else {
        retryCount += 1;
        // At most one request in flight. A fresh edit cannot bypass a scheduled retry.
        retryNotBefore = clock.now() + Math.min(300000, 5000 * Math.pow(2, Math.min(retryCount, 6)));
        emit(online ? "retrying" : "offline");
      }
    }

    function saveConflict(remote, reason) {
      conflict = { local: copy(record.local), remote: copy(remote), reason: reason };
      paused = "conflict";
      // Preserve both candidates durably before offering a resolution.
      record.conflict = copy(conflict);
      persist();
      emit("conflict");
    }

    async function cycle() {
      try {
        var remote = verifyRemote(await options.transport.read({ accountId: accountId }));
        if (!eligible() || !online) return;
        var localKey = fingerprint(record.local);
        var remoteKey = remote.plan === null ? null : fingerprint(remote.plan);
        if (localKey === remoteKey) {
          var changed = record.base !== remoteKey || record.revision !== remote.revision ||
            record.savedAt !== remote.savedAt || record.conflict;
          record.base = remoteKey;
          record.revision = remote.revision;
          record.savedAt = remote.savedAt;
          record.conflict = null;
          retryCount = 0;
          retryNotBefore = 0;
          firstEditAt = null;
          pendingOperation = null;
          if (!changed || persist()) emit("synced");
          return;
        }
        if (remote.plan === null && record.revision !== null) {
          paused = "missing"; emit("missing"); return;
        }
        var firstConnection = record.base === null && record.revision === null;
        if (remote.plan !== null && firstConnection && emptyPlan(record.local)) {
          // An empty new browser must never erase an existing Drive plan.
          record.local = copy(remote.plan);
          record.base = remoteKey;
          record.revision = remote.revision;
          record.savedAt = remote.savedAt;
          if (persist()) {
            if (options.onRemote) options.onRemote(copy(remote.plan));
            emit("synced");
          }
          return;
        }
        if (remote.plan !== null && firstConnection) {
          saveConflict(remote, "setup"); return;
        }
        if (remote.revision !== record.revision) {
          if (localKey === record.base && remote.plan !== null) {
            record.local = copy(remote.plan);
            record.base = remoteKey;
            record.revision = remote.revision;
            record.savedAt = remote.savedAt;
            if (persist()) {
              if (options.onRemote) options.onRemote(copy(remote.plan));
              emit("synced");
            }
            return;
          }
          saveConflict(remote, "concurrent"); return;
        }
        if (remote.plan === null && emptyPlan(record.local)) { emit("local"); return; }
        var sending = copy(record.local);
        var sendingKey = fingerprint(sending);
        if (!pendingOperation || pendingOperation.key !== sendingKey || pendingOperation.revision !== remote.revision) {
          pendingOperation = {
            key: sendingKey, revision: remote.revision,
            id: options.operationId ? options.operationId() : accountId + ":" + clock.now() + ":" + Math.random().toString(36).slice(2),
          };
        }
        emit("saving");
        // The transport MUST atomically reject a stale expectedRevision and deduplicate operationId.
        var saved = verifyRemote(await options.transport.write({
          accountId: accountId, expectedRevision: remote.revision,
          operationId: pendingOperation.id, plan: sending,
        }));
        if (destroyed) return;
        if (saved.plan === null || fingerprint(saved.plan) !== sendingKey) {
          throw Object.assign(new Error("Write acknowledgement does not match sent plan"), { code: "remote" });
        }
        record.base = sendingKey;
        record.revision = saved.revision;
        record.savedAt = saved.savedAt;
        retryCount = 0;
        retryNotBefore = 0;
        firstEditAt = null;
        pendingOperation = null;
        if (persist()) emit(!record.enabled ? "off" : (editing ? "editing" : (record.sample ? "sample" :
          (!validate(record.local) ? "invalid" : (dirty() ? "pending" : "synced")))));
      } catch (error) {
        if (destroyed) return;
        if (error && error.code === "conflict" && eligible()) {
          try {
            var latest = verifyRemote(await options.transport.read({ accountId: accountId }));
            if (eligible()) saveConflict(latest, "concurrent");
          } catch (readError) { if (!destroyed) fail(readError); }
        } else fail(error);
      }
    }

    function flush() {
      cancelTimer();
      if (!eligible()) return Promise.resolve();
      if (!online) { emit("offline"); return Promise.resolve(); }
      if (inFlight) return inFlight;
      inFlight = cycle().finally(function () {
        inFlight = null;
        // A newer edit made during upload must be queued, never marked as the saved version.
        if (eligible() && timer === null && (status === "retrying" || (dirty() && status === "pending"))) schedule(delay);
      });
      return inFlight;
    }

    function enable(value) {
      cancelTimer();
      record.enabled = value === true;
      if (!persist()) return;
      if (!record.enabled) { emit("off"); return; }
      if (!authenticated) { emit("reconnect"); return; }
      schedule(0);
    }

    function authorize(sessionAccountId) {
      if (sessionAccountId !== accountId) {
        authenticated = false; paused = "account"; cancelTimer(); emit("account"); return;
      }
      authenticated = true;
      if (paused === "reconnect" || paused === "account") paused = null;
      if (record.enabled) schedule(0);
    }

    function setOnline(value) {
      online = value === true;
      if (!online) { cancelTimer(); if (record.enabled) emit("offline"); }
      else if (record.enabled) schedule(delay);
    }

    async function resolveConflict(choice) {
      if (!conflict || ["local", "remote"].indexOf(choice) === -1) return;
      var remote = conflict.remote;
      var selected = choice === "local" ? record.local : remote.plan;
      if (!selected || (choice === "local" && (record.sample || !validate(selected)))) return;
      // A fixed, bounded recovery slot, not a file per edit.
      record.recovery = { local: copy(record.local), remote: copy(remote), at: clock.now() };
      record.local = copy(selected);
      if (choice === "remote") record.sample = false;
      record.base = remote.plan ? fingerprint(remote.plan) : null;
      record.revision = remote.revision;
      record.conflict = null;
      if (!persist()) return;
      conflict = null;
      paused = null;
      if (choice === "remote" && options.onRemote) options.onRemote(copy(selected));
      // Re-read before writing: remote could have changed while the dialog was open.
      return flush();
    }

    if (record.conflict) { conflict = copy(record.conflict); paused = "conflict"; }
    emit(record.enabled ? (paused || "reconnect") : "off");
    return {
      setPlan: setPlan, enable: enable, authorize: authorize, flush: flush,
      setOnline: setOnline, resolveConflict: resolveConflict, snapshot: snapshot,
      recovery: function () { return record.recovery ? copy(record.recovery) : null; },
      retry: function () {
        if (["missing", "remote", "storage"].indexOf(paused) === -1) return Promise.resolve();
        if (!persist()) return Promise.resolve();
        paused = record.conflict ? "conflict" : null;
        if (paused) { emit(paused); return Promise.resolve(); }
        return flush();
      },
      recreateRemote: function () {
        if (paused !== "missing") return Promise.resolve();
        record.recovery = { local: copy(record.local), previousRevision: record.revision, at: clock.now() };
        record.revision = null; record.base = null;
        if (!persist()) return Promise.resolve();
        paused = null;
        return flush();
      },
      setEditing: function (value) {
        editing = value === true;
        if (editing) { cancelTimer(); if (record.enabled) emit("editing"); }
        else if (record.enabled) {
          if (!dirty() && eligible()) emit("synced");
          else schedule(delay);
        }
      },
      check: function () {
        if (!record.enabled) return;
        // Focus/resume events must not defeat the editing inactivity window.
        var wait = dirty() && firstEditAt !== null && lastEditAt !== null
          ? Math.min(Math.max(0, lastEditAt + delay - clock.now()),
            Math.max(0, firstEditAt + maxWait - clock.now())) : 0;
        schedule(wait);
      },
      destroy: function () { destroyed = true; authenticated = false; cancelTimer(); },
    };
  }

  return { create: create, fingerprint: fingerprint, planData: planData, validPlan: validPlan };
});
