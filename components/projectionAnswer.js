(function (root) {
  function prefersReducedMotion() {
    return (
      root.matchMedia &&
      root.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function pickThinkingText(copy, key) {
    var options = copy.thinking || [];

    if (!options.length) {
      return "Running the numbers...";
    }

    return options[Math.abs(key || 0) % options.length];
  }

  function resolveAnswer(copy, status, hasProjectionData) {
    if (!hasProjectionData) {
      return copy.fallback;
    }

    return copy.statuses[status] || copy.fallback;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function ProjectionAnswer(element, options) {
    this.element = element;
    this.copy = (options && options.copy) || root.projectionAnswerCopy || {};
    this.className = options && options.className ? " " + options.className : "";
    this.timeoutId = null;
    this.lastKey = "";
    this.lastMotionKey = null;
  }

  ProjectionAnswer.prototype.render = function (entry, state) {
    var isThinking = state === "thinking";
    var underline = entry.underline || "soft";

    this.element.className =
      "projection-answer" +
      (isThinking ? " is-thinking" : " is-revealed") +
      " underline-" +
      underline +
      this.className;
    this.element.setAttribute("data-underline", underline);
    this.element.innerHTML =
      '<span class="projection-answer-text">' +
      escapeHtml(entry.text) +
      "</span>" +
      '<span class="projection-answer-stroke" aria-hidden="true"></span>';
  };

  ProjectionAnswer.prototype.update = function (options) {
    var status = options && options.status;
    var hasProjectionData = Boolean(options && options.hasProjectionData);
    var motionKey = options && options.motionKey;
    var entry = resolveAnswer(this.copy, status, hasProjectionData);
    var answerKey = (hasProjectionData ? status : "fallback") + "::" + entry.text;
    var shouldReplay = motionKey !== this.lastMotionKey;
    var reducedMotion = prefersReducedMotion();
    var thinkingEntry;
    var self = this;

    if (answerKey === this.lastKey && !shouldReplay) {
      return;
    }

    this.lastKey = answerKey;
    this.lastMotionKey = motionKey;

    if (this.timeoutId) {
      root.clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    if (reducedMotion || !shouldReplay) {
      this.render(entry, "answer");
      return;
    }

    thinkingEntry = {
      text: pickThinkingText(this.copy, Number(motionKey || 0)),
      underline: "soft",
    };

    this.render(thinkingEntry, "thinking");
    this.timeoutId = root.setTimeout(function () {
      self.render(entry, "answer");
      self.timeoutId = null;
    }, 720);
  };

  root.ProjectionAnswer = {
    create: function (element, options) {
      return new ProjectionAnswer(element, options || {});
    },
  };
})(typeof window !== "undefined" ? window : this);
