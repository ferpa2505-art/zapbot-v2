/**
 * lembretes.js
 * Guarda, por cliente, quantas tentativas de "retomada" (lembrete de conversa
 * parada) já foram enviadas, pra retomada.js saber quando parar (máx. 3) e pra
 * zerar a contagem assim que a cliente responder de novo.
 */
const fs   = require('fs')
const path = require('path')

function arquivoEstado(dataPath) {
  return path.join(dataPath, 'lembretes-estado.json')
}

function carregarEstado(dataPath) {
  const arq = arquivoEstado(dataPath)
  if (!fs.existsSync(arq)) return {}
  try { return JSON.parse(fs.readFileSync(arq, 'utf8')) } catch { return {} }
}

function salvarEstado(dataPath, estado) {
  try { fs.writeFileSync(arquivoEstado(dataPath), JSON.stringify(estado, null, 2)) }
  catch (e) { console.error('[lembretes] erro ao salvar estado:', e.message) }
}

function obter(dataPath, jid) {
  const estado = carregarEstado(dataPath)
  return estado[jid] || { tentativas: 0, esgotado: false, fechado: false }
}

// Cliente respondeu de novo (ou é uma conversa nova) — zera a contagem de tentativas.
function resetar(dataPath, jid) {
  const estado = carregarEstado(dataPath)
  if (estado[jid]) { delete estado[jid]; salvarEstado(dataPath, estado) }
}

// Marca que o negócio fechou com essa cliente (aceite do termo confirmado) — a
// automação de retomada para de tentar reengajar, não faz mais sentido cutucar.
function marcarFechado(dataPath, jid) {
  const estado = carregarEstado(dataPath)
  estado[jid] = { ...(estado[jid] || { tentativas: 0 }), fechado: true }
  salvarEstado(dataPath, estado)
}

function registrarEnvio(dataPath, jid, numeroTentativa, maxTentativas) {
  const estado = carregarEstado(dataPath)
  estado[jid] = {
    ...(estado[jid] || {}),
    tentativas: numeroTentativa,
    esgotado: numeroTentativa >= maxTentativas
  }
  salvarEstado(dataPath, estado)
}

module.exports = { obter, resetar, marcarFechado, registrarEnvio }