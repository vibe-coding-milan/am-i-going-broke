(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ForecastCore = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

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

  function lastDayOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }

  function instanceKey(ruleId, dateKey) {
    return ruleId + "::" + dateKey;
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

  function flattenProjectionRows(state) {
    var projection = generateProjection(state, true);
    var windowEndDate = addDays(
      parseInputDate(state.startDate),
      Number(state.projectionDays || 30) - 1,
    );
    var rows = [
      {
        type: "current",
        dateLabel: formatDate(parseInputDate(state.startDate)),
        name: "Starting balance",
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

    appendOutsideWindowRows(rows, windowEndDate, runningBalance, state);

    return rows;
  }

  function appendOutsideWindowRows(rows, windowEndDate, runningBalance, state) {
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

  function projectionPointsFromRows(rows, state) {
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

  return {
    todayInputValue: todayInputValue,
    dateInputValue: dateInputValue,
    startOfDay: startOfDay,
    parseInputDate: parseInputDate,
    addDays: addDays,
    calendarDayNumber: calendarDayNumber,
    isValidInputDate: isValidInputDate,
    formatDate: formatDate,
    lastDayOfMonth: lastDayOfMonth,
    instanceKey: instanceKey,
    isRuleBaseDueOnDate: isRuleBaseDueOnDate,
    occurrenceNumberThroughDate: occurrenceNumberThroughDate,
    isRuleWithinLimit: isRuleWithinLimit,
    isRuleDueOnDate: isRuleDueOnDate,
    ruleScheduleIssue: ruleScheduleIssue,
    moveRuleWithinDirection: moveRuleWithinDirection,
    generateProjection: generateProjection,
    ruleInputError: ruleInputError,
    flattenProjectionRows: flattenProjectionRows,
    projectionPointsFromRows: projectionPointsFromRows
  };
});
