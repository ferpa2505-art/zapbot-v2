/**
 * conversas.js
 * Guarda o histórico de conversas em disco (uma pasta por instalação),
 * pra permitir backup e limpeza manual/automática.
 *
 * NOTA: o nome do arquivo de cada conversa é uma versão "sanitizada" do jid
 * (troca @, . e outros caracteres por _) — isso não é reversível sozinho.
 * Por isso mantemos um pequeno índice (_index.json) mapeando nome sanitizado
 * -> jid real, usado por quem precisa mandar mensagem de volta pro cliente
 * (ex: retomada.js) sem depender de "adivinhar" o jid a partir do nome do arquivo.
 */
const fs   = require('fs')
const path = require('path')

function pastaConversas(dataPath) {
  const p = path.join(dataPath, 'conversas')
  fs.mkdirSync(p, { recursive: true })
  return p
}

function arquivoIndice(dataPath) {
  return path.join(pastaConversas(dataPath), '_index.json')
}

function carregarIndice(dataPath) {
  const arq = arquivoIndice(dataPath)
  if (!fs.existsSync(arq)) return {}
  try { return JSON.parse(fs.readFileSync(arq, 'utf8')) } catch { return {} }
}

function atualizarIndice(dataPath, nomeSeguro, jid) {
  try {
    const indice = carregarIndice(dataPath)
    if (indice[nomeSeguro] === jid) return // já está certo, evita escrita à toa
    indice[nomeSeguro] = jid
    fs.writeFileSync(arquivoIndice(dataPath), JSON.stringify(indice, null, 2))
  } catch (e) { console.error('[conversas] erro ao atualizar índice de jids:', e.message) }
}

// Dado o nome sanitizado (o que aparece em listarJids/listarResumo), retorna o jid
// real do WhatsApp — necessário pra mandar mensagem de volta. Retorna null se não
// encontrar no índice (ex: conversa muito antiga, salva antes dessa correção).
function jidReal(dataPath, nomeSeguro) {
  const indice = carregarIndice(dataPath)
  return indice[nomeSeguro] || null
}

function arquivoDe(dataPath, jid) {
  const nomeSeguro = jid.replace(/[^a-zA-Z0-9]/g, '_')
  return path.join(pastaConversas(dataPath), `${nomeSeguro}.json`)
}

function adicionar(dataPath, jid, role, texto) {
  try {
    const arq = arquivoDe(dataPath, jid)
    let lista = []
    if (fs.existsSync(arq)) { try { lista = JSON.parse(fs.readFileSync(arq, 'utf8')) } catch { lista = [] } }
    lista.push({ role, texto, hora: new Date().toISOString() })
    fs.writeFileSync(arq, JSON.stringify(lista, null, 2))
    const nomeSeguro = jid.replace(/[^a-zA-Z0-9]/g, '_')
    atualizarIndice(dataPath, nomeSeguro, jid)
  } catch (e) { console.error('[conversas] erro ao salvar:', e.message) }
}

function listarJids(dataPath) {
  const p = pastaConversas(dataPath)
  return fs.readdirSync(p)
    .filter(f => f.endsWith('.json') && f !== '_index.json')
    .map(f => f.replace(/\.json$/, ''))
}

function obter(dataPath, jid) {
  const arq = arquivoDe(dataPath, jid)
  if (!fs.existsSync(arq)) return []
  try { return JSON.parse(fs.readFileSync(arq, 'utf8')) } catch { return [] }
}

function listarResumo(dataPath) {
  return listarJids(dataPath).map(nomeSeguro => {
    const arq = path.join(pastaConversas(dataPath), `${nomeSeguro}.json`)
    let lista = []
    try { lista = JSON.parse(fs.readFileSync(arq, 'utf8')) } catch {}
    const ultima = lista[lista.length - 1]
    return {
      jid: nomeSeguro,
      totalMensagens: lista.length,
      ultimaMensagem: ultima?.texto || '',
      ultimaHora: ultima?.hora || ''
    }
  }).sort((a, b) => (b.ultimaHora || '').localeCompare(a.ultimaHora || ''))
}

function limpar(dataPath, jidSeguro) {
  const arq = path.join(pastaConversas(dataPath), `${jidSeguro}.json`)
  if (fs.existsSync(arq)) fs.unlinkSync(arq)
  return { ok: true }
}

function limparTodas(dataPath) {
  const p = pastaConversas(dataPath)
  for (const f of fs.readdirSync(p)) {
    if (f.endsWith('.json') && f !== '_index.json') fs.unlinkSync(path.join(p, f))
  }
  return { ok: true }
}

function gerarBackupJSON(dataPath) {
  const resultado = {}
  for (const jidSeguro of listarJids(dataPath)) {
    const arq = path.join(pastaConversas(dataPath), `${jidSeguro}.json`)
    try { resultado[jidSeguro] = JSON.parse(fs.readFileSync(arq, 'utf8')) } catch { resultado[jidSeguro] = [] }
  }
  return JSON.stringify(resultado, null, 2)
}

function salvarBackupEmArquivo(dataPath) {
  const conteudo = gerarBackupJSON(dataPath)
  const nomeArquivo = `backup-conversas-${new Date().toISOString().slice(0, 10)}.json`
  const destino = path.join(dataPath, 'backups')
  fs.mkdirSync(destino, { recursive: true })
  const caminhoFinal = path.join(destino, nomeArquivo)
  fs.writeFileSync(caminhoFinal, conteudo)
  return caminhoFinal
}

module.exports = {
  adicionar, listarJids, obter, listarResumo,
  limpar, limparTodas, gerarBackupJSON, salvarBackupEmArquivo,
  jidReal
}