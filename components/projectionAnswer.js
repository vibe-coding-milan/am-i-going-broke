(function (root) {
  function ProjectionAnswer(element, options) {
    this.element = element;
    this.copy = (options && options.copy) || root.projectionAnswerCopy;
    this.lastKey = null;
    this.category = null;
    this.answer = "";
    this.timers = [];
    this.generation = 0;
    this.motion = root.matchMedia ? root.matchMedia("(prefers-reduced-motion: reduce)") : null;
    element.innerHTML = '<span class="projection-answer-sizer" aria-hidden="true"></span>' +
      '<span class="projection-answer-text" aria-hidden="true"></span>' +
      '<span class="visually-hidden projection-answer-announcement"></span>';
    this.sizer = element.querySelector(".projection-answer-sizer");
    this.visual = element.querySelector(".projection-answer-text");
    this.announcement = element.querySelector(".projection-answer-announcement");
    var self = this;
    if (this.motion && this.motion.addEventListener) {
      this.motion.addEventListener("change", function () {
        if (self.motion.matches) { self.cancel(); self.finish(); }
      });
    }
  }

  ProjectionAnswer.prototype.cancel = function () {
    this.timers.forEach(function (id) { root.clearTimeout(id); });
    this.timers = [];
    this.generation += 1;
  };

  ProjectionAnswer.prototype.finish = function () {
    this.visual.textContent = this.answer;
    this.element.className = "projection-answer is-complete";
    this.announcement.textContent = this.answer + (this.category === "empty" ? "" :
      " Based on the payments entered for the selected forecast period.");
    this.element.setAttribute("aria-busy", "false");
    this.timers = [];
  };

  ProjectionAnswer.prototype.update = function (options) {
    var hasData = Boolean(options && options.hasProjectionData);
    var category = !hasData ? "empty" : options.dropsBelowZero ? "broke" : options.status;
    var key = JSON.stringify([category, options.forecastKey || ""]);
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.cancel();
    if (category !== this.category) {
      var pool = this.copy.responses[category] || this.copy.responses.Stable;
      this.answer = !hasData ? this.copy.fallback : pool[Math.floor(Math.random() * pool.length)];
      this.category = category;
    }
    this.sizer.textContent = this.answer;
    if (!hasData || (this.motion && this.motion.matches)) { this.finish(); return; }

    var self = this;
    var generation = this.generation;
    function later(callback, delay) {
      self.timers.push(root.setTimeout(function () {
        if (self.generation === generation) callback();
      }, delay));
    }
    this.element.className = "projection-answer is-thinking";
    this.element.setAttribute("aria-busy", "true");
    this.announcement.textContent = "";
    this.visual.textContent = ".";
    later(function () { self.visual.textContent = ".."; }, 333);
    later(function () { self.visual.textContent = "..."; }, 666);
    later(function () {
      self.element.className = "projection-answer is-typing";
      self.visual.textContent = "";
      var length = 0;
      function typeNext() {
        length += 1;
        self.visual.textContent = self.answer.slice(0, length);
        if (length < self.answer.length) later(typeNext, 40);
        else self.finish();
      }
      later(typeNext, 40);
    }, 1000);
  };

  root.ProjectionAnswer = {
    create: function (element, options) { return new ProjectionAnswer(element, options || {}); },
  };
})(typeof window !== "undefined" ? window : this);
