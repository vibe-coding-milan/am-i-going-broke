(function (root) {
  "use strict";
  var LABELS = {
    off: "Sync paused", local: "Ready to sync", pending: "Waiting to sync",
    checking: "Checking Drive…", saving: "Syncing…", synced: "Up to date",
    offline: "Saved on this device · Offline", reconnect: "Reconnect Drive to resume sync",
    conflict: "Different versions · Review sync", missing: "Drive file unavailable · Review sync",
    account: "Google account changed · Review sync", remote: "Drive file needs attention",
    retrying: "Saved on this device · Retrying Drive", storage: "Sync paused · Browser storage is full",
    sample: "Start your own plan to enable sync", invalid: "Finish the payment details to sync",
    editing: "Finish editing to sync", unavailable: "Drive sync isn’t ready to connect yet. Your plan is saved on this device.",
    service: "Saved on this device · Sync unavailable",
  };
  // Presentation never grants permission: setup and engine reconciliation remain separate.
  function connectionView(state) {
    if (!state.available) return { action: "Connect Google Drive", description: "Drive sync is unavailable. Your plan still saves on this device, and file backups remain available.", setup: false, toggle: !!state.remembered };
    if (state.expired) return { action: "Reconnect Google Drive", description: "Reconnect to resume syncing. Your local changes stay on this device until the connection is restored.", setup: true, toggle: false };
    if (state.otherAccount) return { action: "Set up this account", description: "This device’s plan belongs to another Google connection. Review it before using this account; nothing will upload automatically.", setup: true, toggle: false };
    if (state.ready) return { action: "", description: "When automatic sync is on, your plan stays current across connected devices.", setup: false, toggle: true };
    return { action: "Connect Google Drive", setup: true, toggle: false,
      description: state.legacy ? "Connect to sync your saved plan. Different existing plans are reviewed first." :
        "Connect to pick up your saved plan or sync this device. Different plans are reviewed first." };
  }
  function mount(options) {
    var meta = document.querySelector('meta[name="google-drive-sync-endpoint"]');
    var configured = meta && meta.getAttribute("content").trim();
    // Production-URL acceptance preview: ordinary visitors retain the released menu.
    var previewMode = location.origin === "https://amigoingbroke.me" && new URL(location.href).searchParams.get("drive-sync") === "preview";
    if (!configured && previewMode) configured = "/api/drive-sync.php";
    // Deliberately inert by default: no DOM changes, storage access, or requests.
    if (!configured || !root.DriveSync) return null;
    var endpoint;
    try {
      endpoint = new URL(configured, location.href);
      if (endpoint.origin !== location.origin || endpoint.username || endpoint.password || endpoint.hash) return null;
      if (endpoint.protocol !== "https:" && ["localhost", "127.0.0.1", "[::1]"].indexOf(endpoint.hostname) === -1) return null;
    } catch (error) { return null; }
    var controller = null, session = null, busy = false, lastCheck = 0, changingRemote = false;
    var sessionExpired = false;
    var sessionLoad = null, resumeTimer = null;
    var tabId;
    try {
      tabId = sessionStorage.getItem("aigb-sync-tab");
      if (!tabId) { tabId = crypto.randomUUID(); sessionStorage.setItem("aigb-sync-tab", tabId); }
    } catch (error) { return null; }
    var menu = document.querySelector(".data-menu");
    var entry = document.createElement("button");
    entry.type = "button"; entry.className = "data-menu-action"; entry.textContent = "Google Drive…";
    menu.querySelector(".data-menu-section").prepend(entry);
    var dataSummary = menu.querySelector("summary");
    var indicator = dataSummary.querySelector("span");
    var indicatorText = document.createElement("span");
    indicatorText.className = "sync-status-announcement";
    indicatorText.setAttribute("role", "status"); indicatorText.setAttribute("aria-live", "polite");
    indicatorText.setAttribute("aria-atomic", "true"); menu.appendChild(indicatorText);
    function presentIndicator(status, text, visible) {
      var attention = ["offline", "reconnect", "conflict", "missing", "account", "remote", "retrying", "storage", "invalid", "unavailable", "service"].indexOf(status) !== -1;
      indicator.classList.toggle("sync-mark", visible);
      indicator.setAttribute("data-sync-state", !visible ? "none" : attention ? "attention" : status === "synced" ? "synced" : "waiting");
      indicator.textContent = !visible ? "⇅" : attention ? "!" : status === "synced" ? "✓" : "↻";
      dataSummary.setAttribute("aria-label", "Open data menu" + (visible ? ". Google Drive: " + text : ""));
      dataSummary.setAttribute("title", visible ? "Google Drive: " + text : "Data");
      var announcement = visible ? "Google Drive: " + text : "";
      if (indicatorText.textContent !== announcement) indicatorText.textContent = announcement;
    }
    var dialog = document.createElement("dialog");
    dialog.className = "sync-settings data-dialog";
    dialog.setAttribute("aria-labelledby", "sync-settings-title");
    dialog.innerHTML = '<div class="sync-settings-card">' +
      '<h2 id="sync-settings-title">Google Drive sync</h2>' +
      '<p id="sync-account">Choose your Google account during setup.</p>' +
      '<p id="sync-introduction"></p>' +
      '<label class="sync-switch"><span>Automatic sync</span><input id="sync-enabled" type="checkbox" role="switch" aria-describedby="sync-explanation"></label>' +
      '<p id="sync-explanation">Changes sync after a five-second pause. Your plan saves on this device immediately.</p>' +
      '<p id="sync-consent">Connecting turns on automatic sync. <a href="./privacy.html#automatic-sync">Privacy details</a></p>' +
      '<p id="sync-settings-status" role="status" aria-live="polite" aria-atomic="true"></p>' +
      '<p id="sync-last-saved" class="is-hidden"></p>' +
      '<section id="sync-conflict" class="is-hidden" aria-labelledby="sync-conflict-title">' +
      '<h3 id="sync-conflict-title">Choose the plan to keep using</h3><p>Both versions are preserved before your choice is applied. Other devices will receive the chosen plan.</p>' +
      '<p id="sync-local-preview"></p><p id="sync-remote-preview"></p>' +
      '<div class="sync-settings-actions"><button type="button" id="sync-use-local" class="button ghost">Use this device’s plan</button><button type="button" id="sync-use-remote" class="button ghost">Use Drive plan</button></div></section>' +
      '<div class="sync-settings-actions"><button type="button" id="sync-connect" class="button primary">Connect Google Drive</button><button type="button" id="sync-close" class="button ghost">Done</button></div>' +
      '<a id="sync-folder" class="sync-folder is-hidden" target="_blank" rel="noopener noreferrer">Am I Going Broke?</a>' +
      '<div id="sync-help-actions" class="sync-settings-actions is-hidden"><button type="button" id="sync-retry" class="button ghost is-hidden">Try again</button>' +
      '<button type="button" id="sync-recreate" class="button ghost is-hidden">Repair sync…</button></div>' +
      '<section id="sync-recovery" class="is-hidden" aria-labelledby="sync-recovery-title"><h3 id="sync-recovery-title">Recover a previous plan</h3><div id="sync-recovery-list" class="sync-settings-actions"></div></section>' +
      '<details id="sync-options"><summary>Connection settings</summary><div class="sync-settings-actions">' +
      '<button type="button" id="sync-show-recovery" class="button ghost is-hidden">Recover previous plan…</button>' +
      '<button type="button" id="sync-disconnect" class="button ghost is-hidden">Disconnect Google Drive</button></div>' +
      '<p>Sync runs while the app is open. Offline changes stay on this device until it reconnects. <a href="./privacy.html#automatic-sync">Privacy details</a></p></details></div>';
    document.body.appendChild(dialog);
    var toggle = dialog.querySelector("#sync-enabled");
    var accountText = dialog.querySelector("#sync-account");
    var connect = dialog.querySelector("#sync-connect");
    var disconnect = dialog.querySelector("#sync-disconnect");
    var folder = dialog.querySelector("#sync-folder");
    var statusText = dialog.querySelector("#sync-settings-status");
    var conflictPanel = dialog.querySelector("#sync-conflict");
    var trigger = entry;

    function read(key) { try { return localStorage.getItem(key); } catch (error) { return null; } }
    function save(key, value) { localStorage.setItem(key, value); }
    function rememberedEnabled() {
      var owner = read("aigb-sync-plan-owner");
      return !!owner && read("aigb-sync-enabled:" + owner) === "true";
    }
    function enabledKey() { return "aigb-sync-enabled:" + session.accountId; }
    function queuedStore() {
      // Per-tab outboxes preserve competing unsynced candidates instead of clobbering them.
      var key = "aigb-sync-queue:" + session.accountId + ":" + tabId;
      return {
        load: function () { var value = read(key); return value ? JSON.parse(value) : null; },
        save: function (accountId, record) {
          if (accountId !== session.accountId) throw new Error("Account mismatch");
          save(key, JSON.stringify(record));
        },
      };
    }
    function preview(label, plan) {
      if (!plan) return label + ": no saved plan";
      var amount = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(plan.startingBalance);
      var asOf = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(plan.lastRefreshDate + "T12:00:00"));
      return label + ": " + amount + " · " + plan.recurringRules.length + (plan.recurringRules.length === 1 ? " payment" : " payments") + " · Cash as of " + asOf;
    }
    function presentConnection() {
      var owner = read("aigb-sync-plan-owner");
      var authenticated = !!session && session.authenticated;
      var ready = authenticated && read("aigb-sync-service-backups") === session.accountId;
      var view = connectionView({ available: !session || session.available !== false, authenticated: authenticated,
        expired: sessionExpired, ready: ready, otherAccount: authenticated && owner && owner !== session.accountId,
        remembered: rememberedEnabled(),
        legacy: !!read("cash-flow-projector-drive-connected") || !!read("cash-flow-projector-last-drive-backup-at") });
      dialog.querySelector("#sync-introduction").textContent = view.description;
      toggle.closest("label").classList.toggle("is-hidden", !view.toggle);
      if (session && !session.available) toggle.checked = rememberedEnabled();
      var reviewing = !!controller && !!controller.snapshot().conflict;
      dialog.querySelector("#sync-introduction").classList.toggle("is-hidden", reviewing || view.toggle || !!session && !session.available);
      accountText.classList.toggle("is-hidden", !authenticated);
      dialog.querySelector("#sync-explanation").classList.toggle("is-hidden", !view.toggle || reviewing);
      dialog.querySelector("#sync-consent").classList.toggle("is-hidden", !view.setup || reviewing);
      if (reviewing) toggle.closest("label").classList.add("is-hidden");
      dialog.querySelector("#sync-close").classList.toggle("is-hidden", reviewing);
      connect.classList.toggle("is-hidden", !view.setup && !!session && session.available !== false);
      connect.textContent = view.action || "Connect Google Drive";
      if (session && !session.available) connect.classList.add("is-hidden");
      dialog.querySelector("#sync-options").classList.toggle("is-hidden", !authenticated && !localRecovery());
    }
    function localRecovery() {
      try {
        var owner = session && session.accountId || read("aigb-sync-plan-owner");
        var text = owner && read("aigb-sync-before-replace:" + owner) || read("aigb-drive-before-load");
        var candidate = text && JSON.parse(text);
        return candidate && root.DriveSync.validPlan(candidate.plan) ? candidate : null;
      } catch (error) { return null; }
    }
    function showRecoveryAction() {
      var candidate = controller && controller.recovery();
      dialog.querySelector("#sync-show-recovery").classList.toggle("is-hidden", !candidate && !localRecovery());
    }
    function showStatus(value) {
      var text = LABELS[value.status] || "Sync needs attention";
      if (value.status === "off" && (!session || read("aigb-sync-service-backups") !== session.accountId)) text = "Connect to start syncing";
      if (value.status === "missing") text += ". Your plan is still on this device. Check the folder or reconnect.";
      presentIndicator(value.status, text, !!value.enabled || value.status === "unavailable");
      if (statusText.textContent !== text) statusText.textContent = text;
      statusText.classList.toggle("is-hidden", !!value.conflict);
      var lastSaved = dialog.querySelector("#sync-last-saved");
      lastSaved.classList.toggle("is-hidden", !value.savedAt || Number.isNaN(Date.parse(value.savedAt)));
      if (value.savedAt && !Number.isNaN(Date.parse(value.savedAt))) {
        lastSaved.textContent = "Last synced: " + new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value.savedAt));
      }
      toggle.checked = value.enabled === true;
      conflictPanel.classList.toggle("is-hidden", !value.conflict);
      if (value.conflict) {
        dialog.querySelector("#sync-recovery").classList.add("is-hidden");
        dialog.querySelector("#sync-local-preview").textContent = preview("This device", value.conflict.local);
        var remoteDate = value.conflict.remote.savedAt;
        var savedLabel = remoteDate && !Number.isNaN(Date.parse(remoteDate)) ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(remoteDate)) : "date unavailable";
        dialog.querySelector("#sync-remote-preview").textContent = preview("Drive · saved " + savedLabel, value.conflict.remote.plan);
      }
      if (value.status === "reconnect") sessionExpired = true;
      if (value.status === "synced") sessionExpired = false;
      showRecoveryAction();
      dialog.querySelector("#sync-retry").classList.toggle("is-hidden", ["missing", "remote", "storage", "service"].indexOf(value.status) === -1);
      dialog.querySelector("#sync-recreate").classList.toggle("is-hidden", value.status !== "missing");
      dialog.querySelector("#sync-help-actions").classList.toggle("is-hidden", ["missing", "remote", "storage", "service"].indexOf(value.status) === -1);
      presentConnection();
    }
    function setBusy(value) {
      busy = value;
      [toggle, connect, disconnect, dialog.querySelector("#sync-use-local"), dialog.querySelector("#sync-use-remote"), dialog.querySelector("#sync-retry"), dialog.querySelector("#sync-recreate")].forEach(function (control) {
        var unavailable = session && session.available === false;
        control.disabled = value || (!!unavailable && (control === connect || control === disconnect || (control === toggle && !rememberedEnabled())));
      });
      dialog.setAttribute("aria-busy", String(value));
    }
    async function request(action, body) {
      var url = new URL(endpoint); url.searchParams.set("action", action);
      var headers = { Accept: "application/json" };
      if (body !== undefined) { headers["Content-Type"] = "application/json"; headers["X-Sync-CSRF"] = session && session.csrf || ""; }
      var abort = new AbortController();
      var timeout = setTimeout(function () { abort.abort(); }, 35000);
      try {
        var response = await fetch(url.href, { method: body === undefined ? "GET" : "POST", credentials: "same-origin", cache: "no-store",
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
    function open(event) {
      trigger = event && event.currentTarget || entry;
      menu.removeAttribute("open");
      if (!dialog.open) dialog.showModal();
    }
    entry.addEventListener("click", open);
    dialog.querySelector("#sync-close").addEventListener("click", function () { dialog.close(); });
    dialog.addEventListener("close", function () {
      if (dialog.open || document.querySelector(".data-dialog[open]")) return;
      if (trigger === entry) { menu.open = true; entry.focus(); } else dataSummary.focus();
    });
    function enginePlan() {
      var data = options.getPlan();
      if (options.hasInvalidDraft && options.hasInvalidDraft()) {
        return Object.assign({}, data, { startingBalance: NaN });
      }
      return data;
    }
    async function attach() {
      if (controller) controller.destroy();
      controller = null;
      if (!session.authenticated) return;
      var previousOwner = read("aigb-sync-plan-owner");
      if (previousOwner && previousOwner !== session.accountId) {
        if (!dialog.open) dialog.showModal();
        statusText.textContent = "This device’s plan was linked to a different Google account. It will not be uploaded automatically.";
        toggle.checked = false;
        sessionExpired = false;
        return;
      }
      controller = root.DriveSync.create({ accountId: session.accountId, storage: queuedStore(),
        operationId: function () { return crypto.randomUUID(); },
        transport: { read: function () { return request("plan"); }, write: function (body) { return request("plan", body); } },
        onStatus: showStatus,
        onRemote: function (plan) {
          changingRemote = true;
          try { options.applyPlan(plan); } finally { changingRemote = false; }
        },
      });
      controller.setPlan(enginePlan());
      controller.setOnline(navigator.onLine);
      controller.authorize(session.accountId);
      sessionExpired = false;
      // Session authentication alone never enables auto sync.
      var enabled = read(enabledKey()) === "true";
      if (enabled && session.folderUrl && read("aigb-sync-service-backups") === session.accountId) controller.enable(true);
      else if (controller.snapshot().enabled) controller.enable(false);
    }
    function refreshSession() {
      if (!sessionLoad) sessionLoad = loadSession().finally(function () { sessionLoad = null; });
      return sessionLoad;
    }
    async function loadSession() {
      session = await request("status");
      if (!session.available) {
        toggle.disabled = !rememberedEnabled(); connect.disabled = true;
        if (rememberedEnabled()) showStatus({ status: "service", enabled: true });
        else { presentIndicator("off", "", false); statusText.textContent = LABELS.unavailable; }
        showRecoveryAction(); presentConnection(); return;
      }
      if (!busy) { toggle.disabled = false; connect.disabled = false; }
      accountText.textContent = session.authenticated ? "Connected account: " + session.email : "Choose your Google account to sync your plan.";
      sessionExpired = false;
      disconnect.classList.toggle("is-hidden", !session.authenticated);
      showRecoveryAction();
      if (session.authenticated && session.folderUrl && /^https:\/\/drive\.google\.com\/drive\/folders\/[A-Za-z0-9_-]+$/.test(session.folderUrl)) {
        folder.href = session.folderUrl; folder.classList.remove("is-hidden");
      } else folder.classList.add("is-hidden");
      connect.classList.toggle("is-hidden", session.authenticated);
      await attach();
      presentConnection();
    }
    async function authorize() {
      if (busy) return;
      if (options.getPlan().sampleScenario) { statusText.textContent = LABELS.sample; toggle.checked = false; return; }
      if (options.hasInvalidDraft && options.hasInvalidDraft()) { statusText.textContent = LABELS.invalid; toggle.checked = false; return; }
      setBusy(true);
      try {
        await refreshSession();
        if (!session.available) return;
        save("aigb-sync-setup-pending", String(Date.now()));
        var result = await request("authorize", { disclosureAccepted: true, preview: previewMode });
        var url = new URL(result.url);
        if (url.origin !== "https://accounts.google.com" || url.pathname !== "/o/oauth2/v2/auth") throw new Error("Unexpected authorization destination");
        location.assign(url.href);
      } catch (error) { statusText.textContent = "Could not connect. Your plan remains on this device. Try again."; }
      finally { setBusy(false); }
    }
    async function enableSync() {
      if (!session || !session.authenticated || sessionExpired) return authorize();
      if (options.getPlan().sampleScenario) { statusText.textContent = LABELS.sample; toggle.checked = false; return; }
      if (options.hasInvalidDraft && options.hasInvalidDraft()) { statusText.textContent = LABELS.invalid; toggle.checked = false; return; }
      var owner = read("aigb-sync-plan-owner");
      if (owner && owner !== session.accountId && (Number(options.getPlan().startingBalance) !== 0 || options.getPlan().recurringRules.length)) {
        var accepted = await options.confirm({ title: "Use this plan with another account?", action: "Use this plan", message:
          "This device’s plan was linked to another Google account. Continuing will use it with " + session.email + ". Any different Drive plan will be reviewed before replacement." });
        if (!accepted) { toggle.checked = false; return; }
      }
      setBusy(true);
      try {
        var setup = await request("setup", {});
        if (setup.accountId !== session.accountId || !/^https:\/\/drive\.google\.com\/drive\/folders\/[A-Za-z0-9_-]+$/.test(setup.folderUrl)) throw new Error("Invalid setup response");
        save("aigb-sync-plan-owner", session.accountId); save(enabledKey(), "true");
        save("aigb-sync-service-backups", session.accountId);
        localStorage.removeItem("aigb-sync-setup-pending");
        session.folderUrl = setup.folderUrl;
        await attach();
        folder.href = setup.folderUrl; folder.classList.remove("is-hidden");
        controller.enable(true);
      } catch (error) {
        try { save(enabledKey(), "false"); } catch (storageError) { /* Keep the local plan even if preferences cannot be saved. */ }
        if (controller) controller.enable(false);
        toggle.checked = false;
        if (error.code === "auth") sessionExpired = true;
        statusText.textContent = error.code === "auth" ? "Reconnect Google Drive to finish setup. Your plan is unchanged." : "Setup is unfinished. Your plan remains on this device. Try again when connected.";
        presentConnection();
      } finally { setBusy(false); }
    }
    connect.addEventListener("click", function () { enableSync(); });
    toggle.addEventListener("change", function () {
      if (toggle.checked) enableSync();
      else if (controller) {
        controller.enable(false);
        try { save(enabledKey(), "false"); } catch (error) { statusText.textContent = LABELS.storage; }
      } else {
        var owner = read("aigb-sync-plan-owner");
        try { if (owner) save("aigb-sync-enabled:" + owner, "false"); showStatus({ status: "off", enabled: false }); }
        catch (error) { statusText.textContent = LABELS.storage; }
      }
      presentConnection();
    });
    ["local", "remote"].forEach(function (choice) {
      dialog.querySelector("#sync-use-" + choice).addEventListener("click", async function () {
        if (!controller || busy) return;
        setBusy(true);
        try { await controller.resolveConflict(choice); }
        finally { setBusy(false); }
      });
    });
    disconnect.addEventListener("click", async function () {
      if (busy) return;
      var proceed = await options.confirm({ title: "Disconnect Google Drive?", action: "Disconnect", message:
        "This removes the server’s saved Google connection and pauses sync on all devices for this account. Your device plan and Drive files stay intact." });
      if (!proceed) return;
      setBusy(true);
      try {
        if (controller) { controller.enable(false); controller.destroy(); controller = null; }
        save(enabledKey(), "false"); await request("disconnect", {});
        localStorage.removeItem("aigb-sync-service-backups");
        await refreshSession();
        showStatus({ status: "off", enabled: false });
      } catch (error) { statusText.textContent = "Could not confirm disconnection. Try again or remove access in your Google Account."; }
      finally { setBusy(false); }
    });
    dialog.querySelector("#sync-retry").addEventListener("click", async function () {
      if (busy) return; setBusy(true);
      try { if (controller) await controller.retry(); else await refreshSession(); }
      catch (error) { statusText.textContent = "Drive is still unavailable. Your local plan is unchanged."; }
      finally { setBusy(false); }
    });
    dialog.querySelector("#sync-recreate").addEventListener("click", async function () {
      if (!controller || busy || controller.snapshot().status !== "missing") return;
      var accepted = await options.confirm({ title: "Create a replacement sync destination?", action: "Create replacement", message:
        "This will use your current local plan with a new working file in " + session.email + "’s Drive, creating the app folder if needed. Existing backups are kept. Other devices may need to reconnect or review different versions." });
      if (!accepted) return; setBusy(true);
      try {
        var result = await request("recreate", { accountId: session.accountId, confirmed: true });
        if (result.accountId !== session.accountId || !/^https:\/\/drive\.google\.com\/drive\/folders\/[A-Za-z0-9_-]+$/.test(result.folderUrl)) throw new Error("Invalid destination");
        session.folderUrl = result.folderUrl; folder.href = result.folderUrl;
        await controller.recreateRemote();
      } catch (error) { statusText.textContent = "The destination could not be replaced safely. Check Drive again before trying to create a replacement."; }
      finally { setBusy(false); }
    });
    dialog.querySelector("#sync-show-recovery").addEventListener("click", async function () {
      if (busy) return;
      if (controller && controller.snapshot().conflict) { statusText.textContent = "Resolve the different current versions before choosing a recovery version."; return; }
      var versions = [];
      dialog.querySelector("#sync-options").open = false;
      setBusy(true);
      try {
        var candidates = controller && controller.recovery();
        if (candidates) {
          var recoveredAt = new Date(candidates.at).toISOString();
          if (root.DriveSync.validPlan(candidates.local)) versions.push({ plan: candidates.local, label: "This device before version review", at: recoveredAt });
          if (candidates.remote && root.DriveSync.validPlan(candidates.remote.plan)) versions.push({ plan: candidates.remote.plan, label: "Drive before version review", at: recoveredAt });
        }
        var local = localRecovery();
        if (local) versions.push({ plan: local.plan, label: "Previous device plan", at: local.at });
        if (controller && session && session.authenticated) {
          var result = await request("recovery");
          if (result.accountId !== session.accountId || !Array.isArray(result.versions)) throw new Error("Invalid recovery response");
          result.versions.slice(0, 3).forEach(function (version) {
            if (!root.DriveSync.validPlan(version.plan)) throw new Error("Invalid recovery version");
            versions.push({ plan: version.plan, label: "Previous synced plan", at: version.savedAt });
          });
        }
      } catch (error) { statusText.textContent = "Could not load Drive recovery history. Any available local recovery is shown below."; }
      finally { setBusy(false); }
      var list = dialog.querySelector("#sync-recovery-list"); list.replaceChildren();
      dialog.querySelector("#sync-recovery").classList.remove("is-hidden");
      if (!versions.length) { var empty = document.createElement("p"); empty.textContent = "There are no earlier plans to recover. You can still import a file backup from Data."; list.appendChild(empty); }
      versions.forEach(function (version) {
        var action = document.createElement("button"); action.type = "button"; action.className = "button ghost";
        var date = !Number.isNaN(Date.parse(version.at)) ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(version.at)) : "date unavailable";
        action.textContent = preview(version.label + " · " + date, version.plan);
        action.addEventListener("click", async function () {
          if (busy || controller && controller.snapshot().conflict) return;
          var accepted = await options.confirm({ title: "Restore this recovery version?", action: "Restore", message:
            preview("Selected plan", version.plan) + (controller && controller.snapshot().enabled ? " This replaces the synced plan on connected devices." : " This replaces this device’s plan. Automatic sync is off.") });
          if (!accepted) return;
          try {
            var account = session && session.accountId || read("aigb-sync-plan-owner");
            save(account ? "aigb-sync-before-replace:" + account : "aigb-drive-before-load", JSON.stringify({ accountId: account, plan: options.getPlan(), reason: "recovery restore", at: new Date().toISOString() }));
            changingRemote = true;
            try { options.applyPlan(version.plan); } finally { changingRemote = false; }
            if (controller) controller.setPlan(enginePlan());
            else statusText.textContent = "Previous plan loaded on this device. Drive files are unchanged.";
            dialog.querySelector("#sync-recovery").classList.add("is-hidden");
          } catch (error) { statusText.textContent = "Recovery could not be completed safely. Check browser storage and try again."; }
        });
        list.appendChild(action);
      });
    });
    function changed() {
      if (!controller || changingRemote || !controller.snapshot().enabled) return;
      try { controller.setPlan(enginePlan()); }
      catch (error) { showStatus({ status: "storage", enabled: controller.snapshot().enabled }); }
    }
    window.addEventListener("aigb:plan-saved", changed);
    document.addEventListener("input", function (event) {
      if (controller && event.target.matches("#starting-balance, [data-field]")) controller.setEditing(true);
    });
    document.addEventListener("change", function (event) {
      if (controller && event.target.matches("#starting-balance, [data-field]")) {
        changed(); controller.setEditing(false);
      }
    });
    document.addEventListener("submit", function (event) {
      if (controller && event.target.matches("#starting-balance-form")) { changed(); controller.setEditing(false); }
    });
    document.addEventListener("focusout", function (event) {
      if (controller && event.target.matches("#starting-balance, [data-field]")) { changed(); controller.setEditing(false); }
    });
    window.addEventListener("online", function () { if (controller) controller.setOnline(true); else resume(); });
    window.addEventListener("offline", function () { if (controller) controller.setOnline(false); });
    function resume() {
      if (resumeTimer !== null) { clearTimeout(resumeTimer); resumeTimer = null; }
      if (document.visibilityState === "hidden") return;
      var remaining = 10000 - (Date.now() - lastCheck);
      // A quick device/tab return still gets a trailing check, never a dropped refresh.
      if (remaining > 0) { resumeTimer = setTimeout(resume, remaining); return; }
      lastCheck = Date.now();
      if (controller) controller.check();
      else if (rememberedEnabled()) refreshSession().catch(function () { showStatus({ status: "service", enabled: true }); });
    }
    window.addEventListener("focus", resume); window.addEventListener("pageshow", resume);
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("storage", function (event) {
      if (event.key === "cash-flow-projector-state") resume();
      if (session && event.key === enabledKey() && event.newValue === "false" && controller) controller.enable(false);
      if (event.key === "aigb-sync-plan-owner" && session && event.newValue !== session.accountId && controller) {
        controller.enable(false); controller.destroy(); controller = null;
        showStatus({ status: "account", enabled: false });
      }
    });
    presentConnection();
    refreshSession().then(async function () {
      var params = new URLSearchParams(location.search);
      var outcome = params.get("sync");
      if (outcome) { params.delete("sync"); history.replaceState(null, "", location.pathname + (params.size ? "?" + params : "") + location.hash); }
      var pending = Number(read("aigb-sync-setup-pending"));
      if (outcome === "connected" && session.available && session.authenticated && pending && Date.now() - pending < 600000) {
        open(); await enableSync();
      } else if (outcome === "cancelled" || outcome === "failed") {
        open(); statusText.textContent = "Setup was not completed. Your plan remains on this device.";
      }
    }).catch(function () {
      statusText.textContent = "Could not reach Drive sync. Your plan still saves on this device. Try connecting again when online.";
      if (rememberedEnabled()) showStatus({ status: "service", enabled: true });
    });
    return {
      changed: changed,
      enabled: function () { return !!controller && controller.snapshot().enabled; },
      connected: function () { return !!controller && !!session && session.authenticated && !!session.folderUrl && !sessionExpired; },
      beforeReplace: async function (kind) {
        if (!controller || !controller.snapshot().enabled) return true;
        var accepted = await options.confirm({ title: kind === "reset" ? "Start over on connected devices?" : "Replace the synced plan?",
          action: "Continue", message: "This change will update the plan on your connected devices after syncing. Your previous plan is kept for recovery." });
        if (!accepted) return false;
        try {
          save("aigb-sync-before-replace:" + session.accountId, JSON.stringify({ accountId: session.accountId,
            plan: options.getPlan(), reason: kind, at: new Date().toISOString() }));
          return true;
        } catch (error) { statusText.textContent = "Could not preserve your current plan. Free browser storage or download a backup before replacing it."; return false; }
      },
    };
  }
  root.DriveSyncUI = { mount: mount, connectionView: connectionView };
})(typeof globalThis !== "undefined" ? globalThis : this);
