(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.BrowserPlatform = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // Resolve lazily: unavailable storage must fail inside the caller's existing guard.
  function storage(resolve) {
    return {
      getItem: function (key) { return resolve().getItem(key); },
      setItem: function (key, value) { resolve().setItem(key, value); },
      removeItem: function (key) { resolve().removeItem(key); },
    };
  }

  function create(environment) {
    var win = environment.window;
    var doc = environment.document;
    return {
      local: storage(function () { return win.localStorage; }),
      session: storage(function () { return win.sessionStorage; }),
      navigate: function (url) { win.location.assign(url); },
      onResume: function (callback) {
        win.addEventListener("focus", callback);
        win.addEventListener("pageshow", callback);
        doc.addEventListener("visibilitychange", callback);
      },
      onConnectivity: function (online, offline) {
        win.addEventListener("online", online);
        win.addEventListener("offline", offline);
      },
      readText: function (file, onLoad) {
        var reader = new win.FileReader();
        reader.onload = function () { onLoad(reader.result); };
        reader.readAsText(file);
      },
      download: function (contents, filename) {
        var url;
        var link;
        try {
          var blob = new win.Blob([contents], { type: "application/json" });
          url = win.URL.createObjectURL(blob);
          link = doc.createElement("a");
          link.href = url;
          link.addEventListener("click", function (event) { event.stopPropagation(); });
          link.download = filename;
          doc.body.appendChild(link);
          link.click();
        } finally {
          if (link) link.remove();
          // Preserve the browser handoff lifetime, including a failed click.
          if (url) win.setTimeout(function () { win.URL.revokeObjectURL(url); }, 60000);
        }
      },
    };
  }
  return { storage: storage, create: create };
});
