(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PlanData = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function create(options) {
    var calendar = options.calendar;
    var makeId = options.makeId;
    var ruleName = options.ruleName || "New money move";
    var todayInputValue = calendar.todayInputValue;
    var isValidInputDate = calendar.isValidInputDate;
    var STORAGE_VERSION = 3;
    var MAX_CASH_BALANCE = 999999999.999;

    var defaultState = {
      startDate: todayInputValue(),
      lastRefreshDate: todayInputValue(),
      startingBalance: 0,
      projectionDays: 30,
      sampleScenario: "",
      planOrigin: "empty",
      hasPersonalData: false,
      clearedPlan: false,
      rulesCollapsed: false,
      ruleGroups: {
        moneyInOpen: true,
        moneyOutOpen: true,
      },
      thresholds: {
        red: 1000,
        yellow: 2000,
        green: 5000,
      },
      skippedInstances: {},
      showCushionLines: true,
      showAverageBalance: true,
      showExtremaPoints: true,
      recurringRules: [],
    };

    function cloneDefaultState() {
      return JSON.parse(JSON.stringify(defaultState));
    }

    function normalizeState(candidate) {
      var next = candidate || {};
      return {
        startDate: todayInputValue(),
        lastRefreshDate: next.lastRefreshDate || next.startDate || todayInputValue(),
        startingBalance: clampCashBalance(Number(next.startingBalance || 0)),
        projectionDays: Number(next.projectionDays || 30),
        sampleScenario: typeof next.sampleScenario === "string" ? next.sampleScenario : "",
        sampleScenarioKey: typeof next.sampleScenarioKey === "string" ? next.sampleScenarioKey : "",
        sampleStory: typeof next.sampleStory === "string" ? next.sampleStory : "",
        // Legacy saved plans are conservatively personal, even at zero dollars.
        planOrigin: next.sampleScenario ? "example" : ["empty", "personal"].indexOf(next.planOrigin) !== -1
          ? next.planOrigin : Array.isArray(next.recurringRules) ? "personal" : "empty",
        hasPersonalData: !next.sampleScenario && (next.hasPersonalData === true ||
          (next.planOrigin === undefined && Array.isArray(next.recurringRules)) ||
          Number(next.startingBalance || 0) !== 0 || (next.recurringRules || []).length > 0),
        clearedPlan: next.clearedPlan === true,
        rulesCollapsed: Boolean(next.rulesCollapsed),
        ruleGroups: {
          moneyInOpen:
            next.ruleGroups && typeof next.ruleGroups.moneyInOpen === "boolean"
              ? next.ruleGroups.moneyInOpen
              : true,
          moneyOutOpen:
            next.ruleGroups && typeof next.ruleGroups.moneyOutOpen === "boolean"
              ? next.ruleGroups.moneyOutOpen
              : true,
        },
        thresholds: {
          red:
            next.thresholds && Number.isFinite(Number(next.thresholds.red))
              ? Number(next.thresholds.red)
              : 1000,
          yellow:
            next.thresholds && Number.isFinite(Number(next.thresholds.yellow))
              ? Number(next.thresholds.yellow)
              : 2000,
          green:
            next.thresholds && Number.isFinite(Number(next.thresholds.green))
              ? Number(next.thresholds.green)
              : 5000,
        },
        skippedInstances:
          next.skippedInstances && typeof next.skippedInstances === "object"
            ? Object.keys(next.skippedInstances).reduce(function (result, key) {
                result[key] = Boolean(next.skippedInstances[key]);
                return result;
              }, {})
            : {},
        showCushionLines: next.showCushionLines !== false,
        showAverageBalance: next.showAverageBalance !== false,
        showExtremaPoints: next.showExtremaPoints !== false,
        recurringRules: Array.isArray(next.recurringRules)
          ? next.recurringRules.map(function (rule, index) {
              return {
                id: rule.id || makeId("rule"),
                name: rule.name || ruleName,
                direction: rule.direction === "credit" ? "credit" : "debit",
                amount: Number(rule.amount || 0),
                variable: Boolean(rule.variable),
                active: rule.active !== false,
                scheduleType: rule.scheduleType || "monthly",
                dayOfMonth: Number(rule.dayOfMonth || 1),
                dayOfWeek: Number(rule.dayOfWeek || 0),
                calculationOrder: Number.isFinite(rule.calculationOrder) ? rule.calculationOrder : index,
                pendingSchedule: Boolean(rule.pendingSchedule),
                scheduleDate: Object.prototype.hasOwnProperty.call(rule, "scheduleDate") ? (rule.scheduleDate || "") : todayInputValue(),
                startDate: rule.startDate || (rule.limitType === "count" && typeof rule.pendingSchedule === "undefined" ? next.startDate || todayInputValue() : ""),
                limitType:
                  rule.limitType === "count" || rule.limitType === "date" ? rule.limitType : "none",
                instanceLimit: Math.max(1, Number(rule.instanceLimit || 1)),
                endDate: rule.endDate || "",
              };
            })
          : [],
      };
    }

    function readBackupState(parsed) {
      var candidate = parsed && (parsed.data || parsed);
      if (!candidate || typeof candidate !== "object" || !Array.isArray(candidate.recurringRules) ||
          !Object.prototype.hasOwnProperty.call(candidate, "startingBalance") ||
          !Number.isFinite(Number(candidate.startingBalance)) ||
          (candidate.startDate && !isValidInputDate(candidate.startDate)) ||
          (candidate.projectionDays && [30, 60, 90, 120, 180, 365].indexOf(Number(candidate.projectionDays)) === -1) ||
          candidate.recurringRules.some(function (rule) {
            return !rule || !Number.isFinite(Number(rule.amount)) ||
              (rule.startDate && !isValidInputDate(rule.startDate)) ||
              (rule.endDate && !isValidInputDate(rule.endDate)) ||
              (rule.scheduleDate && !isValidInputDate(rule.scheduleDate));
          })) {
        throw Object.assign(new Error("This file is not a valid financial plan backup. Your current plan is unchanged."), { code: "backup_invalid" });
      }
      if (parsed.version && Number(parsed.version) > STORAGE_VERSION) {
        throw Object.assign(new Error("This backup was made by a newer app version. Your current plan is unchanged."), { code: "backup_newer" });
      }
      var restored = normalizeState(candidate);
      if (!restored.sampleScenario) {
        restored.planOrigin = "personal";
        restored.hasPersonalData = true;
        restored.clearedPlan = false;
      }
      return restored;
    }

    function clampCashBalance(value) {
      return Math.max(-MAX_CASH_BALANCE, Math.min(MAX_CASH_BALANCE, Number(value || 0)));
    }

    function exportFilename(date) {
      return "am-i-going-broke-" + date.toISOString().replace(/[:.]/g, "-") + ".json";
    }

    function backupPayload(state, exportedAt) {
      return JSON.stringify(
        {
          version: STORAGE_VERSION,
          exportedAt: (exportedAt || new Date()).toISOString(),
          data: state,
        },
        null,
        2,
      );
    }

    return { defaultState: defaultState, version: STORAGE_VERSION,
      cloneDefaultState: cloneDefaultState,
      normalizeState: normalizeState,
      readBackupState: readBackupState,
      clampCashBalance: clampCashBalance,
      exportFilename: exportFilename,
      backupPayload: backupPayload
    };
  }
  return { create: create };
});
