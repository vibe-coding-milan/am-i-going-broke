(function (root) {
  // Tone notes: keep answers clear first, lightly cheeky in healthy states, and calm in risk states.
  root.projectionAnswerCopy = {
    thinking: [
      "Running the numbers...",
      "Checking the forecast...",
      "Looking ahead...",
    ],
    fallback: {
      text: "Start with your cash. We'll take it from there.",
      underline: "soft",
    },
    statuses: {
      Healthy: {
        text: "Nope. You've got breathing room.",
        underline: "confident",
      },
      Building: {
        text: "Not if this trend keeps up.",
        underline: "upward",
      },
      Stable: {
        text: "You're holding steady.",
        underline: "steady",
      },
      Tight: {
        text: "The cushion's getting thin.",
        underline: "caution",
      },
      "At Risk": {
        text: "This needs attention.",
        underline: "risk",
      },
    },
  };
})(typeof window !== "undefined" ? window : this);
