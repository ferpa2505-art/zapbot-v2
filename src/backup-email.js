/**
 * backup-email.js
 * Envia o backup das conversas por e-mail (usando SMTP configurado pelo usuário,
 * ex: Gmail com senha de app). Também gerencia o agendamento automático.
 */

const { salvarBackupEmArquivo } = require('./conversas')

let nodemailer
try { nodemailer = require('nodemailer') } catch { nodemailer = null }

async function enviarBackupPorEmail(dataPath, cfgBackup) {
  if (!nodemailer) {
    return { ok: false, msg: 'Dependência "nodemailer" não instalada. Rode: npm install nodemailer' }
  }
  const { smtpEmail, smtpSenha, smtpHost, smtpPorta, emailDestino } = cfgBackup || {}
  if (!smtpEmail || !smtpSenha || !emailDestino) {
    return { ok: false, msg: 'Preencha e-mail remetente, senha de app e e-mail de destino nas configurações de Backup.' }
  }

  const caminhoArquivo = salvarBackupEmArquivo(dataPath)

  const transporter = nodemailer.createTransport({
    host: smtpHost || 'smtp.gmail.com',
    port: smtpPorta || 465,
    secure: true,
    auth: { user: smtpEmail, pass: smtpSenha }
  })

  try {
    await transporter.sendMail({
      from: smtpEmail,
      to: emailDestino,
      subject: `Backup de conversas — ZapBot (${new Date().toLocaleDateString('pt-BR')})`,
      text: 'Segue em anexo o backup das conversas do ZapBot.',
      attachments: [{ path: caminhoArquivo }]
    })
    return { ok: true, arquivo: caminhoArquivo }
  } catch (e) {
    return { ok: false, msg: e.message, arquivo: caminhoArquivo }
  }
}

// ── Agendador simples (sem dependência de cron) ──────────────────────────────
let timerAtivo = null

function pararAgendamento() {
  if (timerAtivo) { clearInterval(timerAtivo); timerAtivo = null }
}

function iniciarAgendamento(dataPath, cfgBackup, onResultado) {
  pararAgendamento()
  if (!cfgBackup?.automatico) return

  const intervalos = { diario: 24 * 3600000, semanal: 7 * 24 * 3600000 }
  const intervaloMs = intervalos[cfgBackup.frequencia] || intervalos.diario

  timerAtivo = setInterval(async () => {
    const resultado = await enviarBackupPorEmail(dataPath, cfgBackup)
    onResultado && onResultado(resultado)
  }, intervaloMs)
}

module.exports = { enviarBackupPorEmail, iniciarAgendamento, pararAgendamento }
