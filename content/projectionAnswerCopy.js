(function (root) {
  // Zero crossings take priority over cushion categories. Humor never changes the forecast.
  root.projectionAnswerCopy = {
    fallback: "Let's see the numbers.",
    responses: {
      Healthy: [
        "Nope. Actually, you can take me out to dinner.",
        "No. Why are you even on this site?",
        "Nope. The creator would like to friend you on Venmo.",
      ],
      Building: [
        "Nope. Look at you, having a financial arc.",
        "Nope. Cushion loading.",
      ],
      Stable: ["Not today. The bills have been contained."],
      Tight: [
        "Not yet. Might be time to sell those feet pics.",
        "Not yet. Have you tried selling on eBay?",
        "Not yet. Maybe a second job. Or a third?",
      ],
      "At Risk": [
        "Not yet. Too close, babe.",
        "Not yet. The math needs attention.",
      ],
      broke: [
        "Yep. Have you considered a life of crime?",
        "Yep. I'm not saying rob a bank, but...",
        "Yep. How attached are you to that extra kidney?",
        "Yep. The bills would like a word.",
        "Yep. Have you considered being a sugar baby?",
      ],
    },
  };
})(typeof window !== "undefined" ? window : this);
