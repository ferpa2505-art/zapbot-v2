/**
 * retomada.js
 * Verifica periodicamente as conversas em que o bot falou por último e a cliente
 * não respondeu, e dispara um lembrete gentil pra tentar reengajar — até 3
 * tentativas, com espaçamento crescente pra não parecer insistência.
 *
 * Hoje calibrado só pro fuso de vendas Brasil (America/Sao_Paulo, único mercado
 * ativo). Quando vocês começarem a vender pra outros fusos, dá pra estender essa
 * lógica associando um fuso por região/DDD e ajustando os horários de disparo.
 */
const conversas = require('./conversas')
const lembretes = require('./lembretes')
const pausas    = require('./pausas')

// Limiares de silêncio (em horas) desde a última mensagem do bot, um por tentativa.
// Tentativa 1: 4h de silêncio | Tentativa 2: +24h (28h no total) | Tentativa 3: +48h (76h no total).
const LIMIARES_HORAS = [4, 28, 76]

const MENSAGENS = [
  'Oi! Passando aqui só pra saber se ficou alguma dúvida 🙂 Qualquer coisa, é só me chamar!',
  'Oi de novo! Ainda estou por aqui caso queira continuar de onde paramos 💚',
  'Não quero incomodar — só deixando aqui: se quiser retomar nossa conversa, é só me chamar quando puder 🙂'
]

function horasDesde(isoString) {
  if (!isoString) return Infinity
  return (Date.now() - new Date(isoString).getTime()) / 3600000
}

async function verificarEDisparar(sock, dataPath) {
  let resumos = []
  try { resumos = conversas.listarResumo(dataPath) } catch (e) {
    console.error('[retomada] falha ao listar conversas:', e.message)
    return
  }

  for (const resumo of resumos) {
    const nomeSeguro = resumo.jid
    const lista = conversas.obter(dataPath, nomeSeguro)
    if (!lista.length) continue

    const ultima = lista[lista.length - 1]
    if (ultima.role !== 'assistant') continue // cliente já respondeu por último — nada a fazer

    const jid = conversas.jidReal(dataPath, nomeSeguro)
    if (!jid) continue // conversa antiga sem jid indexado — não arriscamos mandar pro lugar errado

    if (pausas.estaPausada(dataPath, jid)) continue // atendimento manual em andamento

    const estado = lembretes.obter(dataPath, jid)
    if (estado.fechado || estado.esgotado) continue

    const proximaTentativa = (estado.tentativas || 0) + 1
    if (proximaTentativa > LIMIARES_HORAS.length) continue

    const limiar = LIMIARES_HORAS[proximaTentativa - 1]
    if (horasDesde(ultima.hora) < limiar) continue

    const mensagem = MENSAGENS[proximaTentativa - 1]
    try {
      await sock.sendMessage(jid, { text: mensagem })
      conversas.adicionar(dataPath, jid, 'assistant', mensagem)
      lembretes.registrarEnvio(dataPath, jid, proximaTentativa, LIMIARES_HORAS.length)
    } catch (e) {
      console.error(`[retomada] falha ao enviar lembrete pra ${jid}:`, e.message)
    }
  }
}

// intervaloHoras: de quanto em quanto tempo a checagem roda (não confundir com os
// limiares de silêncio acima). Padrão 6h = 4x/dia, dentro da faixa de 2-5x/dia pedida.
function iniciar(sock, dataPath, intervaloHoras = 6) {
  const executar = () => verificarEDisparar(sock, dataPath).catch(e => console.error('[retomada] erro na checagem:', e.message))
  executar() // roda uma vez já ao iniciar, sem esperar o primeiro intervalo inteiro
  const handle = setInterval(executar, intervaloHoras * 60 * 60 * 1000)
  return { parar: () => clearInterval(handle) }
}

module.exports = { iniciar, verificarEDisparar }