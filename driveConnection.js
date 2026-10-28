(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./driveSync.js"));
  else root.DriveConnection = factory(root.DriveSync);
})(typeof globalThis !== "undefined" ? globalThis : this, function (Sync) {
  "use strict";
  function empty(plan) { return !plan.sampleScenario && Number(plan.startingBalance) === 0 && plan.recurringRules.length === 0; }
  function decide(local, remote) {
    if (!Sync.validPlan(local) || local.sampleScenario) return "review";
    if (!remote) return empty(local) ? "empty" : "local-only";
    if (!Sync.validPlan(remote.plan)) throw new Error("Invalid Drive plan");
    if (remote.plan.sampleScenario) return "review";
    if (empty(remote.plan)) return "empty-drive";
    if (Sync.fingerprint(local) === Sync.fingerprint(remote.plan)) return "same";
    return empty(local) ? "adopt" : "review";
  }
  function date(value) {
    return value && !Number.isNaN(Date.parse(value)) ? new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium", timeStyle: "short", timeZoneName: undefined,
    }).format(new Date(value)) : "Date unavailable";
  }
  function describe(plan) {
    var asOf = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(plan.lastRefreshDate + "T12:00:00"));
    return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(plan.startingBalance) +
      " · " + plan.recurringRules.length + (plan.recurringRules.length === 1 ? " payment" : " payments") + " · Cash as of " + asOf;
  }
  function mount(options) {
    var menu = document.querySelector(".data-menu"), remote = null, busy = false, checked = false, trigger;
    var entry = document.createElement("button");
    entry.type = "button"; entry.className = "data-menu-action"; entry.textContent = "Google Drive…";
    menu.querySelector(".data-menu-section").prepend(entry);
    var dialog = document.createElement("dialog");
    dialog.className = "drive-connection sync-settings data-dialog";
    dialog.setAttribute("aria-labelledby", "drive-connection-title");
    dialog.innerHTML = '<div class="sync-settings-card"><h2 id="drive-connection-title">Google Drive</h2>' +
      '<p id="drive-connection-mode" class="is-hidden">Automatic sync is off</p>' +
      '<p id="drive-connection-intro">Find your saved plan. Nothing uploads when you connect.</p>' +
      '<p id="drive-connection-status" role="status" aria-live="polite"></p>' +
      '<section id="drive-device-plan" aria-labelledby="drive-device-title"><h3 id="drive-device-title">This device</h3><p id="drive-device-summary"></p></section>' +
      '<section id="drive-saved-plan" class="is-hidden" aria-labelledby="drive-saved-title"><h3 id="drive-saved-title">On Google Drive</h3>' +
      '<p id="drive-saved-date"></p><p id="drive-saved-summary"></p></section>' +
      '<div id="drive-primary-actions" class="sync-settings-actions"><button type="button" id="drive-connect" class="button primary">Connect Google Drive</button>' +
      '<button type="button" id="drive-use-saved" class="button primary is-hidden">Use Drive plan</button>' +
      '<button type="button" id="drive-keep-local" class="button ghost is-hidden">Keep this device’s plan</button>' +
      '<button type="button" id="drive-done" class="button primary">Done</button></div>' +
      '<details id="drive-manual-copies" class="is-hidden"><summary>More options</summary>' +
      '<label class="field"><span>Saved copies</span><select id="drive-saved-copies" aria-label="Saved copies"></select></label>' +
      '<div id="drive-copy-actions" class="sync-settings-actions"><button type="button" id="drive-check" class="button ghost">Check Drive again</button><button type="button" id="drive-disconnect" class="button ghost">Disconnect this session</button></div>' +
      '<p id="drive-connection-note" role="status" aria-live="polite"></p><div id="drive-local-recovery"></div>' +
      '<p><a href="/?drive-sync=preview">Set up automatic sync</a></p></details></div>';
    document.body.appendChild(dialog);
    var save = document.querySelector("#save-drive"), restore = document.querySelector("#restore-drive");
    save.textContent = "Save a dated copy to Drive"; save.className = "button ghost";
    dialog.querySelector("#drive-copy-actions").appendChild(save);
    restore.classList.add("is-hidden");
    dialog.querySelector("#drive-copy-actions").appendChild(restore);
    dialog.querySelector("#drive-copy-actions").appendChild(document.querySelector("#drive-backup-status"));
    var status = dialog.querySelector("#drive-connection-status");
    var connect = dialog.querySelector("#drive-connect"), use = dialog.querySelector("#drive-use-saved");
    var keep = dialog.querySelector("#drive-keep-local"), select = dialog.querySelector("#drive-saved-copies");
    function update() {
      var local = options.getPlan();
      dialog.querySelector("#drive-device-summary").textContent = describe(local);
      connect.textContent = options.hasAccess() ? "Check Drive again" : "Connect Google Drive";
      dialog.querySelector("#drive-connection-mode").classList.toggle("is-hidden", !options.hasAccess());
      connect.classList.toggle("is-hidden", checked && options.hasAccess());
      dialog.querySelector("#drive-connection-intro").classList.toggle("is-hidden", checked);
      dialog.querySelector("#drive-manual-copies").classList.toggle("is-hidden", !options.hasAccess());
      dialog.querySelector("#drive-disconnect").classList.toggle("is-hidden", !options.hasAccess());
      dialog.querySelector("#drive-saved-plan").classList.toggle("is-hidden", !remote);
      if (remote) {
        dialog.querySelector("#drive-saved-date").textContent = "Saved to Drive: " + date(remote.savedAt);
        dialog.querySelector("#drive-saved-summary").textContent = describe(remote.plan);
      }
      var different = remote && Sync.fingerprint(local) !== Sync.fingerprint(remote.plan);
      var review = different && !empty(remote.plan);
      dialog.querySelector("#drive-device-plan").classList.toggle("is-hidden", !review);
      use.classList.toggle("is-hidden", !review);
      keep.classList.toggle("is-hidden", !review);
      dialog.querySelector("#drive-done").classList.toggle("is-hidden", !!review);
      var firstSave = checked && !remote && !empty(local) && !local.sampleScenario && Sync.validPlan(local);
      var primary = dialog.querySelector("#drive-primary-actions"), done = dialog.querySelector("#drive-done");
      var copyActions = dialog.querySelector("#drive-copy-actions");
      if (firstSave && save.parentElement !== primary) primary.insertBefore(save, done);
      else if (!firstSave && save.parentElement !== copyActions) copyActions.appendChild(save);
      save.textContent = firstSave ? "Save plan to Drive" : "Save a dated copy to Drive";
      save.classList.toggle("primary", firstSave); save.classList.toggle("ghost", !firstSave);
      done.classList.toggle("primary", !firstSave); done.classList.toggle("ghost", firstSave);
      dialog.classList.toggle("is-settled", checked && !review && !firstSave);
      select.closest("label").classList.toggle("is-hidden", !remote || !remote.copies || remote.copies.length < 2);
      save.disabled = busy || empty(local) || !!local.sampleScenario || !Sync.validPlan(local) || options.hasDraft();
    }
    function setBusy(value) {
      busy = value;
      [connect, use, keep, select, dialog.querySelector("#drive-check"), dialog.querySelector("#drive-disconnect")].forEach(function (control) { control.disabled = value; });
      dialog.setAttribute("aria-busy", String(value)); update();
    }
    function recovery() {
      var target = dialog.querySelector("#drive-local-recovery"); target.replaceChildren();
      var item = options.recovery();
      if (!item || !Sync.validPlan(item.plan) || empty(item.plan)) return;
      var action = document.createElement("button"); action.type = "button"; action.className = "button ghost";
      action.textContent = "Recover this device’s previous plan · " + date(item.at);
      action.addEventListener("click", async function () {
        if (busy) return;
        var accepted = await options.confirm({ title: "Recover this device’s plan?", action: "Use previous plan", message: describe(item.plan) + ". This replaces only this device’s plan. Drive files stay unchanged." });
        if (!accepted) return;
        try { options.preserve(); options.apply(item.plan); status.textContent = "Previous plan recovered on this device. Drive is unchanged."; update(); recovery(); }
        catch (error) { status.textContent = "Couldn't keep a recovery copy. Download a backup before replacing this plan."; }
      });
      target.appendChild(action);
    }
    async function check(id, adoptEmpty) {
      if (busy) return; setBusy(true); status.textContent = "Checking Drive…";
      try {
        var found = await options.read(id);
        checked = true;
        remote = found.plan ? found : null;
        select.replaceChildren();
        (found.copies || []).forEach(function (copy) {
          var choice = document.createElement("option"); choice.value = copy.id;
          choice.textContent = (copy.kind === "current" ? "Current plan" : "Saved copy") + " · " + date(copy.modifiedTime);
          choice.selected = !!remote && copy.id === remote.id; select.appendChild(choice);
        });
        var decision = decide(options.getPlan(), remote);
        if (decision === "adopt" && adoptEmpty && !options.hasDraft()) {
          options.preserve(); options.apply(remote.plan);
          status.textContent = "Your Drive plan is ready on this device. Nothing was uploaded.";
        } else status.textContent = ({ same: "This device matches the Drive plan. Nothing was uploaded.",
          review: "Which plan do you want on this device? The other plan stays available.", adopt: "Use this saved plan on this device?",
          empty: "No saved Drive plan found. Start your plan here; you can save a copy later.",
          "local-only": "No saved Drive plan found. Your plan is still on this device.",
          "empty-drive": "This Drive copy is empty. Your device’s plan is unchanged." })[decision];
      } catch (error) { remote = null; checked = false; status.textContent = options.errorCopy(error, "restore").message; }
      finally { setBusy(false); recovery(); }
    }
    async function open() {
      trigger = document.activeElement;
      menu.removeAttribute("open"); update(); recovery();
      if (!dialog.open) dialog.showModal();
      if (options.hasAccess()) await check(null, true);
    }
    entry.addEventListener("click", open);
    connect.addEventListener("click", function () { check(null, true); });
    dialog.querySelector("#drive-check").addEventListener("click", function () { check(null, false); });
    select.addEventListener("change", function () { dialog.querySelector("#drive-manual-copies").open = false; check(select.value, false); });
    keep.addEventListener("click", function () { dialog.close(); });
    use.addEventListener("click", async function () {
      if (!remote || busy) return;
      var chosen = remote, localKey = Sync.fingerprint(options.getPlan());
      setBusy(true);
      try {
        var latest = await options.read(chosen.id);
        if (!latest.plan || Sync.fingerprint(latest.plan) !== Sync.fingerprint(chosen.plan) || Sync.fingerprint(options.getPlan()) !== localKey) {
          remote = latest.plan ? latest : null;
          status.textContent = "A plan changed. Review the updated details before choosing."; return;
        }
        options.preserve(); options.apply(chosen.plan); status.textContent = "Drive plan loaded on this device. No Drive file was changed.";
      } catch (error) { status.textContent = "Couldn't load that plan safely. Your current plan is unchanged. Check Drive again."; }
      finally { setBusy(false); recovery(); }
    });
    dialog.querySelector("#drive-disconnect").addEventListener("click", function () {
      if (busy) return; options.disconnect(); remote = null; checked = false; update(); status.textContent = "Disconnected. Your device plan and Drive files are unchanged.";
    });
    dialog.querySelector("#drive-done").addEventListener("click", function () { dialog.close(); });
    dialog.addEventListener("close", function () {
      if (dialog.open || document.querySelector(".data-dialog[open]")) return;
      menu.open = true; (trigger && menu.contains(trigger) ? trigger : entry).focus();
    });
    return { open: open, refresh: function () { return check(null, false); }, changed: function () { if (!busy) update(); } };
  }
  return { mount: mount, decide: decide, empty: empty, describe: describe, date: date };
});
