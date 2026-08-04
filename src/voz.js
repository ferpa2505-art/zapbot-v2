/**
 * voz.js
 * Google Text-to-Speech + envio de áudio via WhatsApp (Baileys)
 * Suporte a: gênero, sotaque por estado/região, velocidade, pitch
 */

const https = require('https')
const fs    = require('fs')
const path  = require('path')
const os    = require('os')

// ── Mapeamento de sotaques por estado/região ──────────────────────────────────
const SOTAQUES = {
  // Regiões
  sudeste:     { languageCode: 'pt-BR', nome: 'Sudeste (padrão)' },
  sul:         { languageCode: 'pt-BR', nome: 'Sul', speakingRate: 0.95 },
  nordeste:    { languageCode: 'pt-BR', nome: 'Nordeste', pitch: 1.5, speakingRate: 1.05 },
  norte:       { languageCode: 'pt-BR', nome: 'Norte', speakingRate: 0.97 },
  'centro-oeste': { languageCode: 'pt-BR', nome: 'Centro-Oeste' },

  // Estados principais
  sp:  { languageCode: 'pt-BR', nome: 'São Paulo',         speakingRate: 1.05 },
  rj:  { languageCode: 'pt-BR', nome: 'Rio de Janeiro',    pitch: 0.5 },
  mg:  { languageCode: 'pt-BR', nome: 'Minas Gerais',      speakingRate: 0.93, pitch: -0.5 },
  rs:  { languageCode: 'pt-BR', nome: 'Rio Grande do Sul', speakingRate: 0.92 },
  sc:  { languageCode: 'pt-BR', nome: 'Santa Catarina',    speakingRate: 0.94 },
  pr:  { languageCode: 'pt-BR', nome: 'Paraná',            speakingRate: 0.95 },
  ba:  { languageCode: 'pt-BR', nome: 'Bahia',             pitch: 2.0, speakingRate: 1.0  },
  pe:  { languageCode: 'pt-BR', nome: 'Pernambuco',        pitch: 1.5, speakingRate: 1.05 },
  ce:  { languageCode: 'pt-BR', nome: 'Ceará',             pitch: 1.0, speakingRate: 1.02 },
  go:  { languageCode: 'pt-BR', nome: 'Goiás',             speakingRate: 1.0  },
  df:  { languageCode: 'pt-BR', nome: 'Brasília/DF',       speakingRate: 1.0  },
  am:  { languageCode: 'pt-BR', nome: 'Amazonas',          speakingRate: 0.95 },
  pa:  { languageCode: 'pt-BR', nome: 'Pará',              speakingRate: 0.97 },

  // Internacional
  portugal: { languageCode: 'pt-PT', nome: 'Português (Portugal)' },
  en:       { languageCode: 'en-US', nome: 'Inglês (EUA)'         },
  es:       { languageCode: 'es-ES', nome: 'Espanhol'             },
}

// ── Vozes por gênero e idioma ─────────────────────────────────────────────────
const VOZES = {
  'pt-BR': {
    feminino:  ['pt-BR-Wavenet-A', 'pt-BR-Wavenet-C', 'pt-BR-Standard-A'],
    masculino: ['pt-BR-Wavenet-B', 'pt-BR-Wavenet-E', 'pt-BR-Standard-B'],
  },
  'pt-PT': {
    feminino:  ['pt-PT-Wavenet-A', 'pt-PT-Standard-A'],
    masculino: ['pt-PT-Wavenet-B', 'pt-PT-Standard-B'],
  },
  'en-US': {
    feminino:  ['en-US-Wavenet-F', 'en-US-Standard-C'],
    masculino: ['en-US-Wavenet-D', 'en-US-Standard-B'],
  },
  'es-ES': {
    feminino:  ['es-ES-Wavenet-C', 'es-ES-Standard-A'],
    masculino: ['es-ES-Wavenet-B', 'es-ES-Standard-B'],
  },
}

class ServicoVoz {
  constructor(apiKey) {
    this.apiKey  = apiKey
    this.tmpDir  = os.tmpdir()
  }

  // ── Sintetizar texto → buffer OGG (formato que WhatsApp aceita como PTT) ──

  async sintetizar(texto, opcoes = {}) {
    const {
      genero    = 'feminino',
      sotaque   = 'sp',
      velocidade = 1.0,
      pitch      = 0.0,
      idioma    = 'pt-BR'
    } = opcoes

    const sotaqueConf  = SOTAQUES[sotaque] || SOTAQUES.sp
    const languageCode = sotaqueConf.languageCode || idioma
    const vozesList    = VOZES[languageCode] || VOZES['pt-BR']
    const vozNome      = (vozesList[genero] || vozesList.feminino)[0]

    const speakingRate = (sotaqueConf.speakingRate || 1.0) * velocidade
    const pitchFinal   = (sotaqueConf.pitch || 0.0) + pitch

    // Limita texto (Google TTS: máx 5000 chars)
    const textoLimitado = texto.slice(0, 4800)

    const payload = JSON.stringify({
      input:        { text: textoLimitado },
      voice:        { languageCode, name: vozNome, ssmlGender: genero === 'masculino' ? 'MALE' : 'FEMALE' },
      audioConfig:  { audioEncoding: 'OGG_OPUS', speakingRate: Math.min(Math.max(speakingRate, 0.25), 4.0), pitch: Math.min(Math.max(pitchFinal, -20), 20) }
    })

    const audioBase64 = await this._chamarAPI(payload)
    return Buffer.from(audioBase64, 'base64')
  }

  // ── Enviar como mensagem de voz (PTT) no WhatsApp ─────────────────────────

  async enviarComoVoz(sock, jid, texto, opcoes = {}) {
    if (!this.apiKey) throw new Error('API Key do Google TTS não configurada')

    const buffer   = await this.sintetizar(texto, opcoes)
    const tmpFile  = path.join(this.tmpDir, `zapbot-voz-${Date.now()}.ogg`)
    fs.writeFileSync(tmpFile, buffer)

    try {
      await sock.sendMessage(jid, {
        audio:    { url: tmpFile },
        mimetype: 'audio/ogg; codecs=opus',
        ptt:      true   // push-to-talk = aparece como mensagem de voz
      })
    } finally {
      try { fs.unlinkSync(tmpFile) } catch {}
    }
  }

  // ── Enviar texto + voz juntos ─────────────────────────────────────────────

  async enviarTextoEVoz(sock, jid, texto, opcoes = {}) {
    // Envia texto primeiro, depois áudio
    await sock.sendMessage(jid, { text: texto })
    await new Promise(r => setTimeout(r, 500))
    await this.enviarComoVoz(sock, jid, texto, opcoes)
  }

  _chamarAPI(payload) {
    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'texttospeech.googleapis.com',
        path:     `/v1/text:synthesize?key=${this.apiKey}`,
        method:   'POST',
        headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
      }, (res) => {
        let body = ''
        res.on('data', d => body += d)
        res.on('end', () => {
          try {
            const json = JSON.parse(body)
            if (json.audioContent) resolve(json.audioContent)
            else reject(new Error(json.error?.message || 'Erro na API Google TTS'))
          } catch (e) { reject(e) }
        })
      })
      req.on('error', reject)
      req.write(payload)
      req.end()
    })
  }

  // ── Verificar se API está funcionando ────────────────────────────────────

  async testar() {
    try {
      await this.sintetizar('Teste do ZapBot.', { sotaque: 'sp', genero: 'feminino' })
      return { ok: true }
    } catch (e) {
      return { ok: false, msg: e.message }
    }
  }

  static listarSotaques() {
    return Object.entries(SOTAQUES).map(([id, c]) => ({ id, nome: c.nome, idioma: c.languageCode }))
  }
}

module.exports = { ServicoVoz, SOTAQUES, VOZES }
