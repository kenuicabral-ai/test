var MT = MT || {};

function setupMissionTracker() {
  MT.Main.setup();
}

function refreshMissionTracker() {
  MT.Main.refresh();
}

function queueMissionTrackerZoneDigest() {
  MT.Email.queueZoneDigest();
}

function sendMissionTrackerEmails() {
  MT.Email.sendPending();
}

function onOpen(e) {
  MT.Main.onOpen(e);
}

function onEdit(e) {
  MT.Main.onEdit(e);
}

MT.Main = (function () {
  function setup() {
    MT.Config.setup();
    MT.Dashboard.refreshAll();
    MT.Config.protectRegistration();
    MT.Navigation.activate(MT.SHEETS.HOME);
    MT.Utils.toast('Mission Tracker configurado.');
  }

  function refresh() {
    MT.Database.ensure();
    MT.Dashboard.refreshAll();
    MT.Config.protectRegistration();
    MT.Utils.toast('Mission Tracker atualizado.');
  }

  function onOpen() {
    try {
      MT.Database.ensure();
      ensureVisibleScreens();
      if (!MT.Utils.sheet(MT.SHEETS.HOME) || MT.Utils.sheet(MT.SHEETS.HOME).getLastRow() === 0) {
        setup();
      }
    } catch (error) {
      MT.Utils.log('ERROR', 'Main.onOpen', error.message, error.stack || '');
    }
  }

  function onEdit(e) {
    MT.Navigation.handleEdit(e);
  }

  function ensureVisibleScreens() {
    MT.VISIBLE_SHEETS.forEach(function (name) {
      MT.Utils.showSheet(name);
    });
    MT.HIDDEN_SHEETS.forEach(function (name) {
      MT.Utils.hideSheet(name);
    });
  }

  return {
    setup: setup,
    refresh: refresh,
    onOpen: onOpen,
    onEdit: onEdit
  };
})();
