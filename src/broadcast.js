/**
 * broadcast.js
 * Envio de mensagens em massa com segmentação, agendamento e relatório
 */

const EventEmitter = require('events')
const fs   = require('fs')
const path = require('path')

class Broadcast extends EventEmitter {
  constructor(dataPath) {
    super()
    this.dataPath   = dataPath
    this.contatos   = this._carregarContatos()
    this.campanhas  = this._carregarCampanhas()
    this.sock       = null   // referência ao socket Baileys
    this._timers    = new Map()
  }

  // ── Persistência ──────────────────────────────────────────────────────────

  _arq(nome) { return path.join(this.dataPath, nome) }

  _carregarContatos() {
    try { return JSON.parse(fs.readFileSync(this._arq('contatos.json'))) } catch { return [] }
  }

  _carregarCampanhas() {
    try { return JSON.parse(fs.readFileSync(this._arq('campanhas.json'))) } catch { return [] }
  }

  _salvarContatos()  { fs.writeFileSync(this._arq('contatos.json'),  JSON.stringify(this.contatos,  null, 2)) }
  _salvarCampanhas() { fs.writeFileSync(this._arq('campanhas.json'), JSON.stringify(this.campanhas, null, 2)) }

  // ── Contatos ──────────────────────────────────────────────────────────────

  adicionarContato({ nome, telefone, tags = [], extra = {} }) {
    const jid = this._normalizar(telefone)
    const idx = this.contatos.findIndex(c => c.jid === jid)
    const contato = { nome, telefone, jid, tags, extra, adicionado: new Date().toISOString() }
    if (idx >= 0) this.contatos[idx] = { ...this.contatos[idx], ...contato }
    else this.contatos.push(contato)
    this._salvarContatos()
    return contato
  }

  importarContatos(lista) {
    // lista: [{ nome, telefone, tags? }]
    let adicionados = 0, atualizados = 0
    for (const c of lista) {
      const jid = this._normalizar(c.telefone)
      const existe = this.contatos.find(x => x.jid === jid)
      this.adicionarContato(c)
      existe ? atualizados++ : adicionados++
    }
    return { adicionados, atualizados, total: this.contatos.length }
  }

  listarContatos(filtroTags = []) {
    if (!filtroTags.length) return this.contatos
    return this.contatos.filter(c => filtroTags.every(t => c.tags.includes(t)))
  }

  todasAsTags() {
    const set = new Set()
    this.contatos.forEach(c => c.tags.forEach(t => set.add(t)))
    return [...set].sort()
  }

  _normalizar(tel) {
    const nums = tel.replace(/\D/g, '')
    const comDDI = nums.startsWith('55') ? nums : '55' + nums
    return comDDI + '@s.whatsapp.net'
  }

  _interpolar(texto, contato) {
    return texto
      .replace(/\{nome\}/gi,     contato.nome     || '')
      .replace(/\{telefone\}/gi, contato.telefone || '')
      .replace(/\{tag\}/gi,      contato.tags?.[0] || '')
  }

  // ── Campanhas ─────────────────────────────────────────────────────────────

  criarCampanha({ nome, mensagem, tags = [], agendarPara = null, intervaloMs = 3000 }) {
    const campanha = {
      id: Date.now().toString(),
      nome, mensagem, tags,
      agendarPara,   // ISO string ou null (imediato)
      intervaloMs,   // delay entre cada envio (ms) — evita banimento
      status: 'pendente',    // pendente | enviando | concluida | pausada | erro
      criada: new Date().toISOString(),
      relatorio: { total: 0, enviados: 0, erros: 0, detalhes: [] }
    }
    this.campanhas.push(campanha)
    this._salvarCampanhas()

    if (agendarPara) {
      const delay = new Date(agendarPara).getTime() - Date.now()
      if (delay > 0) {
        const timer = setTimeout(() => this.dispararCampanha(campanha.id), delay)
        this._timers.set(campanha.id, timer)
      }
    }
    return campanha
  }

  async dispararCampanha(id) {
    const c = this.campanhas.find(x => x.id === id)
    if (!c || !this.sock) return { ok: false, msg: 'Campanha não encontrada ou bot desconectado' }
    if (c.status === 'enviando') return { ok: false, msg: 'Já em andamento' }

    const destinatarios = this.listarContatos(c.tags)
    c.status = 'enviando'
    c.relatorio = { total: destinatarios.length, enviados: 0, erros: 0, detalhes: [] }
    this._salvarCampanhas()
    this.emit('campanha-iniciada', { id, nome: c.nome, total: destinatarios.length })

    for (const contato of destinatarios) {
      if (c.status === 'pausada') break
      try {
        const texto = this._interpolar(c.mensagem, contato)
        await this.sock.sendMessage(contato.jid, { text: texto })
        c.relatorio.enviados++
        c.relatorio.detalhes.push({ jid: contato.jid, nome: contato.nome, status: 'ok', quando: new Date().toISOString() })
        this.emit('mensagem-enviada', { campanhaId: id, contato, enviados: c.relatorio.enviados, total: destinatarios.length })
      } catch (err) {
        c.relatorio.erros++
        c.relatorio.detalhes.push({ jid: contato.jid, nome: contato.nome, status: 'erro', erro: err.message })
        this.emit('erro-envio', { campanhaId: id, contato, erro: err.message })
      }
      // Delay entre envios (evita bloqueio do WhatsApp)
      await new Promise(r => setTimeout(r, c.intervaloMs + Math.random() * 1000))
      this._salvarCampanhas()
    }

    c.status = c.status === 'pausada' ? 'pausada' : 'concluida'
    this._salvarCampanhas()
    this.emit('campanha-concluida', { id, relatorio: c.relatorio })
    return { ok: true, relatorio: c.relatorio }
  }

  pausarCampanha(id) {
    const c = this.campanhas.find(x => x.id === id)
    if (!c) return false
    c.status = 'pausada'
    this._salvarCampanhas()
    this.emit('campanha-pausada', { id })
    return true
  }

  cancelarCampanha(id) {
    const timer = this._timers.get(id)
    if (timer) { clearTimeout(timer); this._timers.delete(id) }
    const c = this.campanhas.find(x => x.id === id)
    if (c) { c.status = 'cancelada'; this._salvarCampanhas() }
    return true
  }

  getRelatorio(id) {
    return this.campanhas.find(c => c.id === id) || null
  }

  listarCampanhas() {
    return this.campanhas.map(c => ({
      id: c.id, nome: c.nome, status: c.status,
      criada: c.criada, agendarPara: c.agendarPara,
      tags: c.tags, relatorio: c.relatorio
    }))
  }

  setSock(sock) { this.sock = sock }
}

const instancias = new Map()
function getBroadcast(dataPath) {
  if (!instancias.has(dataPath)) instancias.set(dataPath, new Broadcast(dataPath))
  return instancias.get(dataPath)
}

module.exports = { Broadcast, getBroadcast }
