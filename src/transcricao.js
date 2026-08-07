/**
 * transcricao.js
 * Transcrição de áudio (voz do cliente) usando a API Whisper da OpenAI.
 * Requer Node 18+ (usa fetch, FormData e Blob nativos — já disponíveis no
 * Electron ^33 usado pelo projeto).
 */

class ServicoTranscricao {
  constructor(apiKey) {
    this.apiKey = apiKey || ''
  }

  temApiKey() {
    return !!this.apiKey
  }

  /**
   * Transcreve um buffer de áudio (ex: baixado via downloadMediaMessage do Baileys)
   * e retorna o texto reconhecido.
   * @param {Buffer} buffer - áudio bruto (Baileys entrega OGG/Opus para mensagens de voz)
   * @param {Object} opcoes - { idioma: 'pt' }
   */
  async transcrever(buffer, opcoes = {}) {
    if (!this.apiKey) throw new Error('API Key da OpenAI não configurada')
    const { idioma = 'pt' } = opcoes

    const form = new FormData()
    form.append('file', new Blob([buffer], { type: 'audio/ogg' }), 'audio.ogg')
    form.append('model', 'whisper-1')
    form.append('language', idioma)

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.apiKey}` },
      body: form
    })

    if (!res.ok) {
      const corpoErro = await res.text().catch(() => '')
      throw new Error(`Whisper API erro ${res.status}: ${corpoErro.slice(0, 200)}`)
    }

    const data = await res.json()
    return (data.text || '').trim()
  }

  // Verifica se a chave é válida, sem gastar com transcrição de verdade.
  async testar() {
    try {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      })
      if (!res.ok) return { ok: false, msg: `Erro ${res.status} — confira a chave` }
      return { ok: true }
    } catch (e) {
      return { ok: false, msg: e.message }
    }
  }
}

module.exports = { ServicoTranscricao }