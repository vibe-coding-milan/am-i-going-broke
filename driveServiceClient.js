(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.DriveServiceClient = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function resolveEndpoint(configured, location) {
    try {
      var endpoint = new URL(configured, location.href);
      if (endpoint.origin !== location.origin || endpoint.username || endpoint.password || endpoint.hash) return null;
      if (endpoint.protocol !== "https:" && ["localhost", "127.0.0.1", "[::1]"].indexOf(endpoint.hostname) === -1) return null;
      return endpoint;
    } catch (error) { return null; }
  }

  function authorizationDestination(value) {
    var url = new URL(value);
    if (url.origin !== "https://accounts.google.com" || url.pathname !== "/o/oauth2/v2/auth") throw new Error("Unexpected authorization destination");
    return url.href;
  }

  function create(options) {
    var endpoint = options.endpoint;
    var setTimeout = options.setTimeout;
    var clearTimeout = options.clearTimeout;
    async function request(action, body) {
      var url = new URL(endpoint); url.searchParams.set("action", action);
      var headers = { Accept: "application/json" };
      if (body !== undefined) { headers["Content-Type"] = "application/json"; headers["X-Sync-CSRF"] = options.getSession() && options.getSession().csrf || ""; }
      var abort = new options.AbortController();
      var timeout = setTimeout(function () { abort.abort(); }, 35000);
      try {
        var response = await options.fetch(url.href, { method: body === undefined ? "GET" : "POST", credentials: "same-origin", cache: "no-store",
          headers: headers, body: body === undefined ? undefined : JSON.stringify(body), signal: abort.signal });
        var data;
        try { data = await response.json(); } catch (error) { throw Object.assign(new Error("Unavailable"), { code: "unavailable" }); }
        if (!response.ok) {
          var code = data.error || "temporary";
          if (code === "csrf") code = "auth";
          if (code === "invalid") code = "remote";
          if (code === "ambiguous" || code === "setup") code = "missing";
          var messages = { auth: "Reconnect Google Drive to continue.", no_backup: "No manual Google Drive backup was found for this app.",
            missing: "The Drive folder or plan is unavailable. Your local plan is unchanged.",
            conflict: "The Drive plan changed on another device. Review sync settings.", remote: "The Drive file could not be read safely. Your local plan is unchanged." };
          throw Object.assign(new Error(messages[code] || "Drive sync is temporarily unavailable. Your local plan is unchanged."), { code: code });
        }
        return data;
      } finally { clearTimeout(timeout); }
    }
    return { request: request, authorizationDestination: authorizationDestination };
  }
  return { create: create, resolveEndpoint: resolveEndpoint };
});
