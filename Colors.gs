/**
 * Mission Tracker - Regras de status por cor.
 */
var MTColors = (function () {
  function evaluateStatus(researcher, referenceDate) {
    var now = referenceDate || MTUtils.now();
    var result = MTUtils.normalizeText(researcher.resultado).toLowerCase();
    if (result === 'batizado') {
      return build_(MT.STATUS.BLUE);
    }

    if (hasFallenDate_(researcher, now)) {
      return build_(MT.STATUS.GRAY);
    }

    if (isStaleUpdate_(researcher, now)) {
      return build_(MT.STATUS.ORANGE);
    }

    var pending = getPendingByWeek_(researcher);
    if (pending.critical) {
      return build_(MT.STATUS.RED, pending.message);
    }

    if (pending.warning) {
      return build_(MT.STATUS.YELLOW, pending.message);
    }

    return build_(MT.STATUS.GREEN);
  }

  function getPendingByWeek_(researcher) {
    var week = Number(researcher.semana || 1);
    if (week <= 1) {
      if (!researcher.touchdown) {
        return { critical: true, warning: false, message: 'TouchDown pendente' };
      }
      if (!researcher.plano_igreja) {
        return { critical: false, warning: true, message: 'Plano Igreja pendente' };
      }
    } else if (week === 2) {
      if (!researcher.match) {
        return { critical: true, warning: false, message: 'Match pendente' };
      }
    } else if (week >= 3) {
      if (!researcher.entrevista) {
        return { critical: true, warning: false, message: 'Entrevista pendente' };
      }
    }

    if (!MTUtils.normalizeText(researcher.proximo_passo)) {
      return { critical: false, warning: true, message: 'Próximo passo pendente' };
    }

    return { critical: false, warning: false, message: '' };
  }

  function isStaleUpdate_(researcher, referenceDate) {
    var lastTs = Number(researcher.ultima_atualizacao_ts || 0);
    if (!lastTs) {
      return true;
    }
    var elapsedHours = (referenceDate.getTime() - lastTs) / (1000 * 60 * 60);
    return elapsedHours >= MT.BEHAVIOR.STALE_UPDATE_HOURS;
  }

  function hasFallenDate_(researcher, referenceDate) {
    var result = MTUtils.normalizeText(researcher.resultado).toLowerCase();
    if (result === 'data caiu') {
      return true;
    }
    var baptismDate = MTUtils.parseDate(researcher.data_batismal);
    if (!baptismDate) {
      return false;
    }
    return MTUtils.diffDays(baptismDate, referenceDate) > 0;
  }

  function build_(colorKey, customLabel) {
    var palette = MT.COLOR_MAP[colorKey] || MT.COLOR_MAP.green;
    return {
      colorKey: colorKey,
      label: customLabel || palette.label
    };
  }

  return {
    evaluateStatus: evaluateStatus
  };
})();
