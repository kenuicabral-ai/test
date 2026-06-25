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

function missionTrackerOnEdit(e) {
  MT.Main.onEdit(e);
}

function onOpen(e) {
  MT.Main.onOpen(e);
}

function onEdit(e) {
  MT.Main.onSimpleEdit(e);
}

MT.Main = (function () {
  function setup() {
    MT.Config.setup();
    ensureInstallableTriggers();
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

  function onSimpleEdit(e) {
    if (hasInstallableOnEdit()) return;
    onEdit(e);
  }

  function ensureVisibleScreens() {
    MT.VISIBLE_SHEETS.forEach(function (name) {
      MT.Utils.showSheet(name);
    });
    MT.HIDDEN_SHEETS.forEach(function (name) {
      MT.Utils.hideSheet(name);
    });
  }

  function ensureInstallableTriggers() {
    var triggers = ScriptApp.getProjectTriggers();
    var exists = triggers.some(function (trigger) {
      return trigger.getHandlerFunction() === 'missionTrackerOnEdit' &&
        trigger.getEventType() === ScriptApp.EventType.ON_EDIT;
    });
    if (!exists) {
      ScriptApp.newTrigger('missionTrackerOnEdit')
        .forSpreadsheet(MT.Utils.ss())
        .onEdit()
        .create();
    }
    PropertiesService.getDocumentProperties().setProperty(MT.SYSTEM_KEYS.INSTALLABLE_ON_EDIT, 'true');
  }

  function hasInstallableOnEdit() {
    try {
      return PropertiesService.getDocumentProperties().getProperty(MT.SYSTEM_KEYS.INSTALLABLE_ON_EDIT) === 'true';
    } catch (error) {
      return false;
    }
  }

  return {
    setup: setup,
    refresh: refresh,
    onOpen: onOpen,
    onEdit: onEdit,
    onSimpleEdit: onSimpleEdit
  };
})();
