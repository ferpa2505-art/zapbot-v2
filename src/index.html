/**
 * bot.js v4 — Motor completo do ZapBot
 * Usa dynamic import() para compatibilidade com Baileys ESM
 */

const QRCode = require('qrcode')
const pino   = require('pino')
const fs     = require('fs')

const { getFeriados }          = require('./feriados')
const { getAgenda }            = require('./google-agenda')
const { gerenciador }          = require('./atendentes')
const { getBroadcast }         = require('./broadcast')
const { ServidorWeb }          = require('./servidor-web')
const { getLicenca }           = require('./licenca')
const { ServicoVoz }           = require('./voz')
const { AnalisadorIA }         = require('./ia-analise')
const {
  defaultPersonalidade, dentroDoHorarioChat,
  aplicarAssinatura, filtrarPalavrasBloqueadas, JARGOES
} = require('./personalidade')

const logger = pino({ level: 'silent' })

const SEGMENTOS = {
  medico:'medico', dentista:'dentista', advogado:'advogado', psico:'psico',
  imobiliaria:'imobiliaria', loja:'loja', restaurante:'restaurante',
  salao:'salao', farmacia:'farmacia', academia:'academia', escola:'escola', custom:'custom'
}

const sessoes    = new Map()
const historicoIA = new Map()

function addHistorico(jid, role, content, max = 10) {
  if (!historicoIA.has(jid)) historicoIA.set(jid, [])
  const h = historicoIA.get(jid)
  h.push({ role, content })
  if (h.length > max * 2) h.splice(0, 2)
}

function interpolar(texto, vars) {
  return (texto || '').replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '')
}

function agora() {
  return new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

function getSessao(jid) {
  if (!sessoes.has(jid)) sessoes.set(jid, { etapa: 'inicio', dados: {}, msgs: 0 })
  return sessoes.get(jid)
}

async function enviarResposta(sock, jid, texto, pers, vozSvc) {
  if (!texto) return
  const textoFinal = aplicarAssinatura(texto, pers)
  const modo = pers.modoResposta || 'texto'
  const opcVoz = { genero: pers.generoVoz, sotaque: pers.sotaque, idioma: pers.idioma, velocidade: pers.velocidadeVoz }
  if (modo === 'voz' && vozSvc?.temApiKey()) {
    try { await vozSvc.enviarComoVoz(sock, jid, textoFinal, opcVoz) } catch { await sock.sendMessage(jid, { text: textoFinal }) }
  } else if (modo === 'ambos' && vozSvc?.temApiKey()) {
    try { await vozSvc.enviarTextoEVoz(sock, jid, textoFinal, opcVoz) } catch { await sock.sendMessage(jid, { text: textoFinal }) }
  } else {
    await sock.sendMessage(jid, { text: textoFinal })
  }
}

function gerarMenu(cfg, agendaOk, pers) {
  const nome = cfg.negocio?.nome || 'nossa empresa'
  const nomeAgente = pers?.nomeAgente || 'Assistente'
  const m = cfg.menu || {}
  const linhas = [`Olá! 👋 Sou *${nomeAgente}*, assistente de *${nome}*.\n\nComo posso ajudar?`]
  let i = 1
  if (m.agendar)     linhas.push(`${i++}️⃣ Agendar`)
  if (m.cancelar)    linhas.push(`${i++}️⃣ Cancelar / remarcar`)
  if (m.informacoes) linhas.push(`${i++}️⃣ Informações`)
  if (m.escalada)    linhas.push(`${i++}️⃣ Falar com atendente`)
  if (agendaOk)      linhas.push(`\n_🗓 Agendamento integrado ao Google Agenda_`)
  return linhas.join('\n')
}

async function gerarResposta(jid, texto, cfg, agenda, ia, pers, dataPath='') {
  const sessao   = getSessao(jid)
  sessao.msgs    = (sessao.msgs || 0) + 1
  const vars     = { nome: cfg.negocio?.nome, horario: cfg.negocio?.horario, endereco: cfg.negocio?.endereco, profissional: cfg.negocio?.responsavel }
  const agendaOk = agenda?.temCredenciais()

  // Verifica feriado
  const gerFer = getFeriados(dataPath || '')
  const feriado = await gerFer.verificarHoje(cfg.negocio?.endereco || cfg.negocio?.nome || '')
  const comportFeriado = cfg.negocio?.feriadoComportamento || 'seguir_horario'
  if (feriado && sessao.etapa === 'inicio') {
    if (comportFeriado === 'fechado' || comportFeriado === 'personalizado') {
      const msgFer = cfg.negocio?.feriadoMsg || `Hoje é *${feriado.nome}* 🎉 Estamos em feriado! Retornaremos no próximo dia útil.`
      return interpolar(msgFer, { ...vars, feriado: feriado.nome })
    }
    if (comportFeriado === 'bot_ativo') {
      // Bot responde mas informa que empresa está fechada
      sessao._avisoFeriado = feriado.nome
    }
  }

  if (!dentroDoHorarioChat(pers.horarioChat) && sessao.etapa === 'inicio') {
    return pers.horarioChat?.msgForaHorario || `Fora do horário de atendimento. Deixe sua mensagem!`
  }

  const { bloqueado } = filtrarPalavrasBloqueadas(texto, pers.palavrasBloqueadas)
  if (bloqueado) return `Não consigo ajudar com esse assunto. Posso ajudar com algo relacionado a ${cfg.negocio?.nome}?`

  if (sessao.msgs >= (pers.limiteMsgAntesEscalar || 10) && sessao.etapa !== 'com_atendente') {
    gerenciador.entrarNaFila(jid, { motivo: 'limite-msgs' })
    sessao.etapa = 'com_atendente'
    return `Vou conectar você com nossa equipe para um atendimento mais personalizado! ⏳`
  }

  if (/urgente|emergên|socorro|dor forte|acident/i.test(texto) && cfg.problemas?.emergencia) {
    gerenciador.entrarNaFila(jid, { motivo: 'emergencia' })
    return `🚨 *EMERGÊNCIA* — Acionando atendente!\n\nSAMU: 192 | Bombeiros: 193`
  }

  if (/recla|insatisf|péssim|horrív/i.test(texto) && sessao.etapa !== 'reclamacao_detalhe') {
    sessao.etapa = 'reclamacao_detalhe'
    return `Lamentamos muito. 😔 Pode descrever o que aconteceu?`
  }
  if (sessao.etapa === 'reclamacao_detalhe') {
    gerenciador.entrarNaFila(jid, { motivo: 'reclamacao', texto })
    sessao.etapa = 'inicio'
    return `✅ Registrado! Nossa equipe entrará em contato em até 2 horas. 🙏`
  }

  if (/atendente|humano|falar com/i.test(texto) || /^4$/.test(texto.trim())) {
    const res = gerenciador.entrarNaFila(jid, { texto })
    if (res.status === 'alocado') { sessao.etapa = 'com_atendente'; const at = gerenciador.getAtendenteDeConversa(jid); return `✅ Conectando com *${at?.nome || 'atendente'}*... ⏳` }
    sessao.etapa = 'na_fila'
    return interpolar(cfg.mensagens?.escalada || 'Um atendente irá responder em breve. ⏳', vars) + `\n📋 Posição: *${res.posicao}*`
  }

  if (sessao.etapa === 'com_atendente') return null
  if (sessao.etapa === 'na_fila') return `⏳ Você ainda aguarda na fila. Em breve um atendente entrará em contato!`

  // Fluxo de agendamento
  if (sessao.etapa === 'ag_nome') {
    sessao.dados.nome = texto; sessao.etapa = 'ag_servico'
    return `Obrigado, *${texto}*! Que tipo de atendimento você precisa?`
  }
  if (sessao.etapa === 'ag_servico') {
    sessao.dados.servico = texto; sessao.etapa = agendaOk ? 'ag_data_google' : 'ag_data'
    return `Qual *data* você prefere?`
  }
  if (sessao.etapa === 'ag_data_google') {
    sessao.dados.dataTexto = texto
    let dataISO = null
    const partes = texto.match(/(\d{1,2})[\/\-](\d{1,2})/)
    if (partes) { const a = new Date().getFullYear(); dataISO = `${a}-${partes[2].padStart(2,'0')}-${partes[1].padStart(2,'0')}` }
    else if (/amanhã|amanha/i.test(texto)) { const d = new Date(); d.setDate(d.getDate()+1); dataISO = d.toISOString().split('T')[0] }
    if (dataISO) {
      try {
        const slots = await agenda.listarHorariosDisponiveis(dataISO)
        if (slots.length) { sessao.dados.dataISO = dataISO; sessao.dados.slots = slots; sessao.etapa = 'ag_hora_google'; return `📅 *Horários disponíveis – ${texto}:*\n\n` + slots.map((s,i) => `${i+1}️⃣ ${s}`).join('\n') + `\n\nDigite o número ou horário.` }
        return `😕 Sem horários em *${texto}*. Escolha outra data:`
      } catch {}
    }
    sessao.etapa = 'ag_hora'; return `Qual *horário*? (Manhã: 8h–12h | Tarde: 14h–18h)`
  }
  if (sessao.etapa === 'ag_hora_google') {
    let hora = texto.trim(); const idx = parseInt(hora) - 1
    if (!isNaN(idx) && sessao.dados.slots?.[idx]) hora = sessao.dados.slots[idx]
    sessao.dados.hora = hora; sessao.etapa = 'ag_confirmar'
    const d = sessao.dados
    return `✅ *Confirme:*\n\n👤 ${d.nome}\n📋 ${d.servico}\n📅 ${d.dataTexto} às ${d.hora}\n📍 ${vars.endereco || vars.nome}\n\nDigite *CONFIRMAR* para finalizar.`
  }
  if (sessao.etapa === 'ag_data') { sessao.dados.dataTexto = texto; sessao.etapa = 'ag_hora'; return `Qual *horário*? (Manhã: 8h–12h | Tarde: 14h–18h)` }
  if (sessao.etapa === 'ag_hora') {
    sessao.dados.hora = texto; sessao.etapa = 'ag_confirmar'
    const d = sessao.dados
    return `✅ *Confirme:*\n\n👤 ${d.nome}\n📋 ${d.servico}\n📅 ${d.dataTexto} às ${d.hora}\n📍 ${vars.endereco || vars.nome}\n\nDigite *CONFIRMAR* para finalizar.`
  }
  if (sessao.etapa === 'ag_confirmar') {
    if (/confirmar|sim|isso|certo|ok/i.test(texto)) {
      const d = sessao.dados; sessao.etapa = 'inicio'; let extra = ''
      if (agendaOk && d.dataISO && d.hora) try { await agenda.criarEvento({ titulo: `Atendimento – ${d.nome}`, descricao: d.servico, data: d.dataISO, hora: d.hora, nomeCliente: d.nome }); extra = '\n🗓 _Adicionado ao Google Agenda._' } catch {}
      return interpolar(cfg.mensagens?.confirmacao || '✅ Agendado!\n📅 {data} às {hora}', { ...vars, nome: d.nome, data: d.dataTexto, hora: d.hora, servico: d.servico }) + extra + '\n\n_Você receberá um lembrete. 🔔_'
    }
    sessao.etapa = 'inicio'; return `Ok, cancelado. Me chame quando quiser agendar! 😊`
  }
  if (sessao.etapa === 'cancel_info') { sessao.etapa = 'inicio'; return interpolar(cfg.mensagens?.cancelamento || 'Cancelamento confirmado! 😊', vars) }
  if (sessao.etapa === 'fora_horario') { sessao.etapa = 'ag_nome'; return `Posso agendar mesmo assim! Qual é o seu *nome completo*?` }

  // IA livre
  if (pers.usarIAParaRespostas && ia?.temApiKey()) {
    addHistorico(jid, 'user', texto, pers.contextWindowIA)
    const historico = historicoIA.get(jid) || []
    const resposta  = await ia.gerarResposta(texto, historico.slice(0,-1), cfg.negocio, pers)
    addHistorico(jid, 'assistant', resposta, pers.contextWindowIA)
    return resposta
  }

  // Menu principal
  if (/^1$/.test(texto.trim()) || /agendar|marcar/i.test(texto)) { sessao.etapa = 'ag_nome'; return `Para agendar, qual é o seu *nome completo*?` }
  if (/^2$/.test(texto.trim()) || /cancelar/i.test(texto)) { sessao.etapa = 'cancel_info'; return `Para cancelar, informe seu *nome* e a *data* do agendamento.` }
  if (/^3$/.test(texto.trim()) || /informa/i.test(texto)) return `📋 *${cfg.negocio?.nome}*\n\n⏰ ${cfg.negocio?.horario || 'Consulte-nos'}\n📍 ${cfg.negocio?.endereco || 'Consulte-nos'}\n👤 ${cfg.negocio?.responsavel || 'Nossa equipe'}`

  sessao.etapa = 'menu_principal'
  return gerarMenu(cfg, agendaOk, pers)
}

async function startBot({ sessionPath, dataPath, config, onQR, onReady, onMessage, onDisconnect, onWebInfo, onLicenca }) {
  fs.mkdirSync(dataPath, { recursive: true })

  const licenca = getLicenca(dataPath)
  const statusLic = licenca.validar()
  onLicenca && onLicenca(statusLic)
  if (!statusLic.valida) throw new Error(`Licença inválida: ${statusLic.motivo}`)

  const pers      = { ...defaultPersonalidade(), ...(config.personalidade || {}) }
  const agenda    = getAgenda(dataPath)
  const broadcast = getBroadcast(dataPath)
  const vozSvc    = new ServicoVoz(pers.chaveGoogleTTS || config.chaveGoogleTTS || '')
  const ia        = new AnalisadorIA(pers.chaveClaudeAPI || config.chaveClaudeAPI || process.env.ANTHROPIC_API_KEY || '')

  const web = new ServidorWeb({
    porta: 3000, senhaAdmin: config.senhaWeb || '1234', dataPath,
    onComando: async (cmd) => {
      if (cmd.tipo === 'add-atendente')     return gerenciador.registrar(cmd.id, cmd.nome, cmd.senha)
      if (cmd.tipo === 'set-status')        return gerenciador.setStatus(cmd.id, cmd.status)
      if (cmd.tipo === 'criar-campanha')    return broadcast.criarCampanha(cmd)
      if (cmd.tipo === 'disparar-campanha') return broadcast.dispararCampanha(cmd.id)
      if (cmd.tipo === 'pausar-campanha')   return broadcast.pausarCampanha(cmd.id)
    }
  })
  const webInfo = web.iniciar()
  onWebInfo && onWebInfo(webInfo)

  // Dynamic import do Baileys (ESM)
  const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    downloadMediaMessage
  } = await import('@whiskeysockets/baileys')

  const { Boom } = await import('@hapi/boom')

  const { version }       = await fetchLatestBaileysVersion()
  const { state, saveCreds } = await useMultiFileAuthState(sessionPath)

  const sock = makeWASocket({
    version, logger, auth: state,
    printQRInTerminal: false,
    browser: ['ZapBot', 'Chrome', '1.0.0'],
    generateHighQualityLinkPreview: false
  })

  broadcast.setSock(sock)

  gerenciador.on('alocado', ({ jid, nomeAtendente }) => {
    sock.sendMessage(jid, { text: `✅ Conectando com *${nomeAtendente}*... ⏳` })
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) { const url = await QRCode.toDataURL(qr, { width: 256, margin: 1 }); onQR(url) }
    if (connection === 'open') {
      const num = sock.user?.id?.split(':')[0] || ''
      web.atualizar({ status: 'online', numero: num })
      onReady(num)
    }
    if (connection === 'close') {
      web.atualizar({ status: 'offline' })
      const code = new Boom(lastDisconnect?.error)?.output?.statusCode
      if (code !== DisconnectReason.loggedOut) {
        setTimeout(() => startBot({ sessionPath, dataPath, config, onQR, onReady, onMessage, onDisconnect, onWebInfo, onLicenca }), 3000)
      } else onDisconnect()
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    for (const msg of messages) {
      if (msg.key.fromMe || !msg.message) continue
      const jid    = msg.key.remoteJid
      const tipoMsg = msg.message.imageMessage   ? 'imagem'
                    : msg.message.documentMessage ? 'pdf'
                    : msg.message.audioMessage    ? 'audio' : 'texto'
      let texto = msg.message.conversation || msg.message.extendedTextMessage?.text || ''

      const msgObj = { jid, texto: texto || `[${tipoMsg}]`, hora: agora() }
      onMessage(msgObj)
      web.addMensagem(msgObj)
      web.atualizar({ resumoAtendentes: gerenciador.getResumo(), campanhas: broadcast.listarCampanhas() })

      if (tipoMsg === 'imagem' && pers.analisarImagens && ia.temApiKey()) {
        await sock.sendMessage(jid, { text: pers.msgAguardandoAnalise || '🔍 Analisando a imagem...' })
        try {
          const buffer  = await downloadMediaMessage(msg, 'buffer', {})
          const analise = await ia.analisarComContexto(buffer, 'imagem', historicoIA.get(jid) || [], texto || 'O que você vê?', { ...config.negocio, ...pers })
          addHistorico(jid, 'user', `[imagem] ${texto}`); addHistorico(jid, 'assistant', analise)
          await new Promise(r => setTimeout(r, 600))
          await enviarResposta(sock, jid, analise, pers, vozSvc)
        } catch { await sock.sendMessage(jid, { text: 'Não consegui analisar a imagem. Pode descrever o que precisa?' }) }
        continue
      }

      if (tipoMsg === 'pdf' && pers.analisarPDFs && ia.temApiKey()) {
        await sock.sendMessage(jid, { text: pers.msgAguardandoAnalise || '🔍 Analisando o documento...' })
        try {
          const buffer  = await downloadMediaMessage(msg, 'buffer', {})
          const analise = await ia.analisarComContexto(buffer, 'pdf', historicoIA.get(jid) || [], texto || 'Resumo do documento', { ...config.negocio, ...pers })
          addHistorico(jid, 'user', `[pdf] ${texto}`); addHistorico(jid, 'assistant', analise)
          await new Promise(r => setTimeout(r, 600))
          await enviarResposta(sock, jid, analise, pers, vozSvc)
        } catch { await sock.sendMessage(jid, { text: 'Não consegui ler o documento. Pode descrever o que precisa?' }) }
        continue
      }

      if (tipoMsg === 'audio') { await sock.sendMessage(jid, { text: 'Recebi seu áudio! No momento respondo por texto. Pode digitar sua mensagem?' }); continue }
      if (!texto.trim()) continue

      const delay = Math.min(700 + Math.random() * 800, (pers.tempoMaxResposta || 1) * 1000)
      await new Promise(r => setTimeout(r, delay))

      const resposta = await gerarResposta(jid, texto, config, agenda, ia, pers, dataPath)
      if (resposta) await enviarResposta(sock, jid, resposta, pers, vozSvc)
    }
  })

  return {
    sock, web, agenda, broadcast, gerenciador, licenca, vozSvc, ia,
    stop: async () => { web.parar(); await sock.logout().catch(() => {}); sock.end() }
  }
}

module.exports = { startBot }
