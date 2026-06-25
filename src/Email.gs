/**
 * Email.gs
 * ---------------------------------------------------------------------------
 * Resumo diário opcional para LD e LZ. Não há telas para isso: é disparado
 * por um gatilho de tempo (diário) e registrado na aba Emails (oculta).
 *
 * O envio só ocorre se `enviarDigestDiario` estiver ligado na Configuração e
 * houver destinatário. Tolerante a falhas: registra erro em Logs/Emails.
 * ---------------------------------------------------------------------------
 */

/** Garante estrutura da aba Emails. */
function ensureEmailsStructure_() {
  const sh = getSheet_(HIDDEN_SHEETS.EMAILS);
  const firstRow = sh.getRange(1, 1, 1, EMAILS_HEADERS.length).getValues()[0];
  if (firstRow.join('') !== EMAILS_HEADERS.join('')) {
    sh.getRange(1, 1, 1, EMAILS_HEADERS.length).setValues([EMAILS_HEADERS])
      .setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

/** Registra um envio (ou tentativa) na aba Emails. */
function logEmail_(to, subject, status, resumo) {
  try {
    const sh = ensureEmailsStructure_();
    sh.appendRow([new Date(), to, subject, status, resumo]);
  } catch (e) {
    logEvent_('WARN', 'email-log', e.message);
  }
}

/**
 * Envia o resumo diário (chamado pelo gatilho de tempo).
 * Gera HTML simples por distrito.
 */
function sendDailyDigest_() {
  const cfg = getConfig_();
  if (!cfg.enviarDigestDiario) {
    logEvent_('INFO', 'digest', 'Resumo diário desativado na configuração.');
    return;
  }

  const records = recomputeRecords_(readAllRecords_(), cfg, new Date());
  const counts = countByStatus_(records);

  const subject = '[' + APP.NAME + '] Resumo de hoje • ' + cfg.distrito;
  const html = buildDigestHtml_(records, counts, cfg);

  const recipients = [];
  if (cfg.emailLD) recipients.push(cfg.emailLD);
  if (cfg.emailLZ) recipients.push(cfg.emailLZ);
  if (!recipients.length) {
    logEvent_('INFO', 'digest', 'Sem destinatários configurados.');
    return;
  }

  recipients.forEach(function (to) {
    try {
      MailApp.sendEmail({ to: to, subject: subject, htmlBody: html });
      logEmail_(to, subject, 'ENVIADO',
        counts.CRITICO + ' críticos / ' + counts.SEM_ATUALIZACAO + ' sem att');
    } catch (e) {
      logEmail_(to, subject, 'ERRO', e.message);
      logEvent_('ERROR', 'digest', 'Falha ao enviar para ' + to + ': ' + e.message);
    }
  });
}

/** Monta o corpo HTML do resumo diário. */
function buildDigestHtml_(records, counts, cfg) {
  const line = function (emoji, n, label) {
    return '<tr><td style="font-size:18px;padding:4px 8px">' + emoji + '</td>' +
      '<td style="font-size:16px;font-weight:bold;padding:4px 8px">' + n + '</td>' +
      '<td style="font-size:14px;color:#5F6368;padding:4px 8px">' + label + '</td></tr>';
  };

  const crit = sortForLD_(records.filter(function (r) { return r['Status'] === STATUS.CRITICO; }));
  const att = sortForLD_(records.filter(function (r) { return r['Status'] === STATUS.SEM_ATUALIZACAO; }));

  const listItems = function (arr) {
    if (!arr.length) return '<li style="color:#5F6368">nenhum 🎉</li>';
    return arr.map(function (r) {
      return '<li><b>' + s_(r['Nome']) + '</b> — ' + s_(r['Distrito']) +
        ' • Semana ' + s_(r['Semana']) + '</li>';
    }).join('');
  };

  return '' +
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:auto">' +
    '<h2 style="color:#202124;margin-bottom:0">' + APP.NAME + '</h2>' +
    '<div style="color:#5F6368;margin-bottom:16px">' + cfg.distrito + ' • ' +
      Utilities.formatDate(new Date(), tz_(), "dd 'de' MMMM 'de' yyyy") + '</div>' +
    '<table style="border-collapse:collapse">' +
      line('🔴', counts.CRITICO, 'críticos') +
      line('🟠', counts.SEM_ATUALIZACAO, 'sem atualização') +
      line('🟡', counts.PENDENTE, 'pendentes') +
      line('🟢', counts.EM_DIA, 'em dia') +
      line('🔵', counts.BATIZADO, 'batizados') +
    '</table>' +
    '<h3 style="color:#A50E0E;margin-bottom:4px">🔴 Críticos</h3>' +
    '<ul style="margin-top:0">' + listItems(crit) + '</ul>' +
    '<h3 style="color:#8A3B00;margin-bottom:4px">🟠 Sem atualização</h3>' +
    '<ul style="margin-top:0">' + listItems(att) + '</ul>' +
    '<div style="color:#9AA0A6;font-size:12px;margin-top:24px">' +
      'Enviado automaticamente pelo ' + APP.NAME + ' • v' + APP.VERSION + '</div>' +
    '</div>';
}
