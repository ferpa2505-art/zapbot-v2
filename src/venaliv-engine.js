/**
 * venaliv-engine.js
 * "Cérebro" do atendimento Venaliv — usa o roteiro completo (assets/roteiro-venaliv.md)
 * como instrução para a Claude API e espera resposta em JSON estruturado.
 *
 * O roteiro fica em dataPath (pasta de dados do usuário), não dentro do app empacotado —
 * assim dá pra editar objeções/textos só editando o .md, sem precisar reempacotar o app.
 */

const fs    = require('fs')
const path  = require('path')
const https = require('https')

const CLAUDE_MODEL = 'claude-sonnet-5' // trocado de claude-opus-4-5: Sonnet é bem mais barato e cobre bem esse tipo de tarefa (seguir roteiro definido)

// ── Garantir que o roteiro existe na pasta de dados do usuário ──────────────
function garantirRoteiro(dataPath, assetsPath) {
  const destino = path.join(dataPath, 'roteiro-venaliv.md')
  if (!fs.existsSync(destino)) {
    const origem = path.join(assetsPath, 'roteiro-venaliv.md')
    fs.mkdirSync(dataPath, { recursive: true })
    if (fs.existsSync(origem)) fs.copyFileSync(origem, destino)
    else fs.writeFileSync(destino, '# Roteiro Venaliv não encontrado — edite este arquivo manualmente.')
  }
  return destino
}

function carregarRoteiro(dataPath, assetsPath) {
  const caminho = garantirRoteiro(dataPath, assetsPath)
  try { return fs.readFileSync(caminho, 'utf8') }
  catch { return '' }
}

// ── Extrai o primeiro bloco JSON válido de um texto de resposta ─────────────
function extrairJSON(texto) {
  const match = texto.match(/\{[\s\S]*\}/)
  if (!match) return null
  try { return JSON.parse(match[0]) } catch { return null }
}

// ── Chamada à API Claude, com o roteiro completo como system prompt ─────────
// systemBlocks: array de blocos de texto — o roteiro fica marcado com cache_control
// pra a Anthropic reaproveitar (custo bem menor) enquanto o texto não mudar entre chamadas.
function chamarClaude(apiKey, systemBlocks, mensagens, maxTokens = 8000) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      system: systemBlocks,
      messages: mensagens
    })

    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      const chunks = []
      res.on('data', d => chunks.push(d))
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8')
        try {
          const json = JSON.parse(body)
          const bloco = json.content?.find(b => b.type === 'text')
          const texto = bloco?.text
          if (texto) resolve(texto)
          else reject(new Error(json.error?.message || `Erro na API Claude (status ${res.statusCode}): ${body.slice(0, 500)}`))
        } catch (e) {
          reject(new Error(`Erro na API Claude — resposta não é JSON válido (status ${res.statusCode}): ${body.slice(0, 500)}`))
        }
      })
    })
    req.on('error', reject)
    req.write(payload)
    req.end()
  })
}

/**
 * Processa uma mensagem da cliente usando o roteiro Venaliv.
 * Retorna um objeto de ação normalizado, sempre com pelo menos { acao, texto }.
 *
 * contextoExtra (opcional): texto extra anexado ao system prompt só nessa chamada —
 * usado, por exemplo, pra informar o endereço real consultado via ViaCEP quando a
 * cliente manda um CEP, evitando que a IA "adivinhe" rua/bairro/cidade errados.
 */
async function processarMensagem({ apiKey, dataPath, assetsPath, mensagemTexto, historico = [], contextoExtra = '' }) {
  const roteiro = carregarRoteiro(dataPath, assetsPath)

  const instrucaoFormato = `\n\nIMPORTANTE: responda SEMPRE em JSON puro (sem texto antes ou depois, sem markdown), seguindo exatamente o formato descrito na seção 6 do roteiro acima. O campo "texto" deve conter a mensagem a ser enviada pra cliente, já pronta, sem placeholders.`

  // Bloco 1 (roteiro): marcado como cacheável — é grande e não muda entre mensagens da
  // mesma conversa, então a Anthropic cobra bem menos nas chamadas seguintes.
  // Bloco 2 (instrução + contexto extra do CEP): pequeno e pode variar a cada turno, fica de fora do cache.
  const systemBlocks = [
    { type: 'text', text: roteiro, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: instrucaoFormato + contextoExtra }
  ]

  const mensagens = [
    ...historico.slice(-14),
    { role: 'user', content: mensagemTexto }
  ]

  let respostaBruta
  try {
    respostaBruta = await chamarClaude(apiKey, systemBlocks, mensagens)
  } catch (e) {
    console.error('[venaliv-engine] Falha ao chamar a API Claude:', e.message)
    return { acao: 'escalar_humano', texto: 'Deixa eu confirmar isso com a equipe e já te retorno!', erro: e.message }
  }

  const parsed = extrairJSON(respostaBruta)
  if (!parsed) {
    // Fallback: se a IA não respondeu em JSON, trata a resposta inteira como texto livre
    return { acao: 'responder_texto', texto: respostaBruta.trim() }
  }
  return parsed
}

module.exports = { processarMensagem, carregarRoteiro, garantirRoteiro }