/**
 * Email.gs
 * Resumo por e-mail para o Líder de Zona (LZ).
 * Toda mensagem enviada fica registrada na aba Emails.
 */

var EMAILS_HEADERS = ['Data/Hora', 'Para', 'Assunto', 'Status'];

function buildEmailsSchema() {
  var sh = getOrCreateSheet(SHEETS.EMAILS);
  sh.getRange(1, 1, 1, EMAILS_HEADERS.length).setValues([EMAILS_HEADERS])
    .setFontWeight('bold').setBackground('#37474F').setFontColor('#FFFFFF');
  sh.setFrozenRows(1);
}

/** Monta e envia o resumo ao LZ. */
function sendResumoLZ() {
  var cfg = getConfig();
  if (!cfg.emailLz) {
    toast('Defina o "E-mail do LZ" na aba ⚙️ Configuração.', 'Mission Tracker');
    return;
  }

  var ref = now();
  var counts = recomputeAll();
  var all = readAll();

  var criticos = all.filter(function (r) { return computeStatus(r, ref, cfg) === STATUS.VERMELHO; });
  var semAtualizacao = all.filter(function (r) { return computeStatus(r, ref, cfg) === STATUS.LARANJA; });

  var subject = 'Mission Tracker · ' + cfg.distrito + ' · ' +
    Utilities.formatDate(ref, ss().getSpreadsheetTimeZone(), 'dd/MM/yyyy');

  var html = buildResumoHtml(cfg, counts, criticos, semAtualizacao, ref);

  var status = 'OK';
  try {
    MailApp.sendEmail({ to: cfg.emailLz, subject: subject, htmlBody: html });
    toast('Resumo enviado para ' + cfg.emailLz, 'Mission Tracker');
  } catch (err) {
    status = 'ERRO: ' + err;
    logError('sendResumoLZ', err);
    toast('Falha ao enviar e-mail. Veja a aba Logs.', 'Mission Tracker');
  }

  var sh = getOrCreateSheet(SHEETS.EMAILS);
  sh.appendRow([ref, cfg.emailLz, subject, status]);
}

function buildResumoHtml(cfg, counts, criticos, semAtualizacao, ref) {
  var s = '';
  s += '<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;">';
  s += '<div style="background:#1A237E;color:#fff;padding:16px;border-radius:8px 8px 0 0;">';
  s += '<h2 style="margin:0;">📊 Mission Tracker</h2>';
  s += '<div>' + escapeHtml(cfg.distrito) + ' · ' +
    Utilities.formatDate(ref, ss().getSpreadsheetTimeZone(), 'dd/MM/yyyy HH:mm') + '</div>';
  s += '</div>';

  s += '<div style="padding:16px;background:#f5f6fa;">';
  s += '<table style="width:100%;border-collapse:collapse;text-align:center;">';
  s += '<tr>' +
    cardCell('🔴', counts.VERMELHO, 'Críticos') +
    cardCell('🟠', counts.LARANJA, 'Sem atualização') +
    cardCell('🟡', counts.AMARELO, 'Pendentes') +
    cardCell('🟢', counts.VERDE, 'Em dia') +
    '</tr></table>';

  s += '<p style="color:#5f6368;font-size:13px;">' +
    '🔵 ' + counts.AZUL + ' batizados · ⚪ ' + counts.CINZA + ' datas caídas · ⭐ ' + counts.RESERVADOS + ' reservados</p>';

  s += sectionHtml('🔴 Pendências críticas', criticos, ref, cfg);
  s += sectionHtml('🟠 Sem atualização', semAtualizacao, ref, cfg);

  s += '</div>';
  s += '<div style="padding:12px;color:#9e9e9e;font-size:11px;text-align:center;">' +
    'Enviado automaticamente pelo Mission Tracker.</div>';
  s += '</div>';
  return s;
}

function cardCell(icon, n, label) {
  return '<td style="padding:8px;">' +
    '<div style="font-size:22px;font-weight:bold;">' + icon + ' ' + (n || 0) + '</div>' +
    '<div style="font-size:11px;color:#5f6368;">' + label + '</div></td>';
}

function sectionHtml(title, records, ref, cfg) {
  if (!records.length) return '';
  var s = '<h3 style="margin:16px 0 6px;">' + title + '</h3><ul style="margin:0;padding-left:18px;">';
  records.forEach(function (r) {
    var status = computeStatus(r, ref, cfg);
    s += '<li style="margin:4px 0;"><b>' + escapeHtml(r.nome) + '</b> (S' + (r.semana || 1) + ') — ' +
      escapeHtml(statusReason(r, status, ref, cfg)) + '</li>';
  });
  s += '</ul>';
  return s;
}

function escapeHtml(v) {
  return String(v || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
