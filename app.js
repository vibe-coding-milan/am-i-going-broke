(function () {
  function todayInputValue() {
    var today = new Date();
    return dateInputValue(today);
  }

  function dateInputValue(date) {
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, "0");
    var day = String(date.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function exportFilename(date) {
    return "am-i-going-broke-" + date.toISOString().replace(/[:.]/g, "-") + ".json";
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function parseInputDate(value) {
    var parts = String(value || "").split("-");
    if (parts.length !== 3) {
      return startOfDay(new Date());
    }
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }

  function addDays(date, days) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
  }

  function calendarDayNumber(date) {
    return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;
  }

  function isValidInputDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value || "") &&
      dateInputValue(parseInputDate(value)) === value;
  }

  function formatDate(date) {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(date);
  }

  function formatShortDate(date) {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    }).format(date);
  }

  function formatProjectionHealthDate(dateKey) {
    var date = parseInputDate(dateKey);

    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  }

  function formatCurrency(amount) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  }

  function makeId(prefix) {
    return prefix + "-" + Date.now() + "-" + Math.floor(Math.random() * 1000000);
  }

  var defaultState = {
    startDate: todayInputValue(),
    lastRefreshDate: todayInputValue(),
    startingBalance: 0,
    projectionDays: 30,
    sampleScenario: "",
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

  var STORAGE_KEY = "cash-flow-projector-state";
  var THEME_STORAGE_KEY = "cash-flow-projector-theme-preference";
  var DRIVE_FILE_ID_STORAGE_KEY = "cash-flow-projector-drive-file-id";
  var DRIVE_BACKUP_AT_STORAGE_KEY = "cash-flow-projector-last-drive-backup-at";
  var DRIVE_CONNECTED_STORAGE_KEY = "cash-flow-projector-drive-connected";
  var DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
  var DRIVE_BACKUP_FILENAME = "am-i-going-broke-data.json";
  var LEGACY_STORAGE_KEYS = [
    "cash-flow-projector-state-v3",
    "cash-flow-projector-state-v2",
    "cash-flow-projector-state-v1",
  ];
  var STORAGE_VERSION = 3;
  var MAX_CASH_BALANCE = 999999999.999;
  var FALLBACK_SEMANTIC_COLORS = {
    positive: { r: 39, g: 245, b: 154 },
    warning: { r: 255, g: 209, b: 102 },
    danger: { r: 255, g: 77, b: 109 },
  };
  var THEME_ASSETS = {
    dark: {
      logo: "./assets/logo-icon.svg",
      favicon: "./assets/logo-icon.svg",
    },
    light: {
      logo: "./assets/logo-icon-light.svg",
      favicon: "./assets/logo-icon-light.svg",
    },
  };
  var UI_COPY = {
    defaults: {
      ruleName: "New money move",
      moneyInRuleName: "Payday or money in",
      moneyOutRuleName: "Bill or money out",
    },
    buttons: {
      showItems: "Show payments",
      hideItems: "Hide payments",
    },
    labels: {
      startingBalance: "Starting balance",
      forecast: "Your money forecast",
      upcomingMoneyIn: "Money in",
      upcomingMoneyOut: "Money out",
      outsideWindow: "Outside current window",
      excluded: "Excluded",
      setupForecast: "Setup",
    },
    status: {
      refreshed: "Numbers rerun from today.",
      projectionWindowUpdated: "Forecast window updated.",
      cushionUpdated: "Cushion target updated.",
      sampleLoaded: "Sample scenario loaded.",
      backupDownloaded: "Download requested. Check your browser’s Downloads for the JSON backup.",
      importSuccess: "Backup restored from file.",
      driveConnected: "Google Drive connected.",
      driveSaved: "Backup saved to Drive.",
      driveRestored: "Backup restored from Drive.",
      driveFailed: "Drive backup failed. Your browser data is unchanged.",
      resetSuccess: "Start over complete. Fresh plan ready.",
      addedMoneyIn: "Added money in.",
      addedMoneyOut: "Added money out.",
      removedItem: "Item removed from the plan.",
      includedItem: "Included again for this scenario.",
      excludedItem: "Excluded for this scenario.",
    },
    setup: {
      status: "Ready when you are",
      headline: "Start with the cash you have today.",
      summary:
        "Add a balance, paycheck, bill, or one-time money move. Then this becomes a real forecast instead of a dramatic guess.",
      action: "Start with the number in your checking account. You can adjust the cushion target later.",
    },
    errors: {
      cushionOrder: "Keep red lowest, yellow in the middle, and green highest.",
      importInvalid: "We couldn't load that file. Choose a valid JSON export.",
      driveNotConfigured:
        "Google Drive backup needs a Google OAuth client ID before it can connect.",
    },
    confirms: {
      reset: {
        title: "Start over?",
        message: "This clears the plan saved on this device. Downloaded and Drive backups stay intact.",
        action: "Clear plan",
      },
      restoreFile: {
        title: "Restore this backup?",
        message: "Your current plan on this device will be replaced with the selected backup.",
        action: "Restore",
      },
      restoreDrive: {
        title: "Restore from Drive?",
        message: "Your current plan on this device will be replaced with your Drive backup.",
        action: "Restore",
      },
      overwriteDrive: {
        title: "Update Drive backup?",
        message: "This replaces the existing Drive backup with your current plan.",
        action: "Update backup",
      },
    },
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
              name: rule.name || UI_COPY.defaults.ruleName,
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

  function saveState(state) {
    try {
      window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: STORAGE_VERSION,
        exportedAt: new Date().toISOString(),
        data: state,
      }),
      );
      var message = document.querySelector("#save-error");
      if (message) message.classList.add("is-hidden");
      return true;
    } catch (error) {
      var message = document.querySelector("#save-error");
      if (message) message.classList.remove("is-hidden");
      return false;
    }
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
      throw new Error("This file is not a valid financial plan backup. Your current plan is unchanged.");
    }
    if (parsed.version && Number(parsed.version) > STORAGE_VERSION) {
      throw new Error("This backup was made by a newer app version. Your current plan is unchanged.");
    }
    return normalizeState(candidate);
  }

  function backupRestoreCopy(copy, restoredState, exportedAt) {
    var savedDate = exportedAt && !Number.isNaN(Date.parse(exportedAt))
      ? new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(exportedAt))
      : "date unavailable";
    return Object.assign({}, copy, { message: restoredState.recurringRules.length + " payment rules; balance " +
      formatCurrency(restoredState.startingBalance) + " as of " + formatProjectionHealthDate(restoredState.lastRefreshDate) +
      ". Backup saved: " + savedDate + ". This replaces your current plan. You can download it first." });
  }

  function backupPayload(exportedAt) {
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

  function parseNumericValue(value, fallback) {
    var cleaned = String(value == null ? "" : value)
      .replace(/[$,\s]/g, "")
      .replace(/[^\d.-]/g, "");
    var parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function clampCashBalance(value) {
    return Math.max(-MAX_CASH_BALANCE, Math.min(MAX_CASH_BALANCE, Number(value || 0)));
  }

  function formatNumberForInput(value, minimumFractionDigits) {
    var parsed = Number(value || 0);
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: minimumFractionDigits || 0,
      maximumFractionDigits: 2,
    }).format(parsed);
  }

  function lastDayOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }

  function instanceKey(ruleId, dateKey) {
    return ruleId + "::" + dateKey;
  }

  function loadState() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      var parsed;
      var migratedState;
      var i;

      if (!raw) {
        for (i = 0; i < LEGACY_STORAGE_KEYS.length; i += 1) {
          raw = window.localStorage.getItem(LEGACY_STORAGE_KEYS[i]);
          if (raw) {
            parsed = JSON.parse(raw);
            migratedState = normalizeState(parsed.data || parsed);
            saveState(migratedState);
            return migratedState;
          }
        }
        return cloneDefaultState();
      }

      parsed = JSON.parse(raw);
      if (parsed && parsed.version && parsed.data) {
        return normalizeState(parsed.data);
      }
      return normalizeState(parsed);
    } catch (error) {
      return cloneDefaultState();
    }
  }

  function getStoredThemePreference() {
    var stored;

    try {
      stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    } catch (error) {
      stored = null;
    }

    return stored === "dark" || stored === "light" || stored === "system" ? stored : "system";
  }

  function persistThemePreference(preference) {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch (error) {
      return;
    }
  }

  function resolveThemePreference(preference) {
    if (preference === "dark" || preference === "light") {
      return preference;
    }

    return systemThemeQuery && systemThemeQuery.matches ? "light" : "dark";
  }

  function syncThemeControls(preference) {
    themeChoiceButtons.forEach(function (button) {
      button.setAttribute(
        "aria-pressed",
        button.getAttribute("data-theme-choice") === preference ? "true" : "false",
      );
    });
  }

  function syncThemeAssets(resolvedTheme) {
    var assets = THEME_ASSETS[resolvedTheme] || THEME_ASSETS.dark;

    if (brandLogo) {
      brandLogo.setAttribute("src", assets.logo);
    }

    if (appFavicon) {
      appFavicon.setAttribute("href", assets.favicon);
    }
  }

  function applyThemePreference(preference, options) {
    var resolvedTheme = resolveThemePreference(preference);
    var shouldPersist = !options || options.persist !== false;
    var shouldRender = options && options.render === true;

    themePreference = preference;
    document.documentElement.setAttribute("data-theme", resolvedTheme);
    document.documentElement.setAttribute("data-theme-preference", preference);
    syncThemeControls(preference);
    syncThemeAssets(resolvedTheme);
    var themeLabel = document.querySelector("#resolved-theme-label");
    if (themeLabel) themeLabel.textContent = (preference === "system" ? "Device · " : "") + resolvedTheme;

    if (shouldPersist) {
      persistThemePreference(preference);
    }

    if (shouldRender) {
      renderProjection();
    }
  }

  function parseCssColor(value, fallback) {
    var raw = String(value || "").trim();
    var hexMatch = raw.match(/^#([0-9a-f]{6})$/i);
    var match;

    if (hexMatch) {
      return {
        r: parseInt(hexMatch[1].slice(0, 2), 16),
        g: parseInt(hexMatch[1].slice(2, 4), 16),
        b: parseInt(hexMatch[1].slice(4, 6), 16),
      };
    }

    match = raw.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);

    if (!match) {
      return fallback;
    }

    return {
      r: Number(match[1]),
      g: Number(match[2]),
      b: Number(match[3]),
    };
  }

  function readSemanticColors() {
    var styles = window.getComputedStyle(document.documentElement);

    return {
      positive: parseCssColor(styles.getPropertyValue("--positive"), FALLBACK_SEMANTIC_COLORS.positive),
      warning: parseCssColor(styles.getPropertyValue("--warning"), FALLBACK_SEMANTIC_COLORS.warning),
      danger: parseCssColor(styles.getPropertyValue("--danger"), FALLBACK_SEMANTIC_COLORS.danger),
    };
  }

  function isRuleBaseDueOnDate(rule, date, includeExcluded) {
    if ((!rule.active && !includeExcluded) || ruleScheduleIssue(rule)) {
      return false;
    }

    if (rule.scheduleType === "weekly") {
      return date.getDay() === Number(rule.dayOfWeek);
    }

    if (rule.scheduleType === "monthly") {
      return date.getDate() === Math.min(Number(rule.dayOfMonth), lastDayOfMonth(date));
    }

    if (rule.scheduleType === "biweekly") {
      var anchorDate = parseInputDate(rule.scheduleDate);
      var diffInDays = calendarDayNumber(date) - calendarDayNumber(anchorDate);
      return diffInDays >= 0 && diffInDays % 14 === 0;
    }

    if (rule.scheduleType === "adhoc") {
      var exactDate = parseInputDate(rule.scheduleDate);
      return startOfDay(date).getTime() === startOfDay(exactDate).getTime();
    }

    return false;
  }

  function occurrenceNumberThroughDate(rule, date, projectionStartDate) {
    var countFrom = rule.startDate || (rule.scheduleType === "biweekly" ? rule.scheduleDate : "");
    var cursor = countFrom ? parseInputDate(countFrom) : startOfDay(projectionStartDate);
    var target = startOfDay(date);
    var count = 0;

    while (cursor.getTime() <= target.getTime()) {
      if (isRuleBaseDueOnDate(rule, cursor, true)) {
        count += 1;
      }
      cursor = addDays(cursor, 1);
    }

    return count;
  }

  function isRuleWithinLimit(rule, date, projectionStartDate) {
    if (rule.scheduleType === "adhoc" || !rule.limitType || rule.limitType === "none") {
      return true;
    }

    if (rule.limitType === "date") {
      return startOfDay(date).getTime() <= startOfDay(parseInputDate(rule.endDate)).getTime();
    }

    if (rule.limitType === "count") {
      return (
        occurrenceNumberThroughDate(rule, date, projectionStartDate) <=
        Math.max(1, Number(rule.instanceLimit || 1))
      );
    }

    return true;
  }

  function isRuleDueOnDate(rule, date, projectionStartDate, includeExcluded) {
    if (rule.scheduleType !== "adhoc" && rule.startDate &&
        dateInputValue(date) < rule.startDate) {
      return false;
    }
    return isRuleBaseDueOnDate(rule, date, includeExcluded) && isRuleWithinLimit(rule, date, projectionStartDate);
  }

  function ruleScheduleIssue(rule) {
    if ((rule.scheduleType === "biweekly" || rule.scheduleType === "adhoc") && !isValidInputDate(rule.scheduleDate)) return "Choose a payment date";
    if (rule.scheduleType !== "adhoc" && rule.limitType === "date" && !isValidInputDate(rule.endDate)) return "Choose an end date";
    if (rule.scheduleType !== "adhoc" && rule.limitType === "count" && !rule.startDate && rule.scheduleType !== "biweekly") return "Choose when to count payments from";
    if (rule.scheduleType !== "adhoc" && rule.limitType === "date" && rule.startDate && rule.endDate < rule.startDate) return "Check the date limits";
    return "";
  }

  // Reordering presentation must not change same-day transaction calculation order.
  function moveRuleWithinDirection(rules, id, beforeId) {
    var source = rules.find(function (rule) { return rule.id === id; });
    var target = rules.find(function (rule) { return rule.id === beforeId; });
    if (!source || (target && target.direction !== source.direction) || id === beforeId) return false;
    if (beforeId && !target) return false;
    var peers = rules.filter(function (rule) { return rule.direction === source.direction && rule.id !== id; });
    var index = target ? peers.indexOf(target) : peers.length;
    peers.splice(index, 0, source);
    var cursor = 0;
    rules.forEach(function (rule, position) {
      if (rule.direction === source.direction) rules[position] = peers[cursor++];
    });
    return true;
  }

  function generateProjection(state, includeExcluded) {
    var startDate = startOfDay(parseInputDate(state.startDate));
    var totalDays = Number(state.projectionDays || 30);
    var runningBalance = Number(state.startingBalance || 0);
    var projection = [];
    var index;

    for (index = 0; index < totalDays; index += 1) {
      var date = addDays(startDate, index);
      var items = state.recurringRules
        .filter(function (rule) {
          return isRuleDueOnDate(rule, date, startDate, includeExcluded);
        })
        .sort(function (left, right) { return (left.calculationOrder || 0) - (right.calculationOrder || 0); })
        .map(function (rule) {
          var dateKey = dateInputValue(date);
          return {
            id: rule.id + ":" + date.toISOString(),
            ruleId: rule.id,
            wholeExcluded: !rule.active,
            dateKey: dateKey,
            name: rule.name,
            direction: rule.direction,
            amount: Number(rule.amount || 0),
          };
        });

      projection.push({
        date: date,
        dateLabel: formatDate(date),
        items: items,
        balance: runningBalance,
      });

      items.forEach(function (item) {
        if (item.wholeExcluded) return;
        if (item.direction === "credit") {
          runningBalance += item.amount;
        } else if (item.direction === "debit") {
          runningBalance -= item.amount;
        }
      });
    }

    return projection;
  }

  function interpolateColor(startColor, endColor, ratio) {
    var safeRatio = Math.max(0, Math.min(1, ratio));
    return {
      r: Math.round(startColor.r + (endColor.r - startColor.r) * safeRatio),
      g: Math.round(startColor.g + (endColor.g - startColor.g) * safeRatio),
      b: Math.round(startColor.b + (endColor.b - startColor.b) * safeRatio),
    };
  }

  function colorToCss(color, alpha) {
    return "rgba(" + color.r + ", " + color.g + ", " + color.b + ", " + alpha + ")";
  }

  function balancePillStyle(balance, thresholds) {
    var semanticColors = readSemanticColors();
    var red = semanticColors.danger;
    var yellow = semanticColors.warning;
    var green = semanticColors.positive;
    var fill;

    if (balance <= thresholds.red) {
      fill = red;
    } else if (balance >= thresholds.green) {
      fill = green;
    } else if (balance <= thresholds.yellow) {
      fill = interpolateColor(
        red,
        yellow,
        (balance - thresholds.red) / Math.max(thresholds.yellow - thresholds.red, 1),
      );
    } else {
      fill = interpolateColor(
        yellow,
        green,
        (balance - thresholds.yellow) / Math.max(thresholds.green - thresholds.yellow, 1),
      );
    }

    return (
      "background:linear-gradient(90deg," +
      colorToCss(fill, 0.24) +
      "," +
      colorToCss(fill, 0.1) +
      ");color:var(--text);border:1px solid " +
      colorToCss(fill, 0.42) +
      ";box-shadow: inset 0 0 0 1px " +
      colorToCss(fill, 0.1) +
      ", 0 0 16px " +
      colorToCss(fill, 0.12) +
      ";"
    );
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  var state = loadState();

  var startingBalanceInput = document.querySelector("#starting-balance");
  var projectionDaysInput = document.querySelector("#projection-days");
  var startingBalanceForm = document.querySelector("#starting-balance-form");
  var thresholdForm = document.querySelector("#threshold-form");
  var thresholdRedInput = document.querySelector("#threshold-red");
  var thresholdYellowInput = document.querySelector("#threshold-yellow");
  var thresholdGreenInput = document.querySelector("#threshold-green");
  var thresholdError = document.querySelector("#threshold-error");
  var exportDataButton = document.querySelector("#export-data");
  var importDataButton = document.querySelector("#import-data");
  var resetDataButton = document.querySelector("#reset-data");
  var dataMenu = document.querySelector(".data-menu");
  var dataActionStatus = document.querySelector("#data-action-status");
  var dataDialog = document.querySelector("#data-dialog");
  var dataDialogTitle = document.querySelector("#data-dialog-title");
  var dataDialogMessage = document.querySelector("#data-dialog-message");
  var dataDialogCancel = document.querySelector("#data-dialog-cancel");
  var dataDialogConfirm = document.querySelector("#data-dialog-confirm");
  var saveDriveButton = document.querySelector("#save-drive");
  var restoreDriveButton = document.querySelector("#restore-drive");
  var driveBackupStatus = document.querySelector("#drive-backup-status");
  var sampleScenarioButtons = document.querySelectorAll("[data-sample-scenario]");
  var importFileInput = document.querySelector("#import-file");
  var rulesPanelContent = document.querySelector("#rules-panel-content");
  var toggleRulesButton = document.querySelector("#toggle-rules");
  var emptyState = document.querySelector("#empty-state");
  var rulesStatus = document.querySelector("#rules-status");
  var rulesList = document.querySelector("#rules-list");
  var projectionSummary = document.querySelector("#projection-summary");
  var projectionChart = document.querySelector("#projection-chart");
  var chartEmptyState = document.querySelector("#chart-empty-state");
  var chartPanel = document.querySelector(".chart-panel-primary");
  var projectionAnswerElement = document.querySelector("#projection-answer");
  var cushionLinesToggle = document.querySelector("#toggle-cushion-lines");
  var averageBalanceToggle = document.querySelector("#toggle-average-balance");
  var extremaPointsToggle = document.querySelector("#toggle-extrema-points");
  var projectionTableBody = document.querySelector("#projection-table-body");
  var addMoneyInRuleButton = document.querySelector("#add-money-in-rule");
  var addMoneyOutRuleButton = document.querySelector("#add-money-out-rule");
  var themeChoiceButtons = document.querySelectorAll("[data-theme-choice]");
  var brandLogo = document.querySelector("[data-theme-logo]");
  var appFavicon = document.querySelector("#app-favicon");
  var systemThemeQuery = window.matchMedia
    ? window.matchMedia("(prefers-color-scheme: light)")
    : null;
  var themePreference = getStoredThemePreference();
  var expandedRuleId = null;
  var undoRemoval = null;
  var ledgerLimit = 20;
  var inspectChartDay = function () {};
  var chartInspectionIndex = null;
  var answerRefreshRequested = false;
  var mobileQuery = window.matchMedia("(max-width: 860px)");
  var themeSwitcher = document.querySelector(".theme-switcher");
  var utilityHome = themeSwitcher.parentNode;
  var chartOptions = document.querySelector(".chart-options");
  var pendingFocusRuleId = null;
  var pendingFocusField = null;
  var pendingScrollRuleId = null;
  var statusTimeoutId = null;
  var ruleInputTimeoutId = null;
  var resizeTimeoutId = null;
  var dataStatusTimeoutId = null;
  var googleTokenClient = null;
  var googleAccessToken = null;
  var latestProjectionRows = [];
  var projectionAnswer = projectionAnswerElement && window.ProjectionAnswer
    ? window.ProjectionAnswer.create(projectionAnswerElement)
    : null;

  applyThemePreference(themePreference, { persist: false, render: false });

  function syncStartingFields() {
    startingBalanceInput.value = formatNumberForInput(state.startingBalance, 2);
    projectionDaysInput.value = String(state.projectionDays || 30);
    thresholdRedInput.value = formatNumberForInput(state.thresholds.red);
    thresholdYellowInput.value = formatNumberForInput(state.thresholds.yellow);
    thresholdGreenInput.value = formatNumberForInput(state.thresholds.green);
    cushionLinesToggle.checked = state.showCushionLines !== false;
    averageBalanceToggle.checked = state.showAverageBalance !== false;
    extremaPointsToggle.checked = state.showExtremaPoints !== false;
    rulesPanelContent.classList.toggle("is-hidden", state.rulesCollapsed);
    toggleRulesButton.textContent = state.rulesCollapsed
      ? UI_COPY.buttons.showItems
      : UI_COPY.buttons.hideItems;
    toggleRulesButton.setAttribute("aria-expanded", String(!state.rulesCollapsed));
    toggleRulesButton.setAttribute("aria-controls", "rules-panel-content");
  }

  function dayOption(value, label, selectedValue) {
    return (
      '<option value="' +
      value +
      '"' +
      (Number(selectedValue) === value ? " selected" : "") +
      ">" +
      label +
      "</option>"
    );
  }

  function scheduleControl(rule) {
    if (rule.scheduleType === "weekly") {
      return (
        '<select data-field="dayOfWeek">' +
        dayOption(0, "Sunday", rule.dayOfWeek) +
        dayOption(1, "Monday", rule.dayOfWeek) +
        dayOption(2, "Tuesday", rule.dayOfWeek) +
        dayOption(3, "Wednesday", rule.dayOfWeek) +
        dayOption(4, "Thursday", rule.dayOfWeek) +
        dayOption(5, "Friday", rule.dayOfWeek) +
        dayOption(6, "Saturday", rule.dayOfWeek) +
        "</select>"
      );
    }

    if (rule.scheduleType === "biweekly") {
      return (
        '<input data-field="scheduleDate" type="date" value="' +
        escapeHtml(rule.scheduleDate || "") +
        '" />'
      );
    }

    if (rule.scheduleType === "adhoc") {
      return (
        '<input data-field="scheduleDate" type="date" min="' +
        todayInputValue() +
        '" value="' +
        escapeHtml(rule.scheduleDate || "") +
        '" />'
      );
    }

    return (
      '<input data-field="dayOfMonth" type="number" min="1" max="31" value="' +
      Number(rule.dayOfMonth || 1) +
      '" />'
    );
  }

  function limitControl(rule) {
    if (rule.scheduleType === "adhoc") {
      return '<div class="rule-limit-static">Runs once</div>';
    }

    return (
      '<div class="limit-control">' +
      '<select data-field="limitType" aria-label="When this item ends">' +
      '<option value="none"' +
      (rule.limitType === "none" || !rule.limitType ? " selected" : "") +
      ">No end</option>" +
      '<option value="count"' +
      (rule.limitType === "count" ? " selected" : "") +
      ">After N payments</option>" +
      '<option value="date"' +
      (rule.limitType === "date" ? " selected" : "") +
      ">On date</option>" +
      "</select>" +
      (rule.limitType === "count"
        ? '<input data-field="instanceLimit" type="number" min="1" max="260" aria-label="Number of times" value="' +
          Math.max(1, Number(rule.instanceLimit || 1)) +
          '" />'
        : "") +
      (rule.limitType === "date"
        ? '<input data-field="endDate" type="date" aria-label="Last payment date" value="' +
          escapeHtml(rule.endDate || "") +
          '" />'
        : "") +
      "</div>"
    );
  }

  function ruleScheduleSummary(rule) {
    var schedule = rule.scheduleType === "weekly" ? "Weekly · " + ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][rule.dayOfWeek]
      : rule.scheduleType === "biweekly" ? "Every 2 weeks"
      : rule.scheduleType === "adhoc" ? "One-time · " + formatShortDate(parseInputDate(rule.scheduleDate))
      : "Monthly · day " + rule.dayOfMonth;
    if (rule.scheduleType !== "adhoc") {
      if (rule.startDate) schedule += " · from " + formatShortDate(parseInputDate(rule.startDate));
      if (rule.limitType === "date" && rule.endDate) schedule += " · until " + formatShortDate(parseInputDate(rule.endDate));
      if (rule.limitType === "count") schedule += " · " + rule.instanceLimit + " payments";
    }
    if (rule.scheduleType === "biweekly" && rule.scheduleDate) schedule = schedule.replace("Every 2 weeks", "Every 2 weeks · " + formatDate(parseInputDate(rule.scheduleDate)));
    return schedule + (ruleScheduleIssue(rule) ? " · Needs a date" : "") + (rule.active ? "" : " · Excluded");
  }

  function ruleCard(rule) {
    return (
      '<article class="rule-card' + (!rule.active ? ' is-excluded' : '') + (expandedRuleId === rule.id ? ' is-mobile-expanded' : '') + '" data-rule-id="' +
      escapeHtml(rule.id) +
      '" data-direction="' +
      rule.direction +
      '">' +
      '<button type="button" class="rule-mobile-summary" data-action="edit-rule" aria-expanded="' +
      (expandedRuleId === rule.id) + '" aria-label="Edit ' + escapeHtml(rule.name) + '">' +
      '<span><strong>' + escapeHtml(rule.name) + '</strong><small>' + escapeHtml(ruleScheduleSummary(rule)) + '</small></span>' +
      '<span class="mobile-rule-amount">' + (rule.direction === "credit" ? "+" : "−") + formatCurrency(rule.amount) +
      '<small>' + (expandedRuleId === rule.id ? "Editing" : "Edit") + '</small></span></button>' +
      '<div class="rule-card-main">' +
      '<label class="field rule-name-field"><span>Name</span><input data-field="name" type="text" value="' +
      escapeHtml(rule.name) +
      '" /></label>' +
      '<label class="field rule-amount-field"><span>Amount</span><input data-field="amount" type="text" inputmode="decimal" maxlength="12" value="' +
      formatNumberForInput(rule.amount) +
      '" /></label>' +
      '<div class="rule-actions"><label class="plan-toggle"><input data-field="active" type="checkbox" aria-label="Include ' + escapeHtml(rule.name) + ' in forecast"' +
      (rule.active ? " checked" : "") +
      " /><span>" + (rule.active ? "Included" : "Excluded") + "</span></label>" +
      '<button type="button" class="button ghost" data-action="delete-rule">Remove</button></div>' +
      "</div>" +
      '<div class="rule-card-details">' +
      '<label class="field rule-schedule-field"><span>Schedule</span><select data-field="scheduleType">' +
      '<option value="weekly"' +
      (rule.scheduleType === "weekly" ? " selected" : "") +
      ">Weekly</option>" +
      '<option value="monthly"' +
      (rule.scheduleType === "monthly" ? " selected" : "") +
      ">Monthly</option>" +
      '<option value="biweekly"' +
      (rule.scheduleType === "biweekly" ? " selected" : "") +
      ">Every 2 weeks</option>" +
      '<option value="adhoc"' +
      (rule.scheduleType === "adhoc" ? " selected" : "") +
      ">One-time</option>" +
      "</select></label>" +
      '<label class="field rule-date-field"><span>' +
      (rule.scheduleType === "weekly"
        ? "Day of week"
        : rule.scheduleType === "biweekly"
          ? (rule.direction === "credit" ? "First payday" : "First payment date")
          : rule.scheduleType === "adhoc"
            ? "Exact date"
            : "Day of month") +
      "</span>" +
      scheduleControl(rule) +
      "</label>" +
      (rule.scheduleType !== "adhoc" && (rule.scheduleType !== "biweekly" || (rule.startDate && rule.startDate !== rule.scheduleDate))
        ? '<label class="field rule-start-field"><span>' + (rule.limitType === "count" && rule.scheduleType !== "biweekly" ? "Count from" : "Include from (optional)") + '</span><input data-field="startDate" type="date" aria-label="Include payments from" value="' +
          escapeHtml(rule.startDate || "") + '" /></label>'
        : "") +
      '<div class="field rule-limit"><span>Ends</span>' +
      limitControl(rule) +
      "</div>" +
      (rule.scheduleType !== "adhoc"
        ? '<p class="rule-date-note">Use payment dates, not work dates. ' +
          (rule.scheduleType === "biweekly" ? 'Every 14 days from the first payment date, on the same weekday. ' : rule.scheduleType === "weekly" ? 'Paid on the selected weekday. ' : 'Paid on the selected day each month; shorter months use their last day. ') +
          (rule.limitType === "count" ? 'Count scheduled payments from ' + (rule.startDate || rule.scheduleType !== 'biweekly' ? 'the Count from date' : 'the first payment date') + ', including skipped payments.' : 'Optional date limits include the selected dates. Blank means no additional limit.') + '</p>'
        : "") +
      '<p class="schedule-preview">' + escapeHtml(schedulePreview(rule)) + '</p>' +
      ruleOrderControls(rule) +
      '<p class="form-error rule-error is-hidden" id="rule-error-' + escapeHtml(rule.id) + '" aria-live="polite"></p>' +
      '<div class="mobile-editor-footer"><span>Valid changes save automatically in this browser.</span><button type="button" class="button secondary" data-action="done-editing">Done</button></div>' +
      "</div></article>"
    );
  }

  function schedulePreview(rule) {
    var issue = ruleScheduleIssue(rule);
    if (issue) return issue + ". This item is not included until its schedule is complete.";
    var next = [];
    var start = parseInputDate(todayInputValue());
    for (var i = 0; i < 1100 && next.length < 3; i += 1) {
      var date = addDays(start, i);
      if (isRuleDueOnDate(rule, date, start, true)) next.push(formatDate(date));
    }
    return (rule.active ? "Next payments: " : "Excluded from the forecast. Scheduled: ") + (next.length ? next.join(" · ") : "none in the next three years") + ".";
  }

  function ruleOrderControls(rule) {
    var peers = state.recurringRules.filter(function (item) { return item.direction === rule.direction; });
    var index = peers.indexOf(rule);
    return '<div class="rule-order-controls" aria-label="Reorder ' + escapeHtml(rule.name) + '">' +
      '<button type="button" class="button ghost rule-drag-handle" data-action="drag-rule" aria-label="Drag to move ' + escapeHtml(rule.name) + ' within ' + (rule.direction === "credit" ? "Money in" : "Money out") + '">Hold to move</button>' +
      '<button type="button" class="button ghost" data-action="move-up"' + (index === 0 ? ' disabled' : '') + '>Move up</button>' +
      '<button type="button" class="button ghost" data-action="move-down"' + (index === peers.length - 1 ? ' disabled' : '') + '>Move down</button></div>';
  }

  function renderRuleGroup(groupKey, title, rules, openByDefault) {
    return (
      '<details class="rule-group" data-group="' +
      groupKey +
      '"' +
      (openByDefault ? " open" : "") +
      ">" +
      "<summary>" +
      "<span>" +
      title +
      "</span>" +
      '<span class="group-pill">' +
      rules.length +
      (rules.length === 1 ? " item" : " items") +
      "</span>" +
      "</summary>" +
      '<div class="rule-group-body">' +
      (rules.length
        ? rules.map(ruleCard).join("")
        : '<p class="rule-group-empty">No ' + title.toLowerCase() + " yet.</p>") +
      "</div>" +
      "</details>"
    );
  }

  function renderRules() {
    var moneyInRules = state.recurringRules.filter(function (rule) {
      return rule.direction === "credit";
    });
    var moneyOutRules = state.recurringRules.filter(function (rule) {
      return rule.direction !== "credit";
    });

    emptyState.classList.toggle("is-hidden", state.recurringRules.length > 0);
    rulesList.innerHTML = state.recurringRules.length
      ? renderRuleGroup(
          "money-in",
          UI_COPY.labels.upcomingMoneyIn,
          moneyInRules,
          state.ruleGroups.moneyInOpen,
        ) +
        renderRuleGroup(
          "money-out",
          UI_COPY.labels.upcomingMoneyOut,
          moneyOutRules,
          state.ruleGroups.moneyOutOpen,
        )
      : "";
  }

  function flattenProjectionRows() {
    var projection = generateProjection(state, true);
    var windowEndDate = addDays(
      parseInputDate(state.startDate),
      Number(state.projectionDays || 30) - 1,
    );
    var rows = [
      {
        type: "current",
        dateLabel: formatDate(parseInputDate(state.startDate)),
        name: UI_COPY.labels.startingBalance,
        credit: null,
        debit: null,
        balance: state.startingBalance,
      },
    ];
    var runningBalance = Number(state.startingBalance || 0);

    projection.forEach(function (day) {
      day.items.forEach(function (item) {
        var dateKey = item.dateKey || dateInputValue(day.date);
        var skipped = item.wholeExcluded || Boolean(state.skippedInstances[instanceKey(item.ruleId, dateKey)]);
        var previousBalance = runningBalance;

        if (!skipped && item.direction === "credit") {
          runningBalance += item.amount;
        } else if (!skipped && item.direction === "debit") {
          runningBalance -= item.amount;
        }

        rows.push({
          type: "item",
          dateLabel: day.dateLabel,
          dateKey: dateKey,
          ruleId: item.ruleId,
          skipped: skipped,
          wholeExcluded: item.wholeExcluded,
          name: item.name,
          credit: item.direction === "credit" ? item.amount : null,
          debit: item.direction === "debit" ? item.amount : null,
          previousBalance: previousBalance,
          balance: runningBalance,
        });
      });
    });

    appendOutsideWindowRows(rows, windowEndDate, runningBalance);

    return rows;
  }

  function appendOutsideWindowRows(rows, windowEndDate, runningBalance) {
    var outsideItems = state.recurringRules
      .filter(function (rule) {
        return (
          !ruleScheduleIssue(rule) &&
          rule.scheduleType === "adhoc" &&
          parseInputDate(rule.scheduleDate).getTime() > startOfDay(windowEndDate).getTime()
        );
      })
      .sort(function (left, right) {
        return (
          parseInputDate(left.scheduleDate).getTime() -
          parseInputDate(right.scheduleDate).getTime()
        );
      });
    outsideItems.forEach(function (rule) {
      var scheduledDate = parseInputDate(rule.scheduleDate);
      var amount = Number(rule.amount || 0);
      var previousBalance = runningBalance;
      var skipped = !rule.active || Boolean(state.skippedInstances[instanceKey(rule.id, rule.scheduleDate)]);

      if (!skipped && rule.direction === "credit") {
        runningBalance += amount;
      } else if (!skipped) {
        runningBalance -= amount;
      }

      rows.push({
        type: "item",
        dateLabel: formatDate(scheduledDate),
        dateKey: rule.scheduleDate,
        ruleId: rule.id,
        skipped: skipped,
        wholeExcluded: !rule.active,
        name: rule.name,
        credit: rule.direction === "credit" ? amount : null,
        debit: rule.direction === "debit" ? amount : null,
        previousBalance: previousBalance,
        balance: runningBalance,
        outsideWindow: true,
      });
    });
  }

  function projectionPointsFromRows(rows) {
    var startDate = parseInputDate(state.startDate);
    var days = Number(state.projectionDays || 30);
    var rowsByDate = rows.reduce(function (result, row) {
      if (row.outsideWindow) {
        return result;
      }
      var key = row.dateKey || state.startDate;
      result[key] = row.balance;
      return result;
    }, {});
    var points = [];
    var balance = Number(state.startingBalance || 0);
    var index;

    for (index = 0; index < days; index += 1) {
      var date = addDays(startDate, index);
      var key = dateInputValue(date);
      if (Object.prototype.hasOwnProperty.call(rowsByDate, key)) {
        balance = rowsByDate[key];
      }
      points.push({
        date: key,
        balance: balance,
      });
    }

    return points;
  }

  function evaluateProjectionHealth(rows) {
    return window.ProjectionHealth.evaluateProjectionHealth(projectionPointsFromRows(rows), {
      redLimit: state.thresholds.red,
      yellowLimit: state.thresholds.yellow,
      greenLimit: state.thresholds.green,
    });
  }

  function firstProjectionPointBelow(points, limit, inclusive) {
    var index;

    for (index = 0; index < points.length; index += 1) {
      if (inclusive ? Number(points[index].balance || 0) <= limit : Number(points[index].balance || 0) < limit) {
        return points[index];
      }
    }

    return null;
  }

  function summarizeProjection(rows) {
    return {
      projectionHealth: evaluateProjectionHealth(rows),
    };
  }

  function hasProjectionData() {
    return Number(state.startingBalance || 0) !== 0 || state.recurringRules.length > 0;
  }

  function renderSummary(rows) {
    var refreshAnswer = answerRefreshRequested;
    answerRefreshRequested = false;
    var summary = summarizeProjection(rows);
    var health = summary.projectionHealth;
    var hasData = hasProjectionData();
    var healthPoints = projectionPointsFromRows(rows);
    var brokePoint = firstProjectionPointBelow(healthPoints, 0);
    var redPoint = firstProjectionPointBelow(healthPoints, state.thresholds.red, true);
    var brokeCopy = brokePoint
      ? "Below $0 on " + formatProjectionHealthDate(brokePoint.date) + "."
      : redPoint
        ? "Reaches your red cushion on " + formatProjectionHealthDate(redPoint.date) + "."
        : "";

    if (!hasData) {
      projectionSummary.innerHTML = '<div class="forecast-metrics"><div><span>Lowest balance</span><strong>—</strong></div></div>';

      if (projectionAnswer) {
        projectionAnswer.update({
          status: health.status,
          hasProjectionData: false,
          refresh: refreshAnswer,
        });
      }

      return;
    }

    var lowPoint = healthPoints.reduce(function (low, point) { return point.balance < low.balance ? point : low; }, healthPoints[0]);
    projectionSummary.innerHTML = '<div class="forecast-metrics">' +
      '<div><span>Lowest balance</span><strong>' + formatCurrency(lowPoint.balance) + '</strong><small>' + formatProjectionHealthDate(lowPoint.date) + '</small></div></div>' +
      (brokeCopy ? '<p class="forecast-risk-note">' + brokeCopy + '</p>' : "");

    if (projectionAnswer) {
      projectionAnswer.update({
        status: health.status,
        hasProjectionData: hasData,
        dropsBelowZero: Boolean(brokePoint),
        refresh: refreshAnswer,
        forecastKey: JSON.stringify([state.startDate, state.startingBalance, state.projectionDays,
          state.recurringRules, state.skippedInstances, state.thresholds]),
      });
    }
  }

  function renderProjectionChart(rows) {
    var chartRows = projectionPointsFromRows(rows).map(function (point) {
      return {
        dateKey: point.date,
        balance: point.balance,
      };
    });
    var containerWidth = projectionChart
      ? Math.floor(projectionChart.getBoundingClientRect().width || 1000)
      : 1000;
    var compactChart = containerWidth < 560;
    var width = Math.max(280, Math.min(1000, containerWidth));
    var height = compactChart ? 250 : 300;
    var pad = compactChart
      ? { top: 24, right: 8, bottom: 32, left: 50 }
      : { top: 26, right: 16, bottom: 34, left: 82 };
    var thresholds = state.thresholds || { red: 1000, yellow: 2000, green: 5000 };
    var balances = chartRows.map(function (row) {
      return row.balance;
    });
    var rawMinBalance = Math.min.apply(
      null,
      balances.concat([0, thresholds.red, thresholds.yellow, thresholds.green]),
    );
    var rawMaxBalance = Math.max.apply(
      null,
      balances.concat([0, thresholds.red, thresholds.yellow, thresholds.green]),
    );
    var rawRange = Math.max(rawMaxBalance - rawMinBalance, 1);
    var visibleAnnotationCount =
      (state.showCushionLines === false ? 0 : 3) +
      (state.showAverageBalance === false ? 0 : 1) +
      (state.showExtremaPoints === false || compactChart ? 0 : 2);
    var domainPadding = Math.max(
      rawRange * (visibleAnnotationCount > 3 ? 0.13 : 0.1),
      compactChart ? 180 : 240,
    );
    var minBalance = rawMinBalance - domainPadding;
    var maxBalance = rawMaxBalance + domainPadding;
    var range = Math.max(maxBalance - minBalance, 1);
    var lowRow = chartRows.reduce(function (lowest, row) {
      return row.balance < lowest.balance ? row : lowest;
    }, chartRows[0]);
    var highRow = chartRows.reduce(function (highest, row) {
      return row.balance > highest.balance ? row : highest;
    }, chartRows[0]);
    var averageBalance =
      balances.reduce(function (total, balance) {
        return total + balance;
      }, 0) / Math.max(balances.length, 1);
    var semanticColors = readSemanticColors();
    var red = semanticColors.danger;
    var yellow = semanticColors.warning;
    var green = semanticColors.positive;

    function xFor(index) {
      if (chartRows.length <= 1) {
        return pad.left;
      }
      return pad.left + (index / (chartRows.length - 1)) * (width - pad.left - pad.right);
    }

    function yFor(balance) {
      return pad.top + ((maxBalance - balance) / range) * (height - pad.top - pad.bottom);
    }

    function pointFor(row, index) {
      return xFor(index).toFixed(1) + "," + yFor(row.balance).toFixed(1);
    }

    function chartColorForBalance(balance) {
      var fill;

      if (balance <= thresholds.red) {
        fill = red;
      } else if (balance >= thresholds.green) {
        fill = green;
      } else if (balance <= thresholds.yellow) {
        fill = interpolateColor(
          red,
          yellow,
          (balance - thresholds.red) / Math.max(thresholds.yellow - thresholds.red, 1),
        );
      } else {
        fill = interpolateColor(
          yellow,
          green,
          (balance - thresholds.yellow) / Math.max(thresholds.green - thresholds.yellow, 1),
        );
      }

      return colorToCss(fill, 1);
    }

    function segmentLines() {
      if (chartRows.length === 1) {
        return (
          '<circle cx="' +
          xFor(0).toFixed(1) +
          '" cy="' +
          yFor(chartRows[0].balance).toFixed(1) +
          '" r="5" fill="' +
          chartColorForBalance(chartRows[0].balance) +
          '" />'
        );
      }

      var paths = [];
      var currentColor = "";
      var currentPath = "";

      chartRows.slice(1).forEach(function (row, index) {
        var previous = chartRows[index];
        var color = chartColorForBalance((previous.balance + row.balance) / 2);
        var startPoint = xFor(index).toFixed(1) + " " + yFor(previous.balance).toFixed(1);
        var endPoint = xFor(index + 1).toFixed(1) + " " + yFor(row.balance).toFixed(1);

        if (color !== currentColor) {
          if (currentPath) {
            paths.push({ color: currentColor, path: currentPath });
          }
          currentColor = color;
          currentPath = "M " + startPoint + " L " + endPoint;
          return;
        }

        currentPath += " L " + endPoint;
      });

      if (currentPath) {
        paths.push({ color: currentColor, path: currentPath });
      }

      return paths
        .map(function (entry) {
          return (
            '<path class="chart-balance-segment" d="' +
            entry.path +
            '" stroke="' +
            entry.color +
            '" />'
          );
        })
        .join("");
    }

    function thresholdGuide(value, color) {
      var y = yFor(value);

      return (
        '<line class="chart-threshold-line" x1="' +
        pad.left +
        '" x2="' +
        (width - pad.right) +
        '" y1="' +
        y.toFixed(1) +
        '" y2="' +
        y.toFixed(1) +
        '" stroke="' +
        color +
        '" />'
      );
    }

    function compactCurrency(amount) {
      var compactNotation = compactChart || Math.abs(Number(amount) || 0) >= 1000000;

      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        notation: compactNotation ? "compact" : "standard",
        maximumFractionDigits: compactNotation ? 1 : 0,
      }).format(amount);
    }

    function estimateLabelWidth(label) {
      return Math.max(compactChart ? 48 : 72, String(label).length * 7);
    }

    function clampLabelX(x, label) {
      var estimatedWidth = estimateLabelWidth(label);
      return Math.max(pad.left, Math.min(x, width - pad.right - estimatedWidth));
    }

    function labelBox(label, y) {
      return {
        x1: label.textAnchor === "end" ? label.x - label.width : label.x,
        x2: label.textAnchor === "end" ? label.x : label.x + label.width,
        y1: y - 13,
        y2: y + 4,
      };
    }

    function boxesOverlap(first, second, gap) {
      return !(
        first.x2 + gap < second.x1 ||
        second.x2 + gap < first.x1 ||
        first.y2 + gap < second.y1 ||
        second.y2 + gap < first.y1
      );
    }

    function labelCandidates(anchorY, preference, bounds, spacing) {
      var values = [anchorY];
      var maxSteps = Math.max(6, Math.ceil((bounds.bottom - bounds.top) / spacing));
      var step;

      for (step = 1; step <= maxSteps; step += 1) {
        if (preference === "above") {
          values.push(anchorY - spacing * step, anchorY + spacing * step);
        } else if (preference === "below") {
          values.push(anchorY + spacing * step, anchorY - spacing * step);
        } else {
          values.push(anchorY - spacing * step, anchorY + spacing * step);
        }
      }

      return values.map(function (value) {
        return Math.max(bounds.top, Math.min(bounds.bottom, value));
      });
    }

    function resolveChartLabelPositions(labels, bounds) {
      var spacing = compactChart ? 17 : 20;
      var placed = [];

      labels
        .slice()
        .sort(function (first, second) {
          if (second.priority !== first.priority) {
            return second.priority - first.priority;
          }
          return first.anchorY - second.anchorY;
        })
        .forEach(function (label) {
          var candidates = labelCandidates(label.anchorY, label.preference, bounds, spacing);
          var chosen = null;
          var candidateIndex;
          var box;
          var collides;

          for (candidateIndex = 0; candidateIndex < candidates.length; candidateIndex += 1) {
            box = labelBox(label, candidates[candidateIndex]);
            collides = placed.some(function (placedLabel) {
              return boxesOverlap(box, placedLabel.box, 2);
            });

            if (!collides) {
              chosen = candidates[candidateIndex];
              break;
            }
          }

          if (chosen === null && label.canHide) {
            label.hidden = true;
            return;
          }

          label.y = chosen === null ? Math.max(bounds.top, Math.min(bounds.bottom, label.anchorY)) : chosen;
          label.moved = Math.abs(label.y - label.anchorY) > 6;
          label.box = labelBox(label, label.y);
          placed.push(label);
        });

      return labels;
    }

    function annotationText(label) {
      if (label.hidden) {
        return "";
      }

      return (
        '<text class="' +
        label.className +
        '" x="' +
        label.x.toFixed(1) +
        '" y="' +
        label.y.toFixed(1) +
        '" text-anchor="' +
        label.textAnchor +
        '">' +
        label.text +
        "</text>"
      );
    }

    function annotationLeader(label) {
      var targetY;

      if (label.hidden || !label.moved) {
        return "";
      }

      if (label.kind === "axis") {
        return (
          '<path class="chart-label-leader" d="M ' +
          (pad.left - 6).toFixed(1) +
          " " +
          label.referenceY.toFixed(1) +
          " L " +
          (pad.left - 6).toFixed(1) +
          " " +
          (label.y - 4).toFixed(1) +
          '" />'
        );
      }

      targetY = label.preference === "above" ? label.y - 12 : label.y - 6;

      return (
        '<path class="chart-label-leader" d="M ' +
        label.referenceX.toFixed(1) +
        " " +
        label.referenceY.toFixed(1) +
        " L " +
        label.x.toFixed(1) +
        " " +
        targetY.toFixed(1) +
        '" />'
      );
    }

    function renderAnnotationLabels(labels) {
      var resolved = resolveChartLabelPositions(labels, {
        top: pad.top + 10,
        bottom: height - pad.bottom - 6,
      });

      return (
        resolved.map(annotationLeader).join("") +
        resolved
          .sort(function (first, second) {
            return first.y - second.y;
          })
          .map(annotationText)
          .join("")
      );
    }

    function axisLabel(value, label, className, priority) {
      var y = yFor(value);

      return {
        kind: "axis",
        text: label,
        className: className,
        x: pad.left - 12,
        width: estimateLabelWidth(label),
        textAnchor: "end",
        referenceY: y,
        anchorY: Math.max(pad.top + 10, Math.min(height - pad.bottom - 6, y + 4)),
        preference: "nearest",
        priority: priority,
        canHide: priority < 3,
      };
    }

    function pointLabel(row, index, position, className, priority) {
      var label = compactCurrency(row.balance);
      var x = clampLabelX(xFor(index), label);
      var y = position === "above" ? yFor(row.balance) - 16 : yFor(row.balance) + 24;

      y = Math.max(pad.top + 8, Math.min(height - pad.bottom - 6, y));

      return {
        kind: "point",
        text: label,
        className: className,
        x: x,
        width: estimateLabelWidth(label),
        textAnchor: "start",
        referenceX: xFor(index),
        referenceY: yFor(row.balance),
        anchorY: y,
        preference: position === "above" ? "above" : "below",
        priority: priority,
        canHide: false,
      };
    }

    function dateMarkers() {
      var totalDays = Number(state.projectionDays || 30);
      var rawIndexes;
      var seen = {};

      if (compactChart) {
        rawIndexes = [0, Math.floor((chartRows.length - 1) / 2), chartRows.length - 1];
      } else if (totalDays <= 30) {
        rawIndexes = [0, 7, 14, 21, chartRows.length - 1];
      } else if (totalDays <= 60) {
        rawIndexes = [0, 15, 30, 45, chartRows.length - 1];
      } else if (totalDays <= 90) {
        rawIndexes = [0, 30, 60, chartRows.length - 1];
      } else if (totalDays <= 120) {
        rawIndexes = [0, 30, 60, 90, chartRows.length - 1];
      } else if (totalDays <= 180) {
        rawIndexes = [0, 45, 90, 135, chartRows.length - 1];
      } else {
        rawIndexes = [0, 90, 180, 270, chartRows.length - 1];
      }

      return rawIndexes
        .filter(function (index) {
          if (seen[index]) {
            return false;
          }
          seen[index] = true;
          return index >= 0 && chartRows[index];
        })
        .map(function (index) {
          var x = xFor(index);
          var anchor = index === 0 ? "start" : index === chartRows.length - 1 ? "end" : "middle";

          return (
            '<line class="chart-date-grid" x1="' +
            x.toFixed(1) +
            '" x2="' +
            x.toFixed(1) +
            '" y1="' +
            pad.top +
            '" y2="' +
            (height - pad.bottom) +
            '" />' +
            '<line class="chart-date-tick" x1="' +
            x.toFixed(1) +
            '" x2="' +
            x.toFixed(1) +
            '" y1="' +
            (height - pad.bottom) +
            '" y2="' +
            (height - pad.bottom + 5) +
            '" />' +
            '<text class="chart-axis-label" x="' +
            x.toFixed(1) +
            '" y="' +
            (height - 8) +
            '" text-anchor="' +
            anchor +
            '">' +
            formatShortDate(parseInputDate(chartRows[index].dateKey || state.startDate)) +
            "</text>"
          );
        })
        .join("");
    }

    function averageLine() {
      var y = yFor(averageBalance);

      if (state.showAverageBalance === false) {
        return "";
      }

      return (
        '<line class="chart-average-line" x1="' +
        pad.left +
        '" x2="' +
        (width - pad.right) +
        '" y1="' +
        y.toFixed(1) +
        '" y2="' +
        y.toFixed(1) +
        '" />'
      );
    }

    if (!projectionChart || !chartRows.length) {
      return;
    }

    var points = chartRows.map(pointFor).join(" ");
    var areaPoints =
      points +
      " " +
      xFor(chartRows.length - 1).toFixed(1) +
      "," +
      (height - pad.bottom).toFixed(1) +
      " " +
      pad.left +
      "," +
      (height - pad.bottom).toFixed(1);
    var zeroY = yFor(0);
    var lowIndex = chartRows.indexOf(lowRow);
    var highIndex = chartRows.indexOf(highRow);
    var axisLabels = [];
    var pointLabels = [];
    var cushionOverlay =
      state.showCushionLines === false
        ? ""
        : thresholdGuide(thresholds.green, "var(--positive)") +
          thresholdGuide(thresholds.yellow, "var(--warning)") +
          thresholdGuide(thresholds.red, "var(--danger)");
    var averageOverlay = state.showAverageBalance === false ? "" : averageLine();
    var extremaOverlay =
      state.showExtremaPoints === false
        ? ""
        : '<circle class="chart-extrema-dot" cx="' +
          xFor(highIndex).toFixed(1) +
          '" cy="' +
          yFor(highRow.balance).toFixed(1) +
          '" r="5" fill="' + (highRow.balance <= thresholds.red ? "var(--danger)" : "var(--positive)") + '" />' +
          '<circle class="chart-extrema-dot" cx="' +
          xFor(lowIndex).toFixed(1) +
          '" cy="' +
          yFor(lowRow.balance).toFixed(1) +
          '" r="5" fill="' + (lowRow.balance <= thresholds.red ? "var(--danger)" : "var(--muted-strong)") + '" />' +
          "";

    if (state.showCushionLines !== false) {
      axisLabels.push(
        axisLabel(thresholds.red, compactCurrency(thresholds.red), "chart-zone-label zone-risk", 5),
        axisLabel(thresholds.green, compactCurrency(thresholds.green), "chart-zone-label zone-good", 3),
        axisLabel(thresholds.yellow, compactCurrency(thresholds.yellow), "chart-zone-label zone-tight", 3),
      );
    }

    if (state.showAverageBalance !== false) {
      axisLabels.push(
        axisLabel(averageBalance, compactCurrency(averageBalance), "chart-average-label", 3),
      );
    }

    if (state.showExtremaPoints !== false && !compactChart) {
      pointLabels.push(
        pointLabel(highRow, highIndex, "above", "chart-point-label " + (highRow.balance <= thresholds.red ? "point-low" : "point-high"), 5),
        pointLabel(lowRow, lowIndex, "below", "chart-point-label " + (lowRow.balance <= thresholds.red ? "point-low" : "point-safe"), 5),
      );
    }

    projectionChart.innerHTML =
      '<svg class="projection-chart" viewBox="0 0 ' +
      width +
      " " +
      height +
      '" role="img" aria-label="Line chart of projected cash balance">' +
      "<defs>" +
      '<linearGradient id="balanceArea" x1="0%" x2="0%" y1="0%" y2="100%">' +
      '<stop offset="0%" stop-color="var(--chart-area-top)" />' +
      '<stop offset="100%" stop-color="var(--chart-area-bottom)" />' +
      "</linearGradient>" +
      "</defs>" +
      '<line class="chart-grid-line" x1="' +
      pad.left +
      '" x2="' +
      (width - pad.right) +
      '" y1="' +
      pad.top +
      '" y2="' +
      pad.top +
      '" />' +
      '<line class="chart-grid-line" x1="' +
      pad.left +
      '" x2="' +
      (width - pad.right) +
      '" y1="' +
      (height - pad.bottom) +
      '" y2="' +
      (height - pad.bottom) +
      '" />' +
      '<line class="chart-zero-line" x1="' +
      pad.left +
      '" x2="' +
      (width - pad.right) +
      '" y1="' +
      zeroY.toFixed(1) +
      '" y2="' +
      zeroY.toFixed(1) +
      '" />' +
      dateMarkers() +
      cushionOverlay +
      '<polygon class="chart-area" points="' +
      areaPoints +
      '" />' +
      averageOverlay +
      segmentLines() +
      extremaOverlay +
      renderAnnotationLabels(axisLabels.concat(pointLabels)) +
      '<g id="chart-inspection-marker" aria-hidden="true"><line x1="0" x2="0" y1="' + pad.top + '" y2="' + (height - pad.bottom) + '" stroke="var(--muted)" stroke-dasharray="3 4" /><circle cx="0" cy="0" r="4" fill="var(--text)" stroke="var(--bg)" stroke-width="2" /></g>' +
      "</svg>";

    inspectChartDay = function (index) {
      chartInspectionIndex = Math.max(0, Math.min(chartRows.length - 1, Number(index)));
      var point = chartRows[chartInspectionIndex];
      document.querySelector("#chart-inspection-value").textContent = formatProjectionHealthDate(point.dateKey) + " · " + formatCurrency(point.balance);
      var items = rows.filter(function (row) { return row.dateKey === point.dateKey && !row.outsideWindow && !row.skipped; });
      document.querySelector("#chart-inspection-note").textContent = items.length ? items.map(function (row) { return row.name; }).join(", ") : "No scheduled payments";
      var marker = projectionChart.querySelector("#chart-inspection-marker");
      marker.querySelector("line").setAttribute("x1", xFor(chartInspectionIndex));
      marker.querySelector("line").setAttribute("x2", xFor(chartInspectionIndex));
      marker.querySelector("circle").setAttribute("cx", xFor(chartInspectionIndex));
      marker.querySelector("circle").setAttribute("cy", yFor(point.balance));
    };
    inspectChartDay(chartInspectionIndex === null ? lowIndex : chartInspectionIndex);
    function inspectPointer(event) {
      projectionChart.parentNode.classList.add("is-inspecting");
      var rect = projectionChart.querySelector("svg").getBoundingClientRect();
      var x = (event.clientX - rect.left) / rect.width * width;
      inspectChartDay(Math.round((x - pad.left) / (width - pad.left - pad.right) * (chartRows.length - 1)));
    }
    projectionChart.onpointerdown = function (event) { if (event.button === 0) inspectPointer(event); };
    projectionChart.onpointermove = function (event) { if (event.pointerType === "mouse") inspectPointer(event); };
    projectionChart.onpointerleave = function (event) {
      if (event.pointerType === "mouse" && document.activeElement !== projectionChart) projectionChart.parentNode.classList.remove("is-inspecting");
    };
    projectionChart.onfocus = function () { projectionChart.parentNode.classList.add("is-inspecting"); };
    projectionChart.onblur = function () { projectionChart.parentNode.classList.remove("is-inspecting"); };
    projectionChart.onkeydown = function (event) {
      var index = chartInspectionIndex;
      if (event.key === "ArrowLeft") index -= 1;
      else if (event.key === "ArrowRight") index += 1;
      else if (event.key === "Home") index = 0;
      else if (event.key === "End") index = chartRows.length - 1;
      else if (event.key === "Escape") { projectionChart.parentNode.classList.remove("is-inspecting"); return; }
      else return;
      event.preventDefault();
      projectionChart.parentNode.classList.add("is-inspecting");
      inspectChartDay(index);
    };
  }

  function renderProjection() {
    state.startDate = todayInputValue();
    var rows = flattenProjectionRows();
    var thresholds = state.thresholds || { red: 1000, yellow: 2000, green: 5000 };
    var hasData = hasProjectionData();
    var firstBelowZeroCrossingIndex = -1;
    var i;

    latestProjectionRows = rows;
    document.querySelector(".chart-inspector").classList.toggle("is-hidden", !hasData);
    var skippedCount = Object.keys(state.skippedInstances).length;
    document.querySelector("#scenario-count").textContent = skippedCount
      ? skippedCount + (skippedCount === 1 ? " payment skipped." : " payments skipped.") + " Whole-item exclusions are controlled in Payments."
      : "Change one payment below, or exclude all occurrences in Payments.";
    document.querySelector("#restore-exclusions").classList.toggle("is-hidden", !skippedCount);
    var moreButton = document.querySelector("#show-more-transactions");
    moreButton.classList.toggle("is-hidden", rows.length <= ledgerLimit);
    moreButton.textContent = "Show " + Math.min(20, Math.max(0, rows.length - ledgerLimit)) + " more transactions";
    document.querySelector("#transaction-count").textContent = Math.min(ledgerLimit, rows.length) + " of " + rows.length + " transactions shown";
    if (chartEmptyState) {
      chartEmptyState.classList.toggle("is-hidden", hasData);
    }
    if (chartPanel) {
      chartPanel.classList.toggle("is-empty", !hasData);
    }
    if (projectionChart) {
      projectionChart.classList.toggle("is-hidden", !hasData);
    }
    if (hasData) {
      renderProjectionChart(rows);
    } else if (projectionChart) {
      projectionChart.innerHTML = "";
    }
    var sampleBanner = document.querySelector("#sample-banner");
    sampleBanner.classList.toggle("is-hidden", !state.sampleScenario);
    document.querySelector("#sample-label").textContent = state.sampleScenario ? "Example projection · fictional data: " + state.sampleScenario : "";
    renderSummary(rows);

    for (i = 0; i < rows.length; i += 1) {
      if (
        rows[i].type === "item" &&
        typeof rows[i].previousBalance === "number" &&
        rows[i].previousBalance >= 0 &&
        rows[i].balance < 0
      ) {
        firstBelowZeroCrossingIndex = i;
        break;
      }
    }

    projectionTableBody.innerHTML = rows
      .map(function (row, index) {
        var previous = rows[index - 1];
        var isCurrent = row.type === "current";
        var isDayStart = isCurrent || !previous || previous.dateKey !== row.dateKey;
        var isBelowZeroCrossing = index === firstBelowZeroCrossingIndex;
        var dateCellContent = row.dateLabel;
        var actionCell = "—";

        if (!isCurrent && !isDayStart) {
          dateCellContent = "";
        }

        if (!isCurrent) {
          actionCell = row.wholeExcluded
            ? '<span class="parent-exclusion">Excluded in Payments</span>'
            : '<button type="button" class="button row-toggle" data-action="toggle-instance" data-rule-id="' +
              escapeHtml(row.ruleId) + '" data-date-key="' + escapeHtml(row.dateKey) +
              '" aria-label="Include ' + escapeHtml(row.name + " on " + row.dateLabel) +
              '" aria-pressed="' + !row.skipped + '" title="' + (row.skipped ? "Include this payment" : "Exclude this payment") + '">' +
              (row.skipped ? "Excluded" : "Included") + '</button>';
        }

        return (
          '<tr class="' +
          (index >= ledgerLimit ? "mobile-overflow-row " : "") +
          (isCurrent ? "current-row " : "") +
          (isBelowZeroCrossing ? "critical-row " : "") +
          (row.skipped ? "skipped-row " : "") +
          (isDayStart ? "day-start " : "day-continuation ") +
          '">' +
          '<td class="date-cell" data-label="Date">' +
          '<span class="desktop-date">' + dateCellContent + '</span><span class="mobile-date">' + row.dateLabel + '</span>' +
          "</td>" +
          '<td data-label="Name"><span class="transaction-name">' +
          escapeHtml(row.name) + '</span><span class="mobile-signed-amount">' +
          (isCurrent ? "" : (row.credit !== null ? "+" + formatCurrency(row.credit) : "−" + formatCurrency(row.debit))) + '</span>' +
          (row.outsideWindow
            ? ' <span class="window-pill">' + UI_COPY.labels.outsideWindow + "</span>"
            : "") +
          (row.skipped ? ' <span class="window-pill">' + UI_COPY.labels.excluded + "</span>" : "") +
          "</td>" +
          '<td data-label="Money in">' +
          (row.credit !== null ? formatCurrency(row.credit) : "—") +
          "</td>" +
          '<td data-label="Money out">' +
          (row.debit !== null ? formatCurrency(row.debit) : "—") +
          "</td>" +
          '<td data-label="Balance"><span class="balance-pill" style="' +
          balancePillStyle(row.balance, thresholds) +
          '">' +
          formatCurrency(row.balance) +
          "</span></td>" +
          '<td data-label="Scenario">' +
          actionCell +
          "</td></tr>"
        );
      })
      .join("");
  }

  function focusPendingRule() {
    var target;

    if (!pendingFocusRuleId || !pendingFocusField) {
      return;
    }

    target = rulesList.querySelector(
      '[data-rule-id="' +
        pendingFocusRuleId +
        '"] [data-field="' +
        pendingFocusField +
        '"]',
    );

    if (target) {
      target.focus({ preventScroll: true });
      if (typeof target.select === "function" && pendingFocusField === "name") {
        target.select();
      }
    }

    pendingFocusRuleId = null;
    pendingFocusField = null;
  }

  function scrollPendingRule(previousScrollY) {
    var targetCard;

    if (pendingScrollRuleId) {
      targetCard = rulesList.querySelector('[data-rule-id="' + pendingScrollRuleId + '"]');
      if (targetCard) {
        targetCard.scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      }
      pendingScrollRuleId = null;
      return;
    }

    window.scrollTo(0, previousScrollY);
  }

  function showStatus(message) {
    if (!message) {
      rulesStatus.textContent = "";
      rulesStatus.classList.add("is-hidden");
      return;
    }

    if (statusTimeoutId) {
      window.clearTimeout(statusTimeoutId);
    }

    rulesStatus.textContent = message;
    rulesStatus.classList.remove("is-hidden");
    statusTimeoutId = window.setTimeout(function () {
      rulesStatus.classList.add("is-hidden");
    }, 2600);
  }

  function showDataStatus(message, persistent) {
    if (dataStatusTimeoutId) {
      window.clearTimeout(dataStatusTimeoutId);
    }

    dataActionStatus.textContent = message;
    dataActionStatus.classList.remove("is-hidden");
    if (!persistent) {
      dataStatusTimeoutId = window.setTimeout(function () {
        dataActionStatus.classList.add("is-hidden");
      }, 4200);
    }
  }

  function closeDataMenu() {
    if (dataMenu) {
      dataMenu.removeAttribute("open");
    }
  }

  function requestDataConfirmation(copy, options) {
    var settings = options || {};
    var returnFocus = settings.returnFocus || document.activeElement;

    closeDataMenu();

    if (!dataDialog || typeof dataDialog.showModal !== "function") {
      return Promise.resolve(window.confirm(copy.message));
    }

    dataDialogTitle.textContent = copy.title;
    dataDialogMessage.textContent = copy.message;
    dataDialogConfirm.textContent = copy.action;
    dataDialogCancel.classList.toggle("is-hidden", settings.alertOnly === true);
    document.querySelector("#data-dialog-backup").classList.toggle("is-hidden", settings.alertOnly === true);
    dataDialogConfirm.classList.toggle("danger-action", settings.danger === true);
    dataDialog.classList.toggle("is-danger", settings.danger === true);
    dataDialog.returnValue = "";

    return new Promise(function (resolve) {
      function handleClose() {
        dataDialog.removeEventListener("close", handleClose);
        if (dataMenu) {
          dataMenu.setAttribute("open", "");
          var focusTarget = returnFocus && dataMenu.contains(returnFocus) && !returnFocus.disabled
            ? returnFocus : dataMenu.querySelector("summary");
          focusTarget.focus();
        }
        resolve(dataDialog.returnValue === "confirm");
      }

      dataDialog.addEventListener("close", handleClose);
      dataDialog.showModal();
    });
  }

  function showDataIssue(message) {
    return requestDataConfirmation(
      {
        title: "That didn't work",
        message: message,
        action: "Got it",
      },
      { alertOnly: true, danger: true },
    );
  }

  function getLocalStorageValue(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function setLocalStorageValue(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      return;
    }
  }

  function removeLocalStorageValue(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      return;
    }
  }

  function syncDriveStatus() {
    var backupAt = getLocalStorageValue(DRIVE_BACKUP_AT_STORAGE_KEY);
    var formatted;

    driveBackupStatus.classList.add("is-hidden");
    if (!backupAt || Number.isNaN(Date.parse(backupAt))) return;

    try {
      formatted = new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(backupAt));
      driveBackupStatus.textContent = "Last backup · " + formatted;
      driveBackupStatus.classList.remove("is-hidden");
    } catch (error) {
      driveBackupStatus.textContent = "";
    }
  }

  function googleDriveClientId() {
    var config = document.querySelector('meta[name="google-drive-client-id"]');
    return config ? config.getAttribute("content").trim() : "";
  }

  function loadGoogleIdentityServices() {
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[data-google-identity-services]');
      var script;

      if (window.google && window.google.accounts && window.google.accounts.oauth2) {
        resolve();
        return;
      }

      if (existing) {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }

      script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.setAttribute("data-google-identity-services", "true");
      script.addEventListener("load", resolve, { once: true });
      script.addEventListener("error", reject, { once: true });
      document.head.appendChild(script);
    });
  }

  function requestDriveAccess(prompt) {
    return new Promise(function (resolve, reject) {
      var clientId = googleDriveClientId();

      if (!clientId) {
        reject(new Error(UI_COPY.errors.driveNotConfigured));
        return;
      }

      loadGoogleIdentityServices()
        .then(function () {
          if (!googleTokenClient) {
            googleTokenClient = window.google.accounts.oauth2.initTokenClient({
              client_id: clientId,
              scope: DRIVE_SCOPE,
              callback: function () {},
              error_callback: function (error) {
                reject(error);
              },
            });
          }

          googleTokenClient.callback = function (response) {
            if (response && response.access_token) {
              googleAccessToken = response.access_token;
              setLocalStorageValue(DRIVE_CONNECTED_STORAGE_KEY, "true");
              syncDriveStatus();
              resolve(response.access_token);
              return;
            }
            reject(new Error("Google Drive access was not granted."));
          };
          googleTokenClient.error_callback = reject;
          googleTokenClient.requestAccessToken({ prompt: prompt || "" });
        })
        .catch(reject);
    });
  }

  function ensureDriveAccess() {
    return googleAccessToken ? Promise.resolve(googleAccessToken) : requestDriveAccess("");
  }

  function driveErrorMessage(status, details) {
    var apiError = details && details.error ? details.error : null;
    var apiMessage = apiError && apiError.message ? apiError.message : "";
    var reason =
      apiError && apiError.errors && apiError.errors[0] ? apiError.errors[0].reason : "";
    var normalizedMessage = apiMessage.toLowerCase();

    if (
      reason === "accessNotConfigured" ||
      normalizedMessage.indexOf("has not been used in project") !== -1 ||
      normalizedMessage.indexOf("it is disabled") !== -1
    ) {
      return "Enable the Google Drive API in the same Google Cloud project as this OAuth client ID, then try again.";
    }

    if (
      status === 403 &&
      (reason === "insufficientPermissions" ||
        normalizedMessage.indexOf("insufficient authentication scopes") !== -1)
    ) {
      return "Google Drive permission was not granted. Try the action again and allow file access.";
    }

    if (status === 401) {
      googleAccessToken = null;
      syncDriveStatus();
      return "Your Google Drive connection needs to be refreshed. Try the action again.";
    }

    if (apiMessage) {
      return "Google Drive request failed: " + apiMessage;
    }

    return "Google Drive request failed (HTTP " + status + ").";
  }

  function driveRequest(url, options, hasRetriedAuthorization) {
    return ensureDriveAccess().then(function (accessToken) {
      var requestOptions = options || {};
      var headers = new Headers(requestOptions.headers || {});
      headers.set("Authorization", "Bearer " + accessToken);
      requestOptions.headers = headers;

      return window.fetch(url, requestOptions).then(function (response) {
        if (response.ok) {
          return response;
        }

        if (response.status === 401 && !hasRetriedAuthorization) {
          googleAccessToken = null;
          syncDriveStatus();
          return driveRequest(url, options, true);
        }

        return response
          .clone()
          .json()
          .catch(function () {
            return null;
          })
          .then(function (details) {
            var apiError = details && details.error;
            if (response.status === 403 && apiError &&
                ((apiError.errors || []).some(function (item) { return item.reason === "insufficientPermissions"; }) ||
                 String(apiError.message || "").toLowerCase().indexOf("insufficient authentication scopes") !== -1)) {
              googleAccessToken = null;
            }
            var error = new Error(driveErrorMessage(response.status, details));
            error.status = response.status;
            error.details = details;
            throw error;
          });
      });
    });
  }

  function createDriveBackup(payload) {
    var boundary = "am-i-going-broke-backup";
    var metadata = JSON.stringify({
      name: DRIVE_BACKUP_FILENAME,
      mimeType: "application/json",
      appProperties: { app: "am-i-going-broke", purpose: "manual-backup" },
    });
    var body =
      "--" +
      boundary +
      "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" +
      metadata +
      "\r\n--" +
      boundary +
      "\r\nContent-Type: application/json\r\n\r\n" +
      payload +
      "\r\n--" +
      boundary +
      "--";

    return driveRequest(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
      {
        method: "POST",
        headers: { "Content-Type": "multipart/related; boundary=" + boundary },
        body: body,
      },
    ).then(function (response) {
      return response.json();
    });
  }

  function updateDriveBackup(fileId, payload) {
    return driveRequest(
      "https://www.googleapis.com/upload/drive/v3/files/" +
        encodeURIComponent(fileId) +
        "?uploadType=media",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: payload,
      },
    );
  }

  function createAndRememberDriveBackup(payload) {
    return createDriveBackup(payload).then(function (file) {
      setLocalStorageValue(DRIVE_FILE_ID_STORAGE_KEY, file.id);
      return file;
    });
  }

  function findDriveBackupFileId() {
    var storedFileId = getLocalStorageValue(DRIVE_FILE_ID_STORAGE_KEY);
    var query;
    var url;

    if (storedFileId) {
      return Promise.resolve(storedFileId);
    }

    query =
      "trashed = false and appProperties has { key='app' and value='am-i-going-broke' } " +
      "and appProperties has { key='purpose' and value='manual-backup' }";
    url =
      "https://www.googleapis.com/drive/v3/files?pageSize=1&orderBy=modifiedTime%20desc" +
      "&fields=files(id)&q=" +
      encodeURIComponent(query);

    return driveRequest(url)
      .then(function (response) {
        return response.json();
      })
      .then(function (result) {
        var fileId = result.files && result.files[0] ? result.files[0].id : null;
        if (fileId) {
          setLocalStorageValue(DRIVE_FILE_ID_STORAGE_KEY, fileId);
        }
        return fileId;
      });
  }

  function saveBackupToDrive() {
    var savedAt;

    return findDriveBackupFileId()
      .then(function (existingFileId) {
        if (existingFileId) {
          return requestDataConfirmation(UI_COPY.confirms.overwriteDrive).then(function (confirmed) {
            return confirmed ? existingFileId : null;
          });
        }

        return "";
      })
      .then(function (existingFileId) {
        if (existingFileId === null) {
          return null;
        }

        if (!existingFileId) {
          return createAndRememberDriveBackup(backupPayload());
        }

        return updateDriveBackup(existingFileId, backupPayload())
          .then(function () {
            return { id: existingFileId };
          })
          .catch(function (error) {
            if (error.status !== 404) {
              throw error;
            }

            removeLocalStorageValue(DRIVE_FILE_ID_STORAGE_KEY);
            removeLocalStorageValue(DRIVE_BACKUP_AT_STORAGE_KEY);
            return createAndRememberDriveBackup(backupPayload());
          });
      })
      .then(function (file) {
        if (!file) {
          return;
        }
        savedAt = new Date().toISOString();
        setLocalStorageValue(DRIVE_FILE_ID_STORAGE_KEY, file.id);
        setLocalStorageValue(DRIVE_BACKUP_AT_STORAGE_KEY, savedAt);
        syncDriveStatus();
        showDataStatus(UI_COPY.status.driveSaved);
      })
      .catch(function (error) {
        showDataIssue(error.message || UI_COPY.status.driveFailed);
        showDataStatus(UI_COPY.status.driveFailed);
      });
  }

  function restoreBackupFromDrive() {
    return findDriveBackupFileId()
      .then(function (fileId) {
        if (!fileId) {
          throw new Error("No Google Drive backup was found for this app.");
        }

        return driveRequest(
          "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(fileId) + "?alt=media",
        );
      })
      .then(function (response) {
        return response.json();
      })
      .then(function (parsed) {
        var restoredState = readBackupState(parsed);
        return requestDataConfirmation(backupRestoreCopy(UI_COPY.confirms.restoreDrive, restoredState, parsed.exportedAt)).then(function (confirmed) {
          if (!confirmed) {
            return;
          }
          state = restoredState;
          persistAndRender();
          showDataStatus(UI_COPY.status.driveRestored);
        });
      })
      .catch(function (error) {
        showDataIssue(error.message || UI_COPY.status.driveFailed);
        showDataStatus(UI_COPY.status.driveFailed);
      });
  }

  function clearRemovalUndo() {
    undoRemoval = null;
    document.querySelector("#undo-removal").classList.add("is-hidden");
  }

  function captureView() {
    var active = document.activeElement;
    var card = active && active.closest(".rule-card");
    return {
      y: window.scrollY,
      top: active ? active.getBoundingClientRect().top : 0,
      ruleId: card ? card.dataset.ruleId : active && active.dataset.ruleId,
      field: active && active.dataset.field,
      action: active && active.dataset.action,
      dateKey: active && active.dataset.dateKey,
      id: active && active.id,
      active: active,
    };
  }

  function restoreView(view) {
    var target = null;
    if (view.ruleId) {
      target = Array.from(document.querySelectorAll("[data-rule-id]")).find(function (element) {
        if (view.dateKey) return element.dataset.ruleId === view.ruleId && element.dataset.dateKey === view.dateKey;
        if (!element.classList.contains("rule-card") || element.dataset.ruleId !== view.ruleId) return false;
        return true;
      });
      if (target && !view.dateKey) target = view.field ? target.querySelector('[data-field="' + view.field + '"]') : target.querySelector('[data-action="' + view.action + '"]');
    } else if (view.id) target = document.getElementById(view.id);
    else if (view.active && view.active.isConnected) target = view.active;
    if (target && target.getClientRects().length) {
      target.focus({ preventScroll: true });
      window.scrollBy(0, target.getBoundingClientRect().top - view.top);
    } else window.scrollTo(0, view.y);
  }

  function persistAndRender(statusMessage) {
    var view = captureView();
    if (undoRemoval && undoRemoval.state !== state) clearRemovalUndo();
    saveState(state);
    syncStartingFields();
    renderRules();
    renderProjection();
    showStatus(statusMessage);
    focusPendingRule();
    if (pendingScrollRuleId) scrollPendingRule(view.y);
    else restoreView(view);
  }

  function createSampleRule(rule) {
    return {
      id: makeId("sample"),
      name: rule.name,
      direction: rule.direction,
      amount: rule.amount,
      variable: Boolean(rule.variable),
      active: true,
      scheduleType: rule.scheduleType,
      dayOfMonth: rule.dayOfMonth || 1,
      dayOfWeek: rule.dayOfWeek || 0,
      scheduleDate: rule.scheduleDate || todayInputValue(),
      startDate: rule.startDate || "",
      limitType: rule.limitType || "none",
      instanceLimit: rule.instanceLimit || 1,
      endDate: rule.endDate || "",
    };
  }

  function createSampleState(config) {
    return normalizeState({
      startDate: todayInputValue(),
      lastRefreshDate: todayInputValue(),
      startingBalance: config.startingBalance,
      projectionDays: config.projectionDays || 90,
      rulesCollapsed: false,
      ruleGroups: {
        moneyInOpen: true,
        moneyOutOpen: true,
      },
      thresholds: config.thresholds || defaultState.thresholds,
      skippedInstances: {},
      showCushionLines: true,
      showAverageBalance: true,
      showExtremaPoints: true,
      recurringRules: config.rules.map(createSampleRule),
    });
  }

  function randomMoney(min, max, step) {
    var range = Math.floor((max - min) / step);
    return min + Math.floor(Math.random() * (range + 1)) * step;
  }

  function buildRandomSampleScenario() {
    var today = parseInputDate(todayInputValue());
    var cushion = randomMoney(800, 1800, 100);
    var paycheck = randomMoney(1350, 2600, 50);
    var rent = randomMoney(1350, 2600, 50);
    var oneTimeHit = randomMoney(450, 1600, 50);
    var labels = ["Plot twist month", "Bills doing the most", "Comeback arc"];
    var label = labels[Math.floor(Math.random() * labels.length)];

    return {
      label: label,
      state: createSampleState({
        startingBalance: randomMoney(900, 5200, 100),
        projectionDays: [60, 90, 120, 180][Math.floor(Math.random() * 4)],
        thresholds: {
          red: cushion,
          yellow: cushion + randomMoney(700, 1300, 100),
          green: cushion + randomMoney(2600, 4200, 100),
        },
        rules: [
          {
            name: "Paycheck",
            direction: "credit",
            amount: paycheck,
            scheduleType: "biweekly",
            scheduleDate: todayInputValue(),
          },
          {
            name: "Rent",
            direction: "debit",
            amount: rent,
            variable: false,
            scheduleType: "monthly",
            dayOfMonth: 1,
          },
          {
            name: "Groceries",
            direction: "debit",
            amount: randomMoney(120, 240, 10),
            variable: true,
            scheduleType: "weekly",
            dayOfWeek: 5,
          },
          {
            name: "Surprise expense",
            direction: "debit",
            amount: oneTimeHit,
            variable: true,
            scheduleType: "adhoc",
            scheduleDate: dateInputValue(addDays(today, randomMoney(4, 24, 1))),
          },
        ],
      }),
    };
  }

  function buildSampleScenario(key) {
    var today = parseInputDate(todayInputValue());
    var scenarios = {
      healthy: {
        label: "Income and bills",
        state: createSampleState({
          startingBalance: 6800,
          projectionDays: 90,
          thresholds: {
            red: 1000,
            yellow: 2500,
            green: 5000,
          },
          rules: [
            {
              name: "Paycheck",
              direction: "credit",
              amount: 3200,
              scheduleType: "monthly",
              dayOfMonth: 15,
            },
            {
              name: "Rent",
              direction: "debit",
              amount: 1850,
              variable: false,
              scheduleType: "monthly",
              dayOfMonth: 1,
            },
            {
              name: "Utilities",
              direction: "debit",
              amount: 260,
              variable: true,
              scheduleType: "monthly",
              dayOfMonth: 8,
            },
            {
              name: "Groceries",
              direction: "debit",
              amount: 165,
              variable: true,
              scheduleType: "weekly",
              dayOfWeek: 6,
            },
          ],
        }),
      },
      tight: {
        label: "Small cushion",
        state: createSampleState({
          startingBalance: 2550,
          projectionDays: 60,
          thresholds: {
            red: 900,
            yellow: 1900,
            green: 4300,
          },
          rules: [
            {
              name: "Paycheck",
              direction: "credit",
              amount: 2400,
              scheduleType: "monthly",
              dayOfMonth: 18,
            },
            {
              name: "Rent",
              direction: "debit",
              amount: 2050,
              variable: false,
              scheduleType: "monthly",
              dayOfMonth: 1,
            },
            {
              name: "Credit card",
              direction: "debit",
              amount: 650,
              variable: true,
              scheduleType: "monthly",
              dayOfMonth: 12,
            },
            {
              name: "Groceries",
              direction: "debit",
              amount: 190,
              variable: true,
              scheduleType: "weekly",
              dayOfWeek: 4,
            },
          ],
        }),
      },
      risk: {
        label: "Cash shortfall",
        state: createSampleState({
          startingBalance: 950,
          projectionDays: 60,
          thresholds: {
            red: 1000,
            yellow: 2000,
            green: 5000,
          },
          rules: [
            {
              name: "Paycheck",
              direction: "credit",
              amount: 2200,
              scheduleType: "monthly",
              dayOfMonth: 20,
            },
            {
              name: "Rent",
              direction: "debit",
              amount: 1800,
              variable: false,
              scheduleType: "monthly",
              dayOfMonth: 3,
            },
            {
              name: "Car repair",
              direction: "debit",
              amount: 900,
              variable: true,
              scheduleType: "adhoc",
              scheduleDate: dateInputValue(addDays(today, 9)),
            },
            {
              name: "Minimum card payment",
              direction: "debit",
              amount: 420,
              variable: false,
              scheduleType: "monthly",
              dayOfMonth: 11,
            },
          ],
        }),
      },
    };

    if (key === "random") {
      return buildRandomSampleScenario();
    }

    return scenarios[key] || scenarios.healthy;
  }

  function applySampleScenario(key) {
    var sample = buildSampleScenario(key);
    state = sample.state;
    state.sampleScenario = sample.label;
    state.recurringRules.forEach(function (rule, index) { rule.calculationOrder = index; });
    persistAndRender(UI_COPY.status.sampleLoaded + " " + sample.label + ".");
  }

  function refreshFromToday(refreshAnswer) {
    clearRemovalUndo();
    var cash = startingBalanceInput.value.replace(/[$,\s]/g, "");
    var valid = /^-?(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(cash);
    var balanceError = document.querySelector("#balance-error");
    balanceError.textContent = valid ? "" : "Enter a valid cash balance (up to two decimal places).";
    balanceError.classList.toggle("is-hidden", valid);
    if (!valid) return;
    state.startDate = todayInputValue();
    state.lastRefreshDate = state.startDate;
    state.startingBalance = clampCashBalance(Number(cash));
    state.projectionDays = parseInt(projectionDaysInput.value, 10) || 30;
    answerRefreshRequested = refreshAnswer === true;
    persistAndRender("Forecast updated from today.");
  }

  function updateRule(ruleId, field, value, type) {
    var rule = state.recurringRules.find(function (item) {
      return item.id === ruleId;
    });
    if (!rule) {
      return;
    }

    clearRemovalUndo();
    if (type === "checkbox") {
      rule[field] = value;
    } else if (
      field === "amount" ||
      field === "dayOfMonth" ||
      field === "dayOfWeek" ||
      field === "instanceLimit"
    ) {
      if (field === "amount") {
        rule[field] = parseNumericValue(value, 0);
      } else if (field === "instanceLimit") {
        rule[field] = Math.max(1, Number(value || 1));
      } else {
        rule[field] = Number(value || 0);
      }
    } else if (field === "scheduleDate") {
      rule.scheduleDate = value;
    } else if (field === "startDate") {
      rule.startDate = value;
    } else if (field === "endDate") {
      rule.endDate = value;
    } else if (field === "limitType") {
      rule.limitType = value === "count" || value === "date" ? value : "none";
    } else if (field === "variable") {
      rule.variable = value === "true";
    } else {
      rule[field] = value;
    }

    rule.pendingSchedule = Boolean(ruleScheduleIssue(rule));
    if (field === "scheduleType" || field === "limitType" || (field === "startDate" && rule.scheduleType === "biweekly" && !value)) {
      pendingFocusRuleId = ruleId;
      pendingFocusField = field;
      persistAndRender();
    } else {
      saveState(state);
      var card = Array.from(rulesList.querySelectorAll("[data-rule-id]")).find(function (element) {
        return element.getAttribute("data-rule-id") === ruleId;
      });
      if (card) {
        card.classList.toggle("is-excluded", !rule.active);
        card.querySelector(".plan-toggle span").textContent = rule.active ? "Included" : "Excluded";
        card.querySelector(".schedule-preview").textContent = schedulePreview(rule);
        var summary = card.querySelector(".rule-mobile-summary");
        summary.setAttribute("aria-label", "Edit " + rule.name);
        summary.querySelector("strong").textContent = rule.name;
        summary.querySelector("small").textContent = ruleScheduleSummary(rule);
        summary.querySelector(".mobile-rule-amount").firstChild.nodeValue =
          (rule.direction === "credit" ? "+" : "−") + formatCurrency(rule.amount);
        if (field === "amount") card.querySelector('[data-field="amount"]').value = formatNumberForInput(rule.amount);
      }
      renderProjection();
    }
  }

  function ruleInputError(rule, field, value) {
    if (field === "amount") {
      var cleaned = String(value).replace(/[$,\s]/g, "");
      if (!/^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(cleaned) || !Number.isFinite(Number(cleaned))) {
        return "Enter an amount of $0 or more, with up to two decimal places.";
      }
    }
    if (field === "dayOfMonth" || field === "instanceLimit") {
      var maximum = field === "dayOfMonth" ? 31 : 260;
      if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > maximum) {
        return "Enter a whole number from 1 to " + maximum + ".";
      }
    }
    if ((field === "startDate" || field === "endDate" || field === "scheduleDate") && !value) return "";
    if (field === "scheduleDate" || field === "endDate" || (field === "startDate" && value)) {
      if (!isValidInputDate(value)) {
        return "Choose a valid payment date.";
      }
    }
    var start = field === "startDate" ? value : rule.startDate;
    var end = field === "endDate" ? value : rule.endDate;
    var limitType = field === "limitType" ? value : rule.limitType;
    if ((field === "startDate" || field === "endDate") &&
        limitType === "date" && start && end && end < start) {
      return "The last payment date must be on or after the start date.";
    }
    return "";
  }

  function validateRuleField(input, card, rule) {
    var error = ruleInputError(rule, input.getAttribute("data-field"), input.value);
    var errorElement = card.querySelector(".rule-error");
    input.setCustomValidity(error);
    input.setAttribute("aria-invalid", String(Boolean(error)));
    input.setAttribute("aria-describedby", errorElement.id);
    errorElement.textContent = error;
    errorElement.classList.toggle("is-hidden", !error);
    return !error;
  }

  startingBalanceForm.addEventListener("submit", function (event) {
    event.preventDefault();
    refreshFromToday(true);
  });

  startingBalanceInput.addEventListener("change", function () {
    refreshFromToday();
  });

  projectionDaysInput.addEventListener("change", function () {
    clearRemovalUndo();
    state.projectionDays = parseInt(projectionDaysInput.value, 10) || 30;
    persistAndRender(UI_COPY.status.projectionWindowUpdated);
  });

  window.addEventListener("resize", function () {
    if (!latestProjectionRows.length || !hasProjectionData()) {
      return;
    }
    if (resizeTimeoutId) {
      window.clearTimeout(resizeTimeoutId);
    }
    resizeTimeoutId = window.setTimeout(function () {
      renderProjectionChart(latestProjectionRows);
    }, 120);
  });

  cushionLinesToggle.addEventListener("change", function () {
    state.showCushionLines = cushionLinesToggle.checked;
    persistAndRender();
  });

  averageBalanceToggle.addEventListener("change", function () {
    state.showAverageBalance = averageBalanceToggle.checked;
    persistAndRender();
  });

  extremaPointsToggle.addEventListener("change", function () {
    state.showExtremaPoints = extremaPointsToggle.checked;
    persistAndRender();
  });

  function readThresholdInputs() {
    var red = parseNumericValue(thresholdRedInput.value, 1000);
    var yellow = parseNumericValue(thresholdYellowInput.value, 2000);
    var green = parseNumericValue(thresholdGreenInput.value, 5000);

    return {
      red: red,
      yellow: yellow,
      green: green,
      valid: red < yellow && yellow < green,
    };
  }

  function validateThresholdInputs() {
    var thresholds = readThresholdInputs();

    if (!thresholds.valid) {
      thresholdError.textContent = UI_COPY.errors.cushionOrder;
      thresholdError.classList.remove("is-hidden");
      return thresholds;
    }

    thresholdError.textContent = "";
    thresholdError.classList.add("is-hidden");
    return thresholds;
  }

  function saveThresholds(event) {
    if (event) {
      event.preventDefault();
    }

    var thresholds = validateThresholdInputs();

    if (!thresholds.valid) {
      return;
    }

    state.thresholds.red = thresholds.red;
    state.thresholds.yellow = thresholds.yellow;
    state.thresholds.green = thresholds.green;
    persistAndRender(UI_COPY.status.cushionUpdated);
  }

  thresholdForm.addEventListener("submit", saveThresholds);

  [thresholdRedInput, thresholdYellowInput, thresholdGreenInput].forEach(function (input) {
    input.addEventListener("input", validateThresholdInputs);
    input.addEventListener("change", saveThresholds);
  });

  toggleRulesButton.addEventListener("click", function () {
    state.rulesCollapsed = !state.rulesCollapsed;
    persistAndRender();
  });

  sampleScenarioButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      applySampleScenario(button.getAttribute("data-sample-scenario"));
    });
  });

  function downloadLocalBackup() {
    var url;
    var link;
    try {
      var exportedAt = new Date();
      var filename = exportFilename(exportedAt);
      var blob = new Blob([backupPayload(exportedAt)], { type: "application/json" });
      url = window.URL.createObjectURL(blob);
      link = document.createElement("a");
      link.href = url;
      link.addEventListener("click", function (event) { event.stopPropagation(); });
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      showDataStatus(UI_COPY.status.backupDownloaded + " File: " + filename + " (UTC timestamp).", true);
    } catch (error) {
      showDataIssue("The download could not be started. Your plan is unchanged. Try again and check your browser’s download settings.");
    } finally {
      if (link) link.remove();
      // Keep the Blob alive while the browser takes ownership of the download.
      if (url) window.setTimeout(function () { window.URL.revokeObjectURL(url); }, 60000);
    }
  }

  exportDataButton.addEventListener("click", downloadLocalBackup);
  document.querySelector("#start-own-plan").addEventListener("click", function () { resetDataButton.click(); });
  document.querySelector("#dismiss-undo").addEventListener("click", function () {
    clearRemovalUndo();
    addMoneyInRuleButton.focus({ preventScroll: true });
  });

  importDataButton.addEventListener("click", function () {
    importFileInput.click();
  });

  importFileInput.addEventListener("change", function (event) {
    var file = event.target.files && event.target.files[0];
    var reader;

    if (!file) {
      return;
    }

    reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(reader.result);
        var restoredState = readBackupState(parsed);
        requestDataConfirmation(backupRestoreCopy(UI_COPY.confirms.restoreFile, restoredState, parsed.exportedAt)).then(function (confirmed) {
          if (confirmed) {
            state = restoredState;
            persistAndRender();
            showDataStatus(UI_COPY.status.importSuccess);
          }
        });
      } catch (error) {
        showDataIssue(UI_COPY.errors.importInvalid);
      }
      importFileInput.value = "";
    };
    reader.readAsText(file);
  });

  resetDataButton.addEventListener("click", function () {
    requestDataConfirmation(UI_COPY.confirms.reset, { danger: true }).then(function (confirmed) {
      if (!confirmed) {
        return;
      }
      state = cloneDefaultState();
      persistAndRender();
      showDataStatus(UI_COPY.status.resetSuccess);
    });
  });

  function runDriveAction(action, button, message) {
    if (dataMenu.getAttribute("data-busy") === "true") return Promise.resolve();
    var controls = [saveDriveButton, restoreDriveButton, importDataButton, resetDataButton];
    dataMenu.setAttribute("data-busy", "true");
    button.setAttribute("aria-busy", "true");
    controls.forEach(function (control) { control.disabled = true; });
    showDataStatus(message, true);
    return Promise.resolve().then(action).finally(function () {
      dataMenu.removeAttribute("data-busy");
      button.removeAttribute("aria-busy");
      controls.forEach(function (control) { control.disabled = false; });
      if (dataActionStatus.textContent === message) dataActionStatus.classList.add("is-hidden");
    });
  }

  saveDriveButton.addEventListener("click", function () {
    runDriveAction(saveBackupToDrive, saveDriveButton, "Backing up to Drive…");
  });
  restoreDriveButton.addEventListener("click", function () {
    runDriveAction(restoreBackupFromDrive, restoreDriveButton, "Loading Drive backup…");
  });
  dataMenu.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    closeDataMenu();
    dataMenu.querySelector("summary").focus();
  });

  document.addEventListener("click", function (event) {
    if (dataMenu && dataMenu.hasAttribute("open") && !dataMenu.contains(event.target)) {
      closeDataMenu();
    }
  });

  function addRecurringRule(direction) {
    clearRemovalUndo();
    var newRule = {
      id: makeId("rule"),
      name:
        direction === "credit"
          ? UI_COPY.defaults.moneyInRuleName
          : UI_COPY.defaults.moneyOutRuleName,
      direction: direction,
      amount: 0,
      variable: direction === "debit",
      active: true,
      calculationOrder: state.recurringRules.reduce(function (max, rule) { return Math.max(max, rule.calculationOrder || 0); }, -1) + 1,
      scheduleType: "monthly",
      dayOfMonth: 1,
      dayOfWeek: 3,
      scheduleDate: "",
      startDate: "",
      limitType: "none",
      instanceLimit: 1,
      endDate: "",
    };

    if (direction === "credit") {
      state.ruleGroups.moneyInOpen = true;
    } else {
      state.ruleGroups.moneyOutOpen = true;
    }

    state.rulesCollapsed = false;
    state.recurringRules.push(newRule);
    expandedRuleId = newRule.id;
    pendingFocusRuleId = newRule.id;
    pendingFocusField = "name";
    pendingScrollRuleId = newRule.id;
    persistAndRender(
      direction === "credit" ? UI_COPY.status.addedMoneyIn : UI_COPY.status.addedMoneyOut,
    );
  }

  addMoneyInRuleButton.addEventListener("click", function () {
    addRecurringRule("credit");
  });

  addMoneyOutRuleButton.addEventListener("click", function () {
    addRecurringRule("debit");
  });

  themeChoiceButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      var nextPreference = button.getAttribute("data-theme-choice");

      if (nextPreference === "system" || nextPreference === "dark" || nextPreference === "light") {
        applyThemePreference(nextPreference, { persist: true, render: true });
      }
    });
  });

  if (systemThemeQuery) {
    if (systemThemeQuery.addEventListener) {
      systemThemeQuery.addEventListener("change", function () {
        if (themePreference === "system") {
          applyThemePreference("system", { persist: false, render: true });
        }
      });
    } else if (systemThemeQuery.addListener) {
      systemThemeQuery.addListener(function () {
        if (themePreference === "system") {
          applyThemePreference("system", { persist: false, render: true });
        }
      });
    }
  }

  rulesList.addEventListener("change", function (event) {
    var card = event.target.closest("[data-rule-id]");
    if (!card) {
      return;
    }

    var rule = state.recurringRules.find(function (item) {
      return item.id === card.getAttribute("data-rule-id");
    });
    if (!rule || !validateRuleField(event.target, card, rule)) {
      return;
    }

    updateRule(
      card.getAttribute("data-rule-id"),
      event.target.getAttribute("data-field"),
      event.target.type === "checkbox" ? event.target.checked : event.target.value,
      event.target.type,
    );
  });

  rulesList.addEventListener("input", function (event) {
    var card = event.target.closest("[data-rule-id]");
    var field = event.target.getAttribute("data-field");
    var rule;

    if (!card || (field !== "name" && field !== "amount")) {
      return;
    }

    rule = state.recurringRules.find(function (item) {
      return item.id === card.getAttribute("data-rule-id");
    });

    if (!rule) {
      return;
    }

    if (!validateRuleField(event.target, card, rule)) {
      return;
    }

    clearRemovalUndo();
    if (field === "amount") {
      rule.amount = parseNumericValue(event.target.value, 0);
    } else {
      rule.name = event.target.value;
    }

    saveState(state);

    if (ruleInputTimeoutId) {
      window.clearTimeout(ruleInputTimeoutId);
    }

    ruleInputTimeoutId = window.setTimeout(function () {
      renderProjection();
    }, 250);
  });

  rulesList.addEventListener("click", function (event) {
    var button = event.target.closest("[data-action]");
    if (!button) return;
    var card = event.target.closest("[data-rule-id]");
    if (!card) return;
    var id = card.getAttribute("data-rule-id");
    if (button.dataset.action === "edit-rule" || button.dataset.action === "done-editing") {
      var invalid = card.querySelector('[aria-invalid="true"]');
      if (invalid) { invalid.focus(); return; }
      var view = captureView();
      expandedRuleId = expandedRuleId === id ? null : id;
      renderRules();
      var summary = Array.from(rulesList.querySelectorAll("[data-action='edit-rule']")).find(function (el) { return el.closest("[data-rule-id]").dataset.ruleId === id; });
      if (summary) summary.focus({ preventScroll: true });
      if (view.action === "done-editing") window.scrollBy(0, summary.getBoundingClientRect().top - Math.min(view.top, 160));
      else restoreView(view);
      return;
    }
    if (button.dataset.action === "move-up" || button.dataset.action === "move-down") {
      var peers = state.recurringRules.filter(function (item) { return item.direction === card.dataset.direction; });
      var index = peers.findIndex(function (item) { return item.id === id; });
      var before = button.dataset.action === "move-up" ? peers[index - 1] : peers[index + 2];
      if (button.dataset.action === "move-up" && index === 0) return;
      moveRuleWithinDirection(state.recurringRules, id, before ? before.id : null);
      clearRemovalUndo();
      persistAndRender("Payment moved within " + (card.dataset.direction === "credit" ? "Money in." : "Money out."));
      var movedCard = Array.from(rulesList.querySelectorAll(".rule-card")).find(function (item) { return item.dataset.ruleId === id; });
      var nextControl = movedCard.querySelector('[data-action="' + button.dataset.action + '"]');
      (nextControl.disabled ? movedCard.querySelector(".rule-drag-handle") : nextControl).focus({ preventScroll: true });
      return;
    }
    if (button.dataset.action !== "delete-rule") return;
    var removedIndex = state.recurringRules.findIndex(function (rule) { return rule.id === id; });
    undoRemoval = { state: state, rule: state.recurringRules[removedIndex], index: removedIndex, skipped: Object.assign({}, state.skippedInstances) };
    state.recurringRules = state.recurringRules.filter(function (rule) {
      return rule.id !== card.getAttribute("data-rule-id");
    });
    Object.keys(state.skippedInstances).forEach(function (key) {
      if (key.indexOf(card.getAttribute("data-rule-id") + "::") === 0) {
        delete state.skippedInstances[key];
      }
    });
    if (expandedRuleId === id) expandedRuleId = null;
    persistAndRender(UI_COPY.status.removedItem);
    document.querySelector("#undo-removal").classList.remove("is-hidden");
    document.querySelector("#undo-removal-copy").textContent = undoRemoval.rule.name + " removed.";
    document.querySelector("#undo-remove").focus();
  });

  var ruleDrag = null;
  function endRuleDrag(commit) {
    if (!ruleDrag) return;
    window.clearTimeout(ruleDrag.timer);
    var drag = ruleDrag;
    ruleDrag = null;
    document.querySelectorAll(".is-dragging, .drop-before, .drop-after").forEach(function (element) { element.classList.remove("is-dragging", "drop-before", "drop-after"); });
    if (commit && drag.ready && drag.targetId) {
      var peers = state.recurringRules.filter(function (rule) { return rule.direction === drag.direction; });
      var position = peers.findIndex(function (rule) { return rule.id === drag.targetId; });
      var before = drag.after ? peers[position + 1] : peers[position];
      moveRuleWithinDirection(state.recurringRules, drag.id, before ? before.id : null);
      clearRemovalUndo();
      persistAndRender("Payment moved. Use Move up or Move down for precise positioning.");
      var card = Array.from(rulesList.querySelectorAll(".rule-card")).find(function (item) { return item.dataset.ruleId === drag.id; });
      card.querySelector(".rule-drag-handle").focus({ preventScroll: true });
    }
  }
  rulesList.addEventListener("pointerdown", function (event) {
    var handle = event.target.closest(".rule-drag-handle");
    if (!handle || (event.button !== 0 && event.pointerType !== "touch")) return;
    var card = handle.closest(".rule-card");
    ruleDrag = { id: card.dataset.ruleId, direction: card.dataset.direction, ready: false };
    handle.setPointerCapture(event.pointerId);
    ruleDrag.timer = window.setTimeout(function () {
      if (!ruleDrag) return;
      ruleDrag.ready = true;
      card.classList.add("is-dragging");
      showStatus("Move within " + (card.dataset.direction === "credit" ? "Money in" : "Money out") + "; release to place. Escape cancels.");
    }, event.pointerType === "touch" ? 350 : 0);
  });
  rulesList.addEventListener("pointermove", function (event) {
    if (!ruleDrag || !ruleDrag.ready) return;
    var hit = document.elementFromPoint(event.clientX, event.clientY);
    var target = hit && hit.closest(".rule-card");
    document.querySelectorAll(".drop-before, .drop-after").forEach(function (card) { card.classList.remove("drop-before", "drop-after"); });
    ruleDrag.targetId = null;
    if (target && target.dataset.direction === ruleDrag.direction && target.dataset.ruleId !== ruleDrag.id) {
      ruleDrag.targetId = target.dataset.ruleId;
      ruleDrag.after = event.clientY > target.getBoundingClientRect().top + target.getBoundingClientRect().height / 2;
      target.classList.add(ruleDrag.after ? "drop-after" : "drop-before");
    }
    if (event.clientY < 90) window.scrollBy(0, -14);
    if (event.clientY > window.innerHeight - 80) window.scrollBy(0, 14);
  });
  rulesList.addEventListener("pointerup", function () { endRuleDrag(true); });
  rulesList.addEventListener("pointercancel", function () { endRuleDrag(false); });
  rulesList.addEventListener("lostpointercapture", function () { endRuleDrag(false); });
  document.addEventListener("keydown", function (event) { if (event.key === "Escape") endRuleDrag(false); });

  projectionTableBody.addEventListener("click", function (event) {
    var button = event.target.closest("[data-action='toggle-instance']");
    var key;

    if (!button) {
      return;
    }

    clearRemovalUndo();
    key = instanceKey(button.getAttribute("data-rule-id"), button.getAttribute("data-date-key"));

    if (state.skippedInstances[key]) {
      delete state.skippedInstances[key];
      persistAndRender(UI_COPY.status.includedItem);
    } else {
      state.skippedInstances[key] = true;
      persistAndRender(UI_COPY.status.excludedItem);
    }
    var restoredButton = Array.from(projectionTableBody.querySelectorAll("[data-action='toggle-instance']")).find(function (el) {
      return instanceKey(el.dataset.ruleId, el.dataset.dateKey) === key;
    });
    if (restoredButton) restoredButton.focus({ preventScroll: true });
  });

  rulesList.addEventListener("toggle", function (event) {
    if (!event.target.classList.contains("rule-group")) {
      return;
    }

    if (event.target.getAttribute("data-group") === "money-in") {
      state.ruleGroups.moneyInOpen = event.target.open;
    }

    if (event.target.getAttribute("data-group") === "money-out") {
      state.ruleGroups.moneyOutOpen = event.target.open;
    }

    saveState(state);
  });

  document.querySelector("#data-dialog-backup").addEventListener("click", function () { exportDataButton.click(); });
  document.querySelector("#undo-remove").addEventListener("click", function () {
    if (!undoRemoval || undoRemoval.state !== state) return;
    state.recurringRules.splice(undoRemoval.index, 0, undoRemoval.rule);
    Object.keys(undoRemoval.skipped).forEach(function (key) {
      if (key.indexOf(undoRemoval.rule.id + "::") === 0) state.skippedInstances[key] = undoRemoval.skipped[key];
    });
    expandedRuleId = undoRemoval.rule.id;
    pendingFocusRuleId = undoRemoval.rule.id;
    pendingFocusField = "name";
    undoRemoval = null;
    document.querySelector("#undo-removal").classList.add("is-hidden");
    persistAndRender("Payment restored.");
  });
  document.querySelector("#restore-exclusions").addEventListener("click", function () {
    clearRemovalUndo();
    state.skippedInstances = {};
    persistAndRender("All skipped payments included again. Whole-item exclusions are unchanged.");
    document.querySelector("#scenario-count").setAttribute("tabindex", "-1");
    document.querySelector("#scenario-count").focus();
  });
  document.querySelector("#show-more-transactions").addEventListener("click", function () {
    var firstNewIndex = ledgerLimit;
    ledgerLimit += 20;
    renderProjection();
    var firstNewRow = projectionTableBody.rows[firstNewIndex];
    if (firstNewRow) {
      var nextAction = firstNewRow.querySelector("button");
      if (nextAction) nextAction.focus();
    }
  });

  function markSection(id) {
    document.querySelectorAll(".mobile-section-nav a").forEach(function (link) {
      if (link.getAttribute("href") === "#" + id) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  }
  document.querySelectorAll(".mobile-section-nav a").forEach(function (link) {
    link.addEventListener("click", function () { markSection(link.hash.slice(1)); });
  });
  function markVisibleSection() {
    var current = "forecast";
    ["forecast", "payments", "transactions"].forEach(function (id) {
      if (document.getElementById(id).getBoundingClientRect().top <= 140) current = id;
    });
    markSection(current);
  }
  var sectionFramePending = false;
  window.addEventListener("scroll", function () {
    if (sectionFramePending) return;
    sectionFramePending = true;
    window.requestAnimationFrame(function () { sectionFramePending = false; markVisibleSection(); });
  }, { passive: true });

  function configureResponsiveUI() {
    if (mobileQuery.matches) {
      dataMenu.querySelector(".data-menu-panel").appendChild(themeSwitcher);
      chartOptions.open = false;
    } else {
      utilityHome.appendChild(themeSwitcher);
      chartOptions.open = true;
    }
  }
  if (mobileQuery.addEventListener) mobileQuery.addEventListener("change", configureResponsiveUI);
  else mobileQuery.addListener(configureResponsiveUI);
  function refreshDeviceTheme() {
    if (themePreference !== "system") return;
    var changed = document.documentElement.getAttribute("data-theme") !== resolveThemePreference("system");
    applyThemePreference("system", { persist: false, render: changed });
  }
  ["pageshow", "focus"].forEach(function (name) { window.addEventListener(name, refreshDeviceTheme); });
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) refreshDeviceTheme();
  });
  configureResponsiveUI();
  syncDriveStatus();
  persistAndRender();
})();
