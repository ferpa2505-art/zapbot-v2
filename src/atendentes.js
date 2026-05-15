/**
 * atendentes.js
 * Sistema de múltiplos atendentes com fila, transferência e status
 */

const EventEmitter = require('events')

class GerenciadorAtendentes extends EventEmitter {
  constructor() {
    super()
    this.atendentes  = new Map()   // id → { nome, status, conversas }
    this.fila        = []          // jids aguardando atendente
    this.alocacoes   = new Map()   // jid → atendenteId
    this.historico   = []          // log de todas as transferências
  }

  // ── Registro ──────────────────────────────────────────────────────────────

  registrar(id, nome, senha) {
    this.atendentes.set(id, {
      id, nome, senha,
      status: 'offline',      // online | ausente | offline
      conversas: new Set(),
      totalAtendidos: 0,
      entrou: null
    })
    return true
  }

  autenticar(id, senha) {
    const at = this.atendentes.get(id)
    return at && at.senha === senha ? at : null
  }

  setStatus(id, status) {
    const at = this.atendentes.get(id)
    if (!at) return false
    const anterior = at.status
    at.status = status
    if (status === 'online' && anterior !== 'online') {
      at.entrou = new Date()
      this._tentarDistribuirFila()
    }
    this.emit('status-mudou', { id, nome: at.nome, status })
    return true
  }

  // ── Fila ──────────────────────────────────────────────────────────────────

  entrarNaFila(jid, dadosConversa = {}) {
    if (this.alocacoes.has(jid)) return { status: 'ja-alocado', atendenteId: this.alocacoes.get(jid) }
    if (this.fila.find(f => f.jid === jid)) return { status: 'ja-na-fila', posicao: this._posicaoFila(jid) }

    this.fila.push({ jid, dadosConversa, entrou: new Date() })
    const posicao = this.fila.length
    this.emit('cliente-na-fila', { jid, posicao, dadosConversa })

    // Tenta alocar imediatamente se tiver atendente disponível
    const alocado = this._tentarDistribuirFila()
    if (alocado?.jid === jid) return { status: 'alocado', atendenteId: this.alocacoes.get(jid) }
    return { status: 'na-fila', posicao }
  }

  _posicaoFila(jid) {
    return this.fila.findIndex(f => f.jid === jid) + 1
  }

  _atendenteDisponivel() {
    // Pega o atendente online com menos conversas ativas
    let escolhido = null, menorCarga = Infinity
    for (const at of this.atendentes.values()) {
      if (at.status === 'online' && at.conversas.size < menorCarga) {
        menorCarga = at.conversas.size
        escolhido  = at
      }
    }
    return escolhido
  }

  _tentarDistribuirFila() {
    if (this.fila.length === 0) return null
    const at = this._atendenteDisponivel()
    if (!at) return null

    const { jid, dadosConversa } = this.fila.shift()
    this._alocar(jid, at.id, dadosConversa)
    return { jid, atendenteId: at.id }
  }

  _alocar(jid, atendenteId, dadosConversa = {}) {
    const at = this.atendentes.get(atendenteId)
    if (!at) return false
    at.conversas.add(jid)
    at.totalAtendidos++
    this.alocacoes.set(jid, atendenteId)
    this.historico.push({ acao: 'alocado', jid, atendenteId, nomeAtendente: at.nome, quando: new Date() })
    this.emit('alocado', { jid, atendenteId, nomeAtendente: at.nome, dadosConversa })
    return true
  }

  // ── Transferência ─────────────────────────────────────────────────────────

  transferir(jid, paraAtendenteId, motivo = '') {
    const deId = this.alocacoes.get(jid)
    const de   = this.atendentes.get(deId)
    const para = this.atendentes.get(paraAtendenteId)
    if (!para) return { ok: false, msg: 'Atendente destino não encontrado' }
    if (de) de.conversas.delete(jid)
    para.conversas.add(jid)
    this.alocacoes.set(jid, paraAtendenteId)
    this.historico.push({ acao: 'transferido', jid, de: deId, para: paraAtendenteId, motivo, quando: new Date() })
    this.emit('transferido', { jid, de: deId, nomeAtendenteDe: de?.nome, para: paraAtendenteId, nomeAtendentePara: para.nome, motivo })
    return { ok: true }
  }

  // ── Encerrar conversa ─────────────────────────────────────────────────────

  encerrar(jid) {
    const atId = this.alocacoes.get(jid)
    const at   = this.atendentes.get(atId)
    if (at) at.conversas.delete(jid)
    this.alocacoes.delete(jid)
    this.historico.push({ acao: 'encerrado', jid, atendenteId: atId, quando: new Date() })
    this.emit('encerrado', { jid, atendenteId: atId })
    // Tenta pegar próximo da fila
    this._tentarDistribuirFila()
  }

  // ── Dados para o painel ───────────────────────────────────────────────────

  getResumo() {
    const ats = []
    for (const at of this.atendentes.values()) {
      ats.push({
        id: at.id, nome: at.nome, status: at.status,
        conversasAtivas: at.conversas.size,
        totalAtendidos: at.totalAtendidos,
        conversas: [...at.conversas]
      })
    }
    return {
      atendentes: ats,
      filaTamanho: this.fila.length,
      fila: this.fila.map((f, i) => ({ posicao: i + 1, jid: f.jid, aguardandoDesde: f.entrou })),
      totalAlocados: this.alocacoes.size
    }
  }

  getConversasDoAtendente(atendenteId) {
    const at = this.atendentes.get(atendenteId)
    return at ? [...at.conversas] : []
  }

  getAtendenteDeConversa(jid) {
    const id = this.alocacoes.get(jid)
    return id ? this.atendentes.get(id) : null
  }
}

// Singleton global
const gerenciador = new GerenciadorAtendentes()
module.exports = { GerenciadorAtendentes, gerenciador }
