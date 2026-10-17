(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.ProjectionHealth = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  var DEFAULT_CONFIG = {
    minimumGrowthDollars: 250,
    meaningfulGrowthPercent: 0.05,
  };

  var SEVERITY_BY_STATUS = {
    Healthy: "positive",
    Building: "improving",
    Stable: "neutral",
    Tight: "caution",
    "At Risk": "danger",
  };

  var SUMMARY_COPY = {
    Healthy: "You've got breathing room.",
    Building: "Your cushion is moving in the right direction.",
    Stable: "Things are holding steady.",
    Tight: "Your cushion is getting thin.",
    "At Risk": "This projection needs attention.",
  };

  var DETAIL_COPY = {
    Healthy: "Your projection stays comfortably above your cushion target.",
    Building: "Your projected balance is improving over time.",
    Stable: "Your balance is mostly staying in range.",
    Tight: "Your projection gets close to your caution zone.",
    "At Risk": "Your projection enters the red zone or gets dangerously low.",
  };

  var RECOMMENDED_ACTIONS = {
    Healthy: "Keep the plan going and watch for major upcoming changes.",
    Building: "Keep building your cushion and confirm the growth is repeatable.",
    Stable: "Maintain the current plan and keep an eye on upcoming expenses.",
    Tight: "Review upcoming expenses before adding new commitments.",
    "At Risk":
      "Take action before the low point by reducing expenses, delaying optional spending, or adding funds.",
  };

  function mergeConfig(config) {
    config = config || {};

    return {
      minimumGrowthDollars: Number(
        config.minimumGrowthDollars || DEFAULT_CONFIG.minimumGrowthDollars,
      ),
      meaningfulGrowthPercent: Number(
        config.meaningfulGrowthPercent || DEFAULT_CONFIG.meaningfulGrowthPercent,
      ),
    };
  }

  function calculateMetrics(projectionPoints, config) {
    var balances = projectionPoints.map(function (point) {
      return Number(point.balance || 0);
    });
    var startBalance = balances[0];
    var endBalance = balances[balances.length - 1];
    var minBalance = Math.min.apply(null, balances);
    var maxBalance = Math.max.apply(null, balances);
    var netChange = endBalance - startBalance;
    var percentChange = netChange / Math.max(Math.abs(startBalance), 1);

    return {
      startBalance: startBalance,
      endBalance: endBalance,
      minBalance: minBalance,
      maxBalance: maxBalance,
      netChange: netChange,
      percentChange: percentChange,
    };
  }

  function meaningfulGrowthThreshold(metrics, config) {
    return Math.max(config.minimumGrowthDollars, metrics.startBalance * config.meaningfulGrowthPercent);
  }

  function classifyProjection(metrics, options, config) {
    var redLimit = Number(options.redLimit);
    var yellowLimit = Number(options.yellowLimit);
    var greenLimit = Number(options.greenLimit);

    if (metrics.minBalance <= redLimit || metrics.endBalance <= redLimit) {
      return "At Risk";
    }
    if (metrics.minBalance < yellowLimit || metrics.endBalance < greenLimit) {
      return "Tight";
    }
    if (
      metrics.netChange >= meaningfulGrowthThreshold(metrics, config) &&
      metrics.endBalance >= yellowLimit &&
      metrics.minBalance >= redLimit
    ) {
      return "Building";
    }
    if (metrics.minBalance >= greenLimit && metrics.endBalance >= metrics.startBalance * 0.95) {
      return "Healthy";
    }
    return "Stable";
  }

  function evaluateProjectionHealth(projectionPoints, options, config) {
    var safePoints = Array.isArray(projectionPoints) ? projectionPoints : [];
    var mergedConfig = mergeConfig(config);
    var metrics;
    var status;

    if (safePoints.length < 2) {
      return {
        status: "Stable",
        severity: "neutral",
        summary: "Add a few upcoming moves to see where things are headed.",
        detail: "Your forecast needs at least two projected balance points.",
        recommendedAction: "Add more projection data, then run the numbers.",
        metrics: null,
      };
    }

    metrics = calculateMetrics(safePoints, mergedConfig);
    status = classifyProjection(metrics, options || {}, mergedConfig);

    return {
      status: status,
      severity: SEVERITY_BY_STATUS[status],
      summary: SUMMARY_COPY[status],
      detail: DETAIL_COPY[status],
      recommendedAction: RECOMMENDED_ACTIONS[status],
      metrics: metrics,
    };
  }

  return {
    DEFAULT_CONFIG: DEFAULT_CONFIG,
    evaluateProjectionHealth: evaluateProjectionHealth,
  };
});
