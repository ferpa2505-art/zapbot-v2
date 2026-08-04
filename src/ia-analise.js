/**
 * ia-analise.js
 * Análise de imagens e PDFs via Claude (Anthropic API)
 * Recebe mídias do WhatsApp e retorna análise em texto (ou voz)
 */

const https = require('https')
const fs    = require('fs')

const CLAUDE_MODEL = 'claude-opus-4-5'

class AnalisadorIA {
  constructor(apiKey) {
    this.apiKey = apiKey
  }

  // ── Analisar imagem (buffer ou base64) ───────────────────────────────────

  async analisarImagem(imagemBuffer, promptExtra = '', contextoNegocio = {}) {
    const base64     = imagemBuffer.toString('base64')
    const mediaType  = this._detectarMimeImagem(imagemBuffer)

    const sistemaPrompt = this._buildSistema(contextoNegocio)
    const instrucao = promptExtra ||
      `Analise esta imagem e descreva o que você vê de forma útil para o contexto de ${contextoNegocio.tipo || 'atendimento ao cliente'}. ` +
      `Se for um documento, produto, exame ou comprovante, extraia as informações mais importantes. ` +
      `Se for uma foto de problema ou defeito, descreva o que está errado. ` +
      `Responda de forma direta e em ${contextoNegocio.idioma || 'português brasileiro'}.`

    const mensagens = [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
        { type: 'text', text: instrucao }
      ]
    }]

    return this._chamarClaude(sistemaPrompt, mensagens)
  }

  // ── Analisar PDF (buffer) ─────────────────────────────────────────────────

  async analisarPDF(pdfBuffer, promptExtra = '', contextoNegocio = {}) {
    const base64 = pdfBuffer.toString('base64')

    const sistemaPrompt = this._buildSistema(contextoNegocio)
    const instrucao = promptExtra ||
      `Analise este documento PDF e extraia as informações mais relevantes para ${contextoNegocio.nome || 'o atendimento'}. ` +
      `Se for um contrato, destaque cláusulas importantes. ` +
      `Se for um laudo ou exame, resuma os resultados principais. ` +
      `Se for uma nota fiscal, extraia valores e itens. ` +
      `Seja claro e objetivo. Responda em ${contextoNegocio.idioma || 'português brasileiro'}.`

    const mensagens = [{
      role: 'user',
      content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
        { type: 'text', text: instrucao }
      ]
    }]

    return this._chamarClaude(sistemaPrompt, mensagens)
  }

  // ── Analisar com contexto de conversa ─────────────────────────────────────

  async analisarComContexto(midia, tipoMidia, historico = [], perguntaUsuario = '', contextoNegocio = {}) {
    const base64    = midia.toString('base64')
    const mediaType = tipoMidia === 'pdf' ? 'application/pdf'
                    : this._detectarMimeImagem(midia)

    const sistemaPrompt = this._buildSistema(contextoNegocio)

    // Monta histórico de mensagens
    const mensagens = historico.slice(-6).map(h => ({
      role: h.role, content: h.content
    }))

    // Adiciona a mídia + pergunta atual
    const conteudoAtual = []
    if (tipoMidia === 'pdf') {
      conteudoAtual.push({ type: 'document', source: { type: 'base64', media_type: mediaType, data: base64 } })
    } else {
      conteudoAtual.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } })
    }
    conteudoAtual.push({ type: 'text', text: perguntaUsuario || 'O que você vê neste arquivo? Como posso ajudar?' })

    mensagens.push({ role: 'user', content: conteudoAtual })

    return this._chamarClaude(sistemaPrompt, mensagens)
  }

  // ── Gerar resposta de texto com personalidade ─────────────────────────────

  async gerarResposta(mensagem, historico = [], contextoNegocio = {}, personalidade = {}) {
    const sistemaPrompt = this._buildSistema(contextoNegocio, personalidade)

    const mensagens = [
      ...historico.slice(-10).map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: mensagem }
    ]

    return this._chamarClaude(sistemaPrompt, mensagens, 600)
  }

  // ── Build do system prompt com personalidade ──────────────────────────────

  _buildSistema(negocio = {}, personalidade = {}) {
    const {
      nome       = 'Assistente',
      nomeEmpresa= 'nossa empresa',
      tipo       = 'geral',
      idioma     = 'português brasileiro',
      sotaque    = 'sp',
      tom        = 'profissional',
      jargoes    = [],
      horario    = '',
      endereco   = '',
      responsavel= ''
    } = { ...negocio, ...personalidade }

    const TONS = {
      profissional: 'Seja formal, cordial e preciso. Use linguagem profissional.',
      casual:       'Seja descontraído e amigável, como um amigo prestativo. Use linguagem simples.',
      tecnico:      'Seja técnico e preciso. Use terminologia especializada do setor.',
      descolado:    'Seja jovial, use gírias moderadas e seja bem-humorado. Emojis são bem-vindos.',
      formal:       'Seja extremamente formal. Evite contrações e gírias.',
      acolhedor:    'Seja empático, caloroso e atencioso. Demonstre cuidado genuíno.',
    }

    const JARGOES_SEGMENTO = {
      medico:      ['paciente', 'consulta', 'prontuário', 'retorno', 'encaminhamento', 'triagem'],
      dentista:    ['paciente', 'restauração', 'limpeza', 'prótese', 'ortodontia', 'extração'],
      advogado:    ['cliente', 'processo', 'diligência', 'petição', 'audiência', 'contrato'],
      imobiliaria: ['imóvel', 'visita', 'proposta', 'escritura', 'financiamento', 'condomínio'],
      loja:        ['produto', 'estoque', 'entrega', 'pedido', 'orçamento', 'garantia'],
      restaurante: ['reserva', 'cardápio', 'mesa', 'delivery', 'pedido', 'chef'],
      salao:       ['horário', 'profissional', 'serviço', 'coloração', 'corte', 'manicure'],
    }

    const jargoesFinal = [...(jargoes || []), ...(JARGOES_SEGMENTO[tipo] || [])]
    const instrucaoTom = TONS[tom] || TONS.profissional

    return `Você é ${nome}, assistente virtual de ${nomeEmpresa} (${tipo}).
${instrucaoTom}
Responda sempre em ${idioma}.
${jargoesFinal.length ? `Use naturalmente os termos do setor: ${jargoesFinal.slice(0,8).join(', ')}.` : ''}
${horario   ? `Horário de funcionamento: ${horario}.` : ''}
${endereco  ? `Endereço: ${endereco}.` : ''}
${responsavel ? `Responsável: ${responsavel}.` : ''}
Seja conciso (máx 3 parágrafos). Não invente informações. Se não souber, diga que vai verificar.
Nunca revele que é uma IA a menos que perguntado diretamente.`.trim()
  }

  // ── Chamada à API Claude ──────────────────────────────────────────────────

  _chamarClaude(sistemaPrompt, mensagens, maxTokens = 1000) {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify({
        model:      CLAUDE_MODEL,
        max_tokens: maxTokens,
        system:     sistemaPrompt,
        messages:   mensagens
      })

      const req = https.request({
        hostname: 'api.anthropic.com',
        path:     '/v1/messages',
        method:   'POST',
        headers:  {
          'Content-Type':      'application/json',
          'x-api-key':         this.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Length':    Buffer.byteLength(payload)
        }
      }, (res) => {
        let body = ''
        res.on('data', d => body += d)
        res.on('end', () => {
          try {
            const json = JSON.parse(body)
            const texto = json.content?.[0]?.text
            if (texto) resolve(texto)
            else reject(new Error(json.error?.message || 'Erro na API Claude'))
          } catch (e) { reject(e) }
        })
      })
      req.on('error', reject)
      req.write(payload)
      req.end()
    })
  }

  _detectarMimeImagem(buffer) {
    const hex = buffer.slice(0, 4).toString('hex')
    if (hex.startsWith('ffd8'))   return 'image/jpeg'
    if (hex.startsWith('89504e47')) return 'image/png'
    if (hex.startsWith('47494638')) return 'image/gif'
    if (hex.startsWith('52494646')) return 'image/webp'
    return 'image/jpeg'
  }

  temApiKey() { return !!this.apiKey }
}

module.exports = { AnalisadorIA }
