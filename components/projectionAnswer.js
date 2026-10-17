(function (root) {
  function ProjectionAnswer(element, options) {
    this.element = element;
    this.copy = (options && options.copy) || root.projectionAnswerCopy;
    this.lastKey = "";
    this.animated = false;
  }

  ProjectionAnswer.prototype.update = function (options) {
    var hasData = Boolean(options && options.hasProjectionData);
    var entry = !hasData ? this.copy.fallback : options.dropsBelowZero ? this.copy.yes : this.copy.no;
    var key = entry.text;
    if (key === this.lastKey) return;
    this.lastKey = key;
    var animate = hasData && !this.animated;
    if (hasData) this.animated = true;
    this.element.className = "projection-answer underline-" + entry.underline + (animate ? " is-typing" : "");
    this.element.setAttribute("aria-label", hasData
      ? entry.text + " Based on the payments entered for the selected forecast period."
      : entry.text);
    this.element.innerHTML = '<span class="projection-answer-text" aria-hidden="true"></span>' +
      '<span class="projection-answer-stroke" aria-hidden="true"></span>';
    this.element.querySelector(".projection-answer-text").textContent = entry.text;
  };

  root.ProjectionAnswer = {
    create: function (element, options) { return new ProjectionAnswer(element, options || {}); },
  };
})(typeof window !== "undefined" ? window : this);
