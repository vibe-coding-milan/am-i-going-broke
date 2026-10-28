(function (root) {
  "use strict";
  var LABELS = {
    off: "Automatic sync off", local: "Saved on this device", pending: "Changes waiting to sync",
    checking: "Checking Drive…", saving: "Saving to Drive…", synced: "Saved to Drive",
    offline: "Saved on this device · Offline", reconnect: "Reconnect Drive to resume sync",
    conflict: "Different versions · Review sync", missing: "Drive file unavailable · Review sync",
    account: "Google account changed · Review sync", remote: "Drive file needs attention",
    retrying: "Saved on this device · Retrying Drive", storage: "Sync paused · Browser storage is full",
    sample: "Start your own plan to enable sync", invalid: "Finish the payment details to sync",
    editing: "Finish editing to sync", unavailable: "Automatic sync is not available yet",
    service: "Saved on this device · Sync unavailable",
  };
  // Presentation never grants permission: setup and engine reconciliation remain separate.
  function connectionView(state) {
    if (!state.available) return { action: "Connect Google Drive", description: "Drive sync is unavailable. Your plan still saves on this device, and file backups remain available.", setup: false, toggle: !!state.remembered };
    if (state.expired) return { action: "Reconnect Google Drive", description: "Reconnect to resume syncing. Your local changes stay on this device until the connection is restored.", setup: true, toggle: false };
    if (state.otherAccount) return { action: "Set up this account", description: "This device’s plan belongs to another Google connection. Review it before using this account; nothing will upload automatically.", setup: true, toggle: false };
    if (state.ready) return { action: "", description: "When automatic sync is on, your current plan stays in sync across connected devices. Turn it off to pause transfers on this device; your saved files stay intact.", setup: false, toggle: true };
    return { action: state.authenticated ? "Turn on sync" : "Connect Google Drive", setup: true, toggle: false,
      description: state.legacy ? "You’ve used Drive backups before. They stay available below. Connect to start automatic sync; an older backup is never imported automatically." :
        "Connect to keep your current plan in sync across devices. On a new device, connect the same Google account to pick up your plan. Different existing plans are reviewed before either is replaced." };
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
    entry.type = "button"; entry.className = "data-menu-action"; entry.textContent = "Google Drive sync…";
    menu.querySelector(".data-menu-section").prepend(entry);
    var indicator = document.createElement("button");
    indicator.type = "button"; indicator.className = "sync-indicator is-hidden";
    indicator.setAttribute("aria-label", "Drive sync settings");
    var indicatorText = document.createElement("span");
    indicatorText.setAttribute("role", "status"); indicatorText.setAttribute("aria-live", "polite");
    indicatorText.setAttribute("aria-atomic", "true"); indicator.appendChild(indicatorText);
    document.querySelector(".topbar-utilities").appendChild(indicator);
    var utilities = document.querySelector(".topbar-utilities");
    var topbar = utilities.closest(".app-topbar");
    var compact = window.matchMedia("(max-width: 860px)");
    function placeIndicator() {
      var focused = document.activeElement === indicator;
      if (compact.matches && indicator.parentElement === utilities) topbar.after(indicator);
      else if (!compact.matches && indicator.parentElement !== utilities) utilities.appendChild(indicator);
      if (focused) indicator.focus({ preventScroll: true });
    }
    placeIndicator();
    if (compact.addEventListener) compact.addEventListener("change", placeIndicator);
    else compact.addListener(placeIndicator);
    var dialog = document.createElement("dialog");
    dialog.className = "sync-settings data-dialog";
    dialog.setAttribute("aria-labelledby", "sync-settings-title");
    dialog.innerHTML = '<div class="sync-settings-card">' +
      '<h2 id="sync-settings-title">Google Drive sync</h2>' +
      '<p id="sync-account">Choose your Google account during setup.</p>' +
      '<p id="sync-introduction"></p>' +
      '<label class="sync-switch"><span>Automatic Drive sync</span><input id="sync-enabled" type="checkbox" role="switch" aria-describedby="sync-explanation"></label>' +
      '<p id="sync-explanation">Your plan saves on this device immediately. When sync is on, completed changes update one Drive file after you pause for five seconds. Sample plans are never uploaded.</p>' +
      '<p id="sync-consent">Connecting turns on automatic sync and lets our secure server store an encrypted Google connection and transfer your plan. <a href="./privacy.html#automatic-sync">Privacy details</a></p>' +
      '<details id="sync-disclosure"><summary>How sync handles your data</summary><p>Sync checks Drive when you open or return to this page. It runs while the page is open; wait for Saved to Drive before switching devices. Offline or pending changes stay on this device until it reconnects. If devices have different unsynced edits, both versions are preserved for review.</p><p>Setup connects Google through our secure server. It stores an encrypted Google connection and handles your plan during transfers. Three previous versions stay inside the Drive file for recovery. Turning sync off keeps your local plan and Drive files.</p>' +
      '<p><a href="./privacy.html#automatic-sync">Read about automatic sync and privacy</a></p></details>' +
      '<p id="sync-settings-status" role="status" aria-live="polite" aria-atomic="true"></p>' +
      '<p id="sync-last-saved" class="is-hidden"></p>' +
      '<section id="sync-conflict" class="is-hidden" aria-labelledby="sync-conflict-title">' +
      '<h3 id="sync-conflict-title">Choose the plan to keep using</h3><p>Both versions are preserved before your choice is applied. Other devices will receive the chosen plan.</p>' +
      '<p id="sync-local-preview"></p><p id="sync-remote-preview"></p>' +
      '<div class="sync-settings-actions"><button type="button" id="sync-use-local" class="button ghost">Use this device’s plan</button><button type="button" id="sync-use-remote" class="button ghost">Use Drive plan</button></div></section>' +
      '<section id="sync-recovery" class="is-hidden" aria-labelledby="sync-recovery-title"><h3 id="sync-recovery-title">Recovery versions</h3><div id="sync-recovery-list" class="sync-settings-actions"></div></section>' +
      '<details id="sync-manual-backups"><summary>Manual Drive backups</summary><p>Save a separate snapshot, or import an older backup. These are separate from your automatically synced current plan.</p><div id="sync-manual-actions" class="sync-settings-actions"></div><p id="sync-manual-status" role="status" aria-live="polite"></p></details>' +
      '<div class="sync-settings-actions"><button type="button" id="sync-connect" class="button primary">Connect Google Drive</button>' +
      '<a id="sync-folder" class="button ghost is-hidden" target="_blank" rel="noopener noreferrer">Open Drive folder</a>' +
      '<button type="button" id="sync-retry" class="button ghost is-hidden">Check Drive again</button>' +
      '<button type="button" id="sync-recreate" class="button ghost is-hidden">Create replacement sync file…</button>' +
      '<button type="button" id="sync-show-recovery" class="button ghost is-hidden">Recovery versions…</button>' +
      '<button type="button" id="sync-disconnect" class="button ghost is-hidden">Disconnect all devices</button>' +
      '<button type="button" id="sync-close" class="button ghost">Done</button></div></div>';
    document.body.appendChild(dialog);
    // Move the original controls, preserving their existing listeners and backup behavior.
    ["save-drive", "restore-drive", "drive-backup-status"].forEach(function (id) {
      var control = document.getElementById(id);
      if (id !== "drive-backup-status") control.className = "button ghost";
      dialog.querySelector("#sync-manual-actions").appendChild(control);
    });
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
      return label + ": " + amount + "; " + plan.recurringRules.length + " payments; cash as of " + plan.lastRefreshDate + ".";
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
      dialog.querySelector("#sync-consent").classList.toggle("is-hidden", !view.setup);
      connect.classList.toggle("is-hidden", !view.setup && !!session && session.available !== false);
      connect.textContent = view.action || "Connect Google Drive";
      if (session && !session.available) connect.classList.add("is-hidden");
    }
    function showStatus(value) {
      var text = LABELS[value.status] || "Sync needs attention";
      if (value.status === "missing") text += ". Your plan is still on this device. Check the folder or reconnect.";
      if (indicatorText.textContent !== text) indicatorText.textContent = text;
      if (statusText.textContent !== text) statusText.textContent = text;
      var lastSaved = dialog.querySelector("#sync-last-saved");
      lastSaved.classList.toggle("is-hidden", !value.savedAt || Number.isNaN(Date.parse(value.savedAt)));
      if (value.savedAt && !Number.isNaN(Date.parse(value.savedAt))) {
        lastSaved.textContent = "Last synced: " + new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value.savedAt));
      }
      indicator.classList.toggle("is-hidden", !value.enabled && value.status !== "unavailable");
      toggle.checked = value.enabled === true;
      conflictPanel.classList.toggle("is-hidden", !value.conflict);
      if (value.conflict) {
        dialog.querySelector("#sync-recovery").classList.add("is-hidden");
        dialog.querySelector("#sync-local-preview").textContent = preview("This device", value.conflict.local);
        dialog.querySelector("#sync-remote-preview").textContent = preview("Drive", value.conflict.remote.plan);
      }
      if (value.status === "reconnect") sessionExpired = true;
      if (value.status === "synced") sessionExpired = false;
      dialog.querySelector("#sync-retry").classList.toggle("is-hidden", ["missing", "remote", "storage", "service"].indexOf(value.status) === -1);
      dialog.querySelector("#sync-recreate").classList.toggle("is-hidden", value.status !== "missing");
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
    entry.addEventListener("click", open); indicator.addEventListener("click", open);
    dialog.querySelector("#sync-close").addEventListener("click", function () { dialog.close(); });
    dialog.addEventListener("close", function () {
      if (dialog.open || document.querySelector(".data-dialog[open]")) return;
      if (trigger === entry) { menu.open = true; entry.focus(); } else indicator.focus();
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
        else { indicator.classList.add("is-hidden"); statusText.textContent = LABELS.unavailable; }
        presentConnection(); return;
      }
      if (!busy) { toggle.disabled = false; connect.disabled = false; }
      accountText.textContent = session.authenticated ? "Connected account: " + session.email : "Choose your Google account during setup.";
      sessionExpired = false;
      disconnect.classList.toggle("is-hidden", !session.authenticated);
      dialog.querySelector("#sync-show-recovery").classList.toggle("is-hidden", !session.authenticated);
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
      if (owner && owner !== session.accountId) {
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
        if (options.resetManualAuth) options.resetManualAuth();
        localStorage.removeItem("aigb-sync-setup-pending");
        session.folderUrl = setup.folderUrl;
        await attach();
        folder.href = setup.folderUrl; folder.classList.remove("is-hidden");
        controller.enable(true);
      } catch (error) {
        try { save(enabledKey(), "false"); } catch (storageError) { /* Keep the local plan even if preferences cannot be saved. */ }
        if (controller) controller.enable(false);
        toggle.checked = false;
        statusText.textContent = "Setup is unfinished. Your plan remains on this device. Try again when connected.";
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
        var proceed = await options.confirm({ title: choice === "local" ? "Use this device’s plan?" : "Use the Drive plan?",
          action: "Use this plan", message: "The chosen plan will become the synced version on your connected devices. Both candidates are kept in recovery before applying your choice." });
        if (!proceed) return;
        setBusy(true);
        try { await controller.resolveConflict(choice); }
        finally { setBusy(false); }
      });
    });
    disconnect.addEventListener("click", async function () {
      if (busy) return;
      var proceed = await options.confirm({ title: "Disconnect Google Drive?", action: "Disconnect", message:
        "This removes the server’s saved Google connection and pauses sync on all devices for this account. Your local plan, Drive files, and manual backups stay intact." });
      if (!proceed) return;
      setBusy(true);
      try {
        if (controller) { controller.enable(false); controller.destroy(); controller = null; }
        save(enabledKey(), "false"); await request("disconnect", {});
        localStorage.removeItem("aigb-sync-service-backups");
        if (options.resetManualAuth) options.resetManualAuth();
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
      if (!controller || busy) return;
      if (controller.snapshot().conflict) { statusText.textContent = "Resolve the different current versions before choosing a recovery version."; return; }
      var versions = [];
      setBusy(true);
      try {
        var candidates = controller.recovery();
        if (candidates) {
          var recoveredAt = new Date(candidates.at).toISOString();
          if (root.DriveSync.validPlan(candidates.local)) versions.push({ plan: candidates.local, label: "This device before version review", at: recoveredAt });
          if (candidates.remote && root.DriveSync.validPlan(candidates.remote.plan)) versions.push({ plan: candidates.remote.plan, label: "Drive before version review", at: recoveredAt });
        }
        var local = read("aigb-sync-before-replace:" + session.accountId);
        if (local) {
          local = JSON.parse(local);
          if (local.accountId === session.accountId && root.DriveSync.validPlan(local.plan)) versions.push({ plan: local.plan, label: "Before " + local.reason + " on this device", at: local.at });
        }
        var result = await request("recovery");
        if (result.accountId !== session.accountId || !Array.isArray(result.versions)) throw new Error("Invalid recovery response");
        result.versions.slice(0, 3).forEach(function (version) {
          if (!root.DriveSync.validPlan(version.plan)) throw new Error("Invalid recovery version");
          versions.push({ plan: version.plan, label: "Previous synced plan", at: version.savedAt });
        });
      } catch (error) { statusText.textContent = "Could not load Drive recovery history. Any available local recovery is shown below."; }
      finally { setBusy(false); }
      var list = dialog.querySelector("#sync-recovery-list"); list.replaceChildren();
      dialog.querySelector("#sync-recovery").classList.remove("is-hidden");
      if (!versions.length) { var empty = document.createElement("p"); empty.textContent = "No recovery versions are available yet. You can import a file from Data or open Manual Drive backups below."; list.appendChild(empty); }
      versions.forEach(function (version) {
        var action = document.createElement("button"); action.type = "button"; action.className = "button ghost";
        var date = !Number.isNaN(Date.parse(version.at)) ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(version.at)) : "date unavailable";
        action.textContent = preview(version.label + " · " + date, version.plan);
        action.addEventListener("click", async function () {
          if (busy || !controller || controller.snapshot().conflict) return;
          var accepted = await options.confirm({ title: "Restore this recovery version?", action: "Restore", message:
            preview("Selected plan", version.plan) + (controller.snapshot().enabled ? " This replaces the synced plan on connected devices." : " This replaces this device’s plan. Automatic sync is off.") });
          if (!accepted) return;
          try {
            save("aigb-sync-before-replace:" + session.accountId, JSON.stringify({ accountId: session.accountId, plan: options.getPlan(), reason: "recovery restore", at: new Date().toISOString() }));
            changingRemote = true;
            try { options.applyPlan(version.plan); } finally { changingRemote = false; }
            controller.setPlan(enginePlan());
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
      statusText.textContent = "Could not reach Drive sync. Local saving and manual backups still work. Try connecting again when online.";
      if (rememberedEnabled()) showStatus({ status: "service", enabled: true });
    });
    return {
      changed: changed,
      enabled: function () { return !!controller && controller.snapshot().enabled; },
      connected: function () { return !!controller && !!session && session.authenticated && !!session.folderUrl && !sessionExpired; },
      usesService: function () { return !!read("aigb-sync-service-backups"); },
      backup: async function () {
        if (!controller || !session || !session.authenticated || read("aigb-sync-service-backups") !== session.accountId) throw new Error("Reconnect the selected Google account before saving a Drive snapshot.");
        var result = await request("backup", { accountId: session.accountId, operationId: crypto.randomUUID(), plan: options.getPlan() });
        if (result.accountId !== session.accountId) throw new Error("Account mismatch");
        return result;
      },
      restore: async function () {
        if (!controller || !session || !session.authenticated || read("aigb-sync-service-backups") !== session.accountId) throw new Error("Reconnect the selected Google account before restoring a Drive snapshot.");
        var result = await request("backup");
        if (result.accountId !== session.accountId) throw new Error("Account mismatch");
        return result.backup;
      },
      beforeReplace: async function (kind) {
        if (!controller || !controller.snapshot().enabled) return true;
        var accepted = await options.confirm({ title: kind === "reset" ? "Start over on connected devices?" : "Replace the synced plan?",
          action: "Continue", message: "This change will update the plan on your connected devices after syncing. Drive manual backups stay intact. The previous synced versions remain in recovery." });
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
