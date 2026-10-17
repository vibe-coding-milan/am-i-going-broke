(function (root) {
  // Answer the zero-balance question; the forecast badge provides cushion context.
  root.projectionAnswerCopy = {
    fallback: { text: "Let's see.", underline: "soft" },
    no: { text: "Nope.", underline: "confident" },
    yes: { text: "Yep.", underline: "risk" },
  };
})(typeof window !== "undefined" ? window : this);
