/**
 * ZapBot v2.0 — Preload seguro
 */
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('zapbot', {
  // Versão
  versao: '2.0.0',

  // Config
  loadConfig:         ()      => ipcRenderer.invoke('load-config'),
  saveConfig:         (cfg)   => ipcRenderer.invoke('save-config', cfg),
  clearSession:       ()      => ipcRenderer.invoke('clear-session'),
  openExternal:       (url)   => ipcRenderer.invoke('open-external', url),

  // Bot
  startBot:           ()      => ipcRenderer.invoke('start-bot'),
  stopBot:            ()      => ipcRenderer.invoke('stop-bot'),

  // Google Agenda
  googleSaveCreds:    (c)     => ipcRenderer.invoke('google-save-creds', c),
  googleAutorizar:    ()      => ipcRenderer.invoke('google-autorizar'),
  googleStatus:       ()      => ipcRenderer.invoke('google-status'),

  // Feriados
  buscarFeriados:     (cidade)=> ipcRenderer.invoke('buscar-feriados', cidade),

  // Licença
  licencaIniciarBeta: (email) => ipcRenderer.invoke('licenca-iniciar-beta', email),
  licencaAtivar:      (dados) => ipcRenderer.invoke('licenca-ativar', dados),
  licencaStatus:      ()      => ipcRenderer.invoke('licenca-status'),

  // Broadcast
  broadcastImportar:  (lista) => ipcRenderer.invoke('broadcast-importar', lista),
  broadcastContatos:  ()      => ipcRenderer.invoke('broadcast-contatos'),

  // Atendentes
  atendentesResumo:   ()      => ipcRenderer.invoke('atendentes-resumo'),

  // Eventos
  onQR:           (fn) => ipcRenderer.on('qr-code',          (_, d) => fn(d)),
  onReady:        (fn) => ipcRenderer.on('bot-ready',        (_, d) => fn(d)),
  onMessage:      (fn) => ipcRenderer.on('new-message',      (_, d) => fn(d)),
  onWebInfo:      (fn) => ipcRenderer.on('web-info',         (_, d) => fn(d)),
  onDisconnected: (fn) => ipcRenderer.on('bot-disconnected', ()     => fn()),
  onGoogleUrl:    (fn) => ipcRenderer.on('google-auth-url',  (_, d) => fn(d)),
  onLicenca:      (fn) => ipcRenderer.on('licenca-status',   (_, d) => fn(d)),

  removeAll: () => {
    ['qr-code','bot-ready','new-message','web-info','bot-disconnected','google-auth-url','licenca-status']
      .forEach(e => ipcRenderer.removeAllListeners(e))
  }
})
