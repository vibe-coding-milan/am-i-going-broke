(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PlanRepository = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function create(options) {
    var storage = options.storage;
    var data = options.planData;
    var key = "cash-flow-projector-state";
    var legacyKeys = ["cash-flow-projector-state-v3", "cash-flow-projector-state-v2", "cash-flow-projector-state-v1"];
    var now = options.now || function () { return new Date().toISOString(); };

    function save(plan) {
      var previous = null;
      try { previous = JSON.parse(storage.getItem(key)); } catch (error) { /* Unreadable metadata must not block saving. */ }
      var planSavedAt = previous && previous.planSavedAt || null;
      try {
        if (options.fingerprint && (!previous || !previous.data ||
            options.fingerprint(data.normalizeState(previous.data)) !== options.fingerprint(plan))) {
          planSavedAt = now();
        }
      } catch (error) { /* Unfinished inputs must still save locally. */ }
      storage.setItem(key, JSON.stringify({ version: data.version, exportedAt: now(), planSavedAt: planSavedAt, data: plan }));
    }

    function load() {
      try {
        var raw = storage.getItem(key);
        var parsed;
        if (!raw) {
          for (var i = 0; i < legacyKeys.length; i += 1) {
            raw = storage.getItem(legacyKeys[i]);
            if (raw) {
              parsed = JSON.parse(raw);
              var migrated = data.normalizeState(parsed.data || parsed);
              // Keep the existing migration save/error presentation and notification path.
              options.saveMigrated(migrated);
              return migrated;
            }
          }
          return data.cloneDefaultState();
        }
        parsed = JSON.parse(raw);
        return data.normalizeState(parsed && parsed.version && parsed.data ? parsed.data : parsed);
      } catch (error) { return data.cloneDefaultState(); }
    }

    function savedAt(plan) {
      try {
        var saved = JSON.parse(storage.getItem(key));
        return options.fingerprint(saved.data) === options.fingerprint(plan) ? saved.planSavedAt || null : null;
      } catch (error) { return null; }
    }
    return { save: save, load: load, savedAt: savedAt };
  }
  return { create: create };
});
