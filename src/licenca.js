/**
 * licenca.js
 * Controle de acesso: beta 7 dias gratuito + licença por pagamento
 * Integra com Hotmart, Kiwify ou qualquer webhook de pagamento
 */

const fs      = require('fs')
const path    = require('path')
const crypto  = require('crypto')
const http    = require('http')
const https   = require('https')

class GerenciadorLicenca {
  constructor(dataPath) {
    this.dataPath    = dataPath
    this.arquivoLic  = path.join(dataPath, 'licenca.json')
    this.licenca     = this._carregar()
  }

  _carregar() {
    try {
      if (fs.existsSync(this.arquivoLic))
        return JSON.parse(fs.readFileSync(this.arquivoLic, 'utf8'))
    } catch {}
    return null
  }

  _salvar(dados) {
    fs.mkdirSync(this.dataPath, { recursive: true })
    fs.writeFileSync(this.arquivoLic, JSON.stringify(dados, null, 2))
    this.licenca = dados
  }

  // ── Beta 7 dias ───────────────────────────────────────────────────────────

  iniciarBeta(email) {
    if (this.licenca) return { ok: false, msg: 'Licença já existe' }
    const dados = {
      tipo:      'beta',
      email:     email.toLowerCase().trim(),
      inicio:    new Date().toISOString(),
      expira:    new Date(Date.now() + 7 * 24 * 3600000).toISOString(),
      chave:     null,
      plano:     'beta',
      ativo:     true
    }
    this._salvar(dados)
    return { ok: true, expira: dados.expira, diasRestantes: 7 }
  }

  // ── Validar licença ───────────────────────────────────────────────────────

  validar() {
    if (!this.licenca) return { valida: false, motivo: 'sem-licenca' }

    const agora  = new Date()
    const expira = new Date(this.licenca.expira)

    if (!this.licenca.ativo)   return { valida: false, motivo: 'desativada' }
    if (agora > expira)        return { valida: false, motivo: 'expirada', expirou: this.licenca.expira }

    const diasRestantes = Math.ceil((expira - agora) / 86400000)
    return {
      valida: true,
      tipo:   this.licenca.tipo,
      plano:  this.licenca.plano,
      email:  this.licenca.email,
      expira: this.licenca.expira,
      diasRestantes,
      aviso:  diasRestantes <= 3 ? `Sua licença expira em ${diasRestantes} dia(s)` : null
    }
  }

  // ── Ativar por chave (Hotmart / Kiwify / manual) ─────────────────────────

  async ativarPorChave(chave, email) {
    chave = chave.trim().toUpperCase()

    // Formato esperado: ZAPBOT-XXXX-XXXX-XXXX
    if (!/^ZAPBOT-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(chave)) {
      return { ok: false, msg: 'Formato de chave inválido. Ex: ZAPBOT-ABCD-1234-EFGH' }
    }

    // Valida a chave no servidor (se configurado)
    const validado = await this._validarChaveRemota(chave, email)
    if (!validado.ok) return validado

    const dados = {
      tipo:    'pago',
      email:   email.toLowerCase().trim(),
      chave,
      plano:   validado.plano || 'profissional',
      inicio:  new Date().toISOString(),
      expira:  validado.expira || new Date(Date.now() + 365 * 24 * 3600000).toISOString(),
      ativo:   true
    }
    this._salvar(dados)
    return { ok: true, plano: dados.plano, expira: dados.expira }
  }

  async _validarChaveRemota(chave, email) {
    // Se não há servidor de validação configurado, aceita localmente
    // Para integração real: chame sua API de licenças aqui
    const servidorValidacao = process.env.ZAPBOT_LICENSE_SERVER
    if (!servidorValidacao) {
      // Validação local via hash (para distribuição sem servidor)
      return this._validarChaveLocal(chave)
    }

    return new Promise((resolve) => {
      const dados = JSON.stringify({ chave, email })
      const url   = new URL(servidorValidacao)
      const mod   = url.protocol === 'https:' ? https : http
      const req   = mod.request({
        hostname: url.hostname, port: url.port,
        path: url.pathname, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': dados.length }
      }, (res) => {
        let body = ''
        res.on('data', d => body += d)
        res.on('end', () => {
          try { resolve(JSON.parse(body)) }
          catch { resolve({ ok: false, msg: 'Erro ao validar com servidor' }) }
        })
      })
      req.on('error', () => resolve(this._validarChaveLocal(chave)))
      req.write(dados)
      req.end()
    })
  }

  _validarChaveLocal(chave) {
    // Validação por checksum: last 4 chars = hash dos primeiros 14
    const partes    = chave.split('-')   // ['ZAPBOT','XXXX','XXXX','XXXX']
    const corpo     = partes.slice(0,3).join('-')
    const checksum  = partes[3]
    const esperado  = crypto.createHash('sha256').update(corpo + 'zapbot-salt-2025').digest('hex').slice(0,4).toUpperCase()
    if (checksum !== esperado) return { ok: false, msg: 'Chave de licença inválida' }

    // Decode plano do segundo bloco
    const planos = { 'BASI': 'basico', 'PROF': 'profissional', 'AGEN': 'agencia' }
    const plano  = planos[partes[1]] || 'profissional'
    const expira = new Date(Date.now() + 365 * 24 * 3600000).toISOString()
    return { ok: true, plano, expira }
  }

  // ── Webhook de pagamento (Hotmart / Kiwify / Stripe) ─────────────────────

  processarWebhookPagamento(payload, plataforma = 'hotmart') {
    try {
      let email, status, plano

      if (plataforma === 'hotmart') {
        email  = payload?.data?.buyer?.email
        status = payload?.event
        plano  = payload?.data?.product?.name?.toLowerCase().includes('agencia') ? 'agencia'
               : payload?.data?.product?.name?.toLowerCase().includes('profis')  ? 'profissional'
               : 'basico'
      } else if (plataforma === 'kiwify') {
        email  = payload?.Customer?.email
        status = payload?.order_status
        plano  = payload?.Product?.product_name?.toLowerCase().includes('agencia') ? 'agencia' : 'profissional'
      } else if (plataforma === 'stripe') {
        email  = payload?.data?.object?.customer_email
        status = payload?.type
        plano  = 'profissional'
      }

      const aprovado = ['PURCHASE_COMPLETE','approved','payment_intent.succeeded','checkout.session.completed'].includes(status)
      const cancelado = ['PURCHASE_CANCELED','refunded','charge.refunded'].includes(status)

      if (aprovado && email) {
        const chave = this._gerarChave(plano)
        return { ok: true, acao: 'ativado', email, plano, chave }
      }
      if (cancelado && this.licenca?.email === email) {
        this.licenca.ativo = false
        this._salvar(this.licenca)
        return { ok: true, acao: 'cancelado' }
      }
      return { ok: false, msg: 'Evento não reconhecido' }
    } catch (e) {
      return { ok: false, msg: e.message }
    }
  }

  _gerarChave(plano = 'profissional') {
    const prefixos = { basico: 'BASI', profissional: 'PROF', agencia: 'AGEN' }
    const p1  = prefixos[plano] || 'PROF'
    const p2  = crypto.randomBytes(2).toString('hex').toUpperCase()
    const corpo = `ZAPBOT-${p1}-${p2}`
    const check = crypto.createHash('sha256').update(corpo + 'zapbot-salt-2025').digest('hex').slice(0,4).toUpperCase()
    return `${corpo}-${check}`
  }

  // ── Info para o painel ────────────────────────────────────────────────────

  getInfo() {
    const v = this.validar()
    return {
      ...v,
      licenca: this.licenca,
      gerarNovaChave: (plano) => this._gerarChave(plano)
    }
  }

  desativar() {
    if (this.licenca) { this.licenca.ativo = false; this._salvar(this.licenca) }
  }
}

const instancias = new Map()
function getLicenca(dataPath) {
  if (!instancias.has(dataPath)) instancias.set(dataPath, new GerenciadorLicenca(dataPath))
  return instancias.get(dataPath)
}

module.exports = { GerenciadorLicenca, getLicenca }
