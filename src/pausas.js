/**
 * pausas.js
 * Controla quais conversas estão "pausadas" — quando pausada, o bot continua
 * salvando as mensagens (pro histórico), mas NÃO responde automaticamente.
 * Ideal pra quando um humano já está atendendo manualmente e não quer
 * o bot interferindo.
 */

const fs   = require('fs')
const path = require('path')

function arquivo(dataPath) {
  return path.join(dataPath, 'pausadas.json')
}

function carregar(dataPath) {
  try { return JSON.parse(fs.readFileSync(arquivo(dataPath), 'utf8')) } catch { return [] }
}

function salvar(dataPath, lista) {
  fs.mkdirSync(dataPath, { recursive: true })
  fs.writeFileSync(arquivo(dataPath), JSON.stringify(lista, null, 2))
}

function numeroParaJid(numero = '') {
  const limpo = String(numero).replace(/\D/g, '')
  return limpo ? `${limpo}@s.whatsapp.net` : ''
}

function pausar(dataPath, numeroOuJid) {
  const jid = numeroOuJid.includes('@') ? numeroOuJid : numeroParaJid(numeroOuJid)
  if (!jid) return { ok: false, msg: 'Número inválido' }
  const lista = carregar(dataPath)
  if (!lista.includes(jid)) lista.push(jid)
  salvar(dataPath, lista)
  return { ok: true, jid }
}

function retomar(dataPath, jid) {
  const lista = carregar(dataPath).filter(j => j !== jid)
  salvar(dataPath, lista)
  return { ok: true }
}

function estaPausada(dataPath, jid) {
  return carregar(dataPath).includes(jid)
}

function listar(dataPath) {
  return carregar(dataPath)
}

module.exports = { pausar, retomar, estaPausada, listar, numeroParaJid }
