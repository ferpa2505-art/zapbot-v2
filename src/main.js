/**
 * ZapBot v2.0 — Processo principal Electron
 */

// ── Proteção contra crash por EPIPE (broken pipe) ──────────────────
// Evita que o app inteiro derrube quando o Node tenta escrever no
// console (console.log/warn/error) e o pipe de saída já foi fechado
// (ex: terminal fechado, redirecionamento de saída interrompido).
// Sem isso, uma escrita síncrona no stdout/stderr nesse cenário sobe
// como exceção não tratada no processo principal e mata o Electron.
process.stdout.on('error', (err) => { if (err && err.code === 'EPIPE') return })
process.stderr.on('error', (err) => { if (err && err.code === 'EPIPE') return })

const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('path')
const fs   = require('fs')

let mainWindow, botProcess = null

const DATA_PATH    = app.getPath('userData')
const CONFIG_PATH = path.join(DATA_PATH, 'config.json')
const SESSION_PATH = path.join(DATA_PATH, 'session')

function defaultConfig() {
  return {
    negocio: {
      nome:'', tipo:'medico', responsavel:'', endereco:'', site:'',
      horarioFer:'', horariosDias:{}, feriadoComportamento:'seguir_horario', feriadoMsg:''
    },
    mensagens: {
      boasVindas: 'Olá! 👋 Bem-vindo(a) a {nome}. Como posso ajudar?\n\n1️⃣ Agendar\n2️⃣ Cancelar\n3️⃣ Informações\n4️⃣ Falar com atendente',
      confirmacao: '✅ Agendado!\n🗓️ {data} às {hora}\n📍 {endereco}',
      foradeHorario:'Olá! Nosso horário é {horario}. Posso agendar mesmo assim!',
      cancelamento: 'Cancelamento confirmado. Quando quiser remarcar, é só chamar! 😊',
      escalada: 'Vou conectar você com um atendente. Aguarde um momento... 🙋'
    },
    menu: { agendar:true, cancelar:true, informacoes:true, escalada:true },
    horarios:{ responderForaHorario:true, modoFull24h:false, escalarParaHumano:true },
    posAtendimento: {
      pesquisaSatisfacao:true, pesquisaApos:'2h',
      lembrete24h:true, lembrete2h:true, pedirConfirmacao:true,
      reengajamento:true, reengajamentoApos:'3meses'
    },
    problemas: {
      cancelamentoAuto:true, reclamacaoEscalada:true, duvidasCobranca:true,
      reenviarResultado:true, emergencia:true, atrasoAuto:false
    },
    googleAgenda: { clientId:'', clientSecret:'', ativo:false },
    personalidade: {},
    senhaWeb: '1234',
    versao: '2.0.0'
  }
}

function loadConfig() {
  try { if (fs.existsSync(CONFIG_PATH)) return JSON.parse(fs.readFileSync(CONFIG_PATH,'utf8')) } catch {}
  return defaultConfig()
}

function saveConfig(cfg) {
  fs.mkdirSync(DATA_PATH, { recursive:true })
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2))
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width:1150, height:780, minWidth:940, minHeight:620,
    title:'ZapBot v2.0',
    webPreferences:{ nodeIntegration:false, contextIsolation:true, preload: path.join(__dirname,'preload.js') },
    backgroundColor:'#f7f8fa', show:false
  })
  mainWindow.loadFile(path.join(__dirname,'index.html'))
  mainWindow.once('ready-to-show', ()=>mainWindow.show())
  mainWindow.setMenuBarVisibility(false)
}

app.whenReady().then(createWindow)
app.on('window-all-closed', ()=>{ if(process.platform!=='darwin') app.quit() })
app.on('activate', ()=>{ if(BrowserWindow.getAllWindows().length===0) createWindow() })

// ── IPC Handlers ──────────────────
ipcMain.handle('load-config',   ()       => loadConfig())
ipcMain.handle('save-config',   (_, c)   => { saveConfig(c); return true })
ipcMain.handle('get-data-path', ()       => DATA_PATH)
ipcMain.handle('open-external', (_, u)   => shell.openExternal(u))
ipcMain.handle('clear-session', ()       => { if(fs.existsSync(SESSION_PATH)) fs.rmSync(SESSION_PATH,{recursive:true}); return true })

ipcMain.handle('buscar-feriados', async (_, cidade) => {
  try { const { getFeriados } = require('./feriados'); return await getFeriados(DATA_PATH).listarTodos(cidade) }
  catch(e) { return { feriados:[], erro:e.message } }
})

ipcMain.handle('google-save-creds', async (_, { clientId, clientSecret }) => {
  try {
    const { getAgenda } = require('./google-agenda')
    getAgenda(DATA_PATH).salvarCredenciais(clientId, clientSecret)
    const cfg = loadConfig(); cfg.googleAgenda = { clientId, clientSecret, ativo:true }; saveConfig(cfg)
    return { ok:true }
  } catch(e) { return { ok:false, msg:e.message } }
})

ipcMain.handle('google-autorizar', async () => {
  try {
    const { getAgenda } = require('./google-agenda')
    await getAgenda(DATA_PATH).autorizar(url => { shell.openExternal(url); mainWindow?.webContents.send('google-auth-url', url) })
    return { ok:true }
  } catch(e) { return { ok:false, msg:e.message } }
})

ipcMain.handle('google-status', () => {
  try { const { getAgenda } = require('./google-agenda'); return { temCredenciais: getAgenda(DATA_PATH).temCredenciais() } }
  catch { return { temCredenciais:false } }
})

ipcMain.handle('licenca-iniciar-beta', async (_, email) => {
  try { const { getLicenca } = require('./licenca'); return getLicenca(DATA_PATH).iniciarBeta(email) }
  catch(e) { return { ok:false, msg:e.message } }
})

ipcMain.handle('licenca-ativar', async (_, { chave, email }) => {
  try { const { getLicenca } = require('./licenca'); return await getLicenca(DATA_PATH).ativarPorChave(chave, email) }
  catch(e) { return { ok:false, msg:e.message } }
})

ipcMain.handle('licenca-status', () => {
  try { const { getLicenca } = require('./licenca'); return getLicenca(DATA_PATH).validar() }
  catch { return { valida:false, motivo:'erro' } }
})

ipcMain.handle('broadcast-importar', (_, lista) => {
  try { const { getBroadcast } = require('./broadcast'); return getBroadcast(DATA_PATH).importarContatos(lista) }
  catch(e) { return { ok:false, msg:e.message } }
})

ipcMain.handle('broadcast-contatos', () => {
  try { return require('./broadcast').getBroadcast(DATA_PATH).listarContatos() } catch { return [] }
})

ipcMain.handle('atendentes-resumo', () => {
  try { return require('./atendentes').gerenciador.getResumo() } catch { return {} }
})

ipcMain.handle('licenca-permite-ia', () => {
  try { return { permite: require('./licenca').getLicenca(DATA_PATH).permiteIA() } } catch { return { permite:false } }
})

ipcMain.handle('testar-ia', async (_, apiKey) => {
  try {
    const { getLicenca } = require('./licenca')
    if (!getLicenca(DATA_PATH).permiteIA()) return { ok: false, msg: 'Recurso de IA disponível só com licença paga ativa. Ative sua licença na aba Licença.' }
    const { AnalisadorIA } = require('./ia-analise')
    const ia = new AnalisadorIA(apiKey)
    if (!ia.temApiKey()) return { ok: false, msg: 'Nenhuma chave informada.' }
    const resposta = await ia.gerarResposta('Responda apenas "ok" pra confirmar que a conexão funciona.', [], {}, {})
    return { ok: true, msg: resposta }
  } catch (e) { return { ok: false, msg: e.message } }
})

ipcMain.handle('conversas-listar', () => {
  try { return require('./conversas').listarResumo(DATA_PATH) } catch { return [] }
})

ipcMain.handle('conversas-limpar', (_, jidSeguro) => {
  try { return require('./conversas').limpar(DATA_PATH, jidSeguro) } catch(e) { return { ok:false, msg:e.message } }
})

ipcMain.handle('conversas-limpar-todas', () => {
  try { return require('./conversas').limparTodas(DATA_PATH) } catch(e) { return { ok:false, msg:e.message } }
})

ipcMain.handle('backup-agora', async () => {
  try {
    const cfg = loadConfig()
    return await require('./backup-email').enviarBackupPorEmail(DATA_PATH, cfg.backup)
  } catch(e) { return { ok:false, msg:e.message } }
})

ipcMain.handle('pausar-conversa', (_, numeroOuJid) => {
  try { return require('./pausas').pausar(DATA_PATH, numeroOuJid) } catch(e) { return { ok:false, msg:e.message } }
})

ipcMain.handle('retomar-conversa', (_, jid) => {
  try { return require('./pausas').retomar(DATA_PATH, jid) } catch(e) { return { ok:false, msg:e.message } }
})

ipcMain.handle('listar-pausadas', () => {
  try { return require('./pausas').listar(DATA_PATH) } catch { return [] }
})

ipcMain.handle('start-bot', async () => {
  if (botProcess) return { ok:false, msg:'Bot já está rodando' }
  try {
    const { startBot } = require('./bot')
    const cfg = loadConfig()
    cfg._assetsPath = path.join(__dirname, '..', 'assets')
    botProcess = await startBot({
      sessionPath: SESSION_PATH,
      dataPath:    DATA_PATH,
      config:      cfg,
      onQR:        (qr)   => mainWindow?.webContents.send('qr-code', qr),
      onReady:     (num)  => mainWindow?.webContents.send('bot-ready', num),
      onMessage:   (msg)  => mainWindow?.webContents.send('new-message', msg),
      onWebInfo:   (info) => mainWindow?.webContents.send('web-info', info),
      onLicenca:   (lic)  => mainWindow?.webContents.send('licenca-status', lic),
      onDisconnect:()     => { botProcess=null; mainWindow?.webContents.send('bot-disconnected') }
    })
    return { ok:true }
  } catch(e) { botProcess=null; return { ok:false, msg:e.message } }
})

ipcMain.handle('stop-bot', async () => {
  if(botProcess?.stop) await botProcess.stop()
  botProcess=null; return true
})