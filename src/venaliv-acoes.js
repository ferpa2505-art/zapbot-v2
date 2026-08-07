/**
 * venaliv-acoes.js
 * Executa a ação decidida pelo "cérebro" (venaliv-engine.js) mandando de fato
 * a mensagem certa pro WhatsApp via Baileys.
 *
 * ASSETS: mapa de id -> URL pública (Google Drive convertido para download direto, etc).
 * Preencha os que já têm link; os que ainda não têm ficam como null e o bot avisa
 * no console (não trava o atendimento, só não envia a mídia).
 */

const fs = require('fs')
const path = require('path')
const os = require('os')
const { BrowserWindow } = require('electron')

const ASSETS = {
  audios: {
    audio_1: 'https://drive.google.com/uc?export=download&id=1kXp85gIGqJI3t0C6I9FFuUYKeueKFFuP',
    audio_2: 'https://drive.google.com/uc?export=download&id=1l8eFKd8RTMHcep2sU-fEQlVyk8PUaJja',
    audio_3: 'https://drive.google.com/uc?export=download&id=13YhqMAR3HX-sqxKua4zmEghOGLuWh4kY',
    audio_4: 'https://drive.google.com/uc?export=download&id=1V7h_r1_xa3MQ2MnRCcVv5P8_YpHU9G1o',
  },
  imagens: {
    // TODO: preencher com os links do Drive assim que as imagens forem hospedadas
    antes_depois_lucimara: null,
    antes_depois_cassia: null,
    antes_depois_rosana: null,
    infografico_beneficios: null,
    instrucoes_de_uso: null,
    garantia_60_dias: null,
    autoridade_cnpj_anvisa: null,
  },
  videos: {
    // TODO: preencher com os links assim que os vídeos forem hospedados
    video_ugc_01: null,
    video_ugc_03: null,
  }
}

/**
 * ====== GERAÇÃO AUTOMÁTICA DO TERMO EM PDF ======
 * Preenche o template HTML (src/templates/termo-reconhecimento-divida-template.html)
 * com os dados coletados na conversa e gera um PDF real usando o Chromium
 * embutido no Electron (mesmo mecanismo do botão "Salvar como PDF" do site).
 *
 * Nomes dos campos conferidos contra a seção 6 do roteiro-venaliv.md (formato
 * de saída que a IA de fato retorna em dados_coletados): nome_completo, cpf,
 * whatsapp, cep, rua, numero, complemento, bairro, cidade, estado, email,
 * kit, valor, valor_extenso.
 */
const TEMPLATE_PATH = path.join(__dirname, 'templates', 'termo-reconhecimento-divida-template.html')
const OUTPUT_DIR = path.join(__dirname, 'termos-gerados')

function preencherTemplateTermo(dados = {}) {
  let html = fs.readFileSync(TEMPLATE_PATH, 'utf8')

  // Resolve o bloco condicional do complemento ({{#if endereco_complemento}}...{{/if}})
  const complemento = dados.complemento || ''
  html = html.replace(/{{#if endereco_complemento}}([\s\S]*?){{\/if}}/, complemento ? '$1' : '')

  const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })

  const campos = {
    nome_devedor: dados.nome_completo || '',
    cpf_devedor: dados.cpf || '',
    endereco_rua: dados.rua || '',
    endereco_numero: dados.numero || '',
    endereco_complemento: complemento,
    bairro: dados.bairro || '',
    cidade: dados.cidade || '',
    estado: dados.estado || '',
    cep: dados.cep || '',
    whatsapp: dados.whatsapp || '',
    produto_kit: dados.kit || '',
    valor: dados.valor || '',
    valor_por_extenso: dados.valor_extenso || '',
    data_emissao: agora,
  }

  for (const [chave, valor] of Object.entries(campos)) {
    html = html.split(`{{${chave}}}`).join(String(valor))
  }

  return html
}

async function gerarTermoPDF(dados = {}) {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  const htmlPreenchido = preencherTemplateTermo(dados)

  const nomeBase = (dados.nome_completo || 'termo').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  const carimbo = Date.now()
  const tempHtmlPath = path.join(os.tmpdir(), `venaliv-termo-${carimbo}.html`)
  const pdfPath = path.join(OUTPUT_DIR, `${nomeBase}-${carimbo}.pdf`)

  fs.writeFileSync(tempHtmlPath, htmlPreenchido, 'utf8')

  const win = new BrowserWindow({ show: false })
  try {
    await win.loadFile(tempHtmlPath)
    const pdfBuffer = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { marginType: 'none' },
    })
    fs.writeFileSync(pdfPath, pdfBuffer)
  } finally {
    win.close()
    fs.unlink(tempHtmlPath, () => {})
  }

  return pdfPath
}
/** ====== FIM DA GERAÇÃO DO TERMO ====== */

/**
 * Trava de segurança: remove qualquer marcador interno (ex: "[Áudio enviado: audio_3]")
 * que a IA eventualmente copie pro campo "texto" — esses marcadores são só pra uso
 * interno no histórico, nunca deveriam ir pro WhatsApp de verdade. Funciona mesmo que
 * o roteiro/prompt falhe em evitar isso.
 */
function limparMarcadoresInternos(texto) {
  return String(texto || '')
    .replace(/\[\s*(Áudio enviado|Imagem enviada|Vídeo enviado|Termo (gerado|solicitado)|Checkout de pagamento solicitado|Agendamento de entrega solicitado)[^\]]*\]/gi, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Manda um texto como várias mensagens separadas no WhatsApp (várias "bolhas"),
 * dividindo por linha em branco dupla — deixa a conversa com cara mais natural,
 * igual uma pessoa digitando várias mensagens curtas em vez de um texto corrido.
 */
async function enviarTextoEmPartes(sock, jid, texto) {
  const partes = String(texto || '').split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
  for (const parte of partes) {
    await sock.sendMessage(jid, { text: parte })
    if (partes.length > 1) await new Promise(r => setTimeout(r, 500 + Math.random() * 500))
  }
}

// Grupo/número interno pra onde os "escalar_humano" são notificados (configure no config.json)
async function notificarHumano(sock, canalInternoJid, contexto) {
  if (!canalInternoJid) return
  try {
    await sock.sendMessage(canalInternoJid, {
      text: `🔔 *Atenção necessária* — ${contexto.jidCliente}\n\nMotivo: ${contexto.motivo || 'não especificado'}\n\nÚltima mensagem da cliente: "${contexto.mensagemCliente || ''}"`
    })
  } catch (e) { console.error('[venaliv] Falha ao notificar canal interno:', e.message) }
}

async function executarAcao(sock, jid, acaoObj, opcoes = {}) {
  const { canalInternoJid } = opcoes
  const texto = limparMarcadoresInternos(acaoObj.texto)

  switch (acaoObj.acao) {
    case 'enviar_audio': {
      if (texto) await enviarTextoEmPartes(sock, jid, texto)
      const url = ASSETS.audios[acaoObj.audio_id]
      if (url) {
        try {
          await sock.sendMessage(jid, { audio: { url }, mimetype: 'audio/ogg; codecs=opus', ptt: true })
        } catch (e) {
          console.error(`[venaliv] Falha ao enviar áudio "${acaoObj.audio_id}":`, e.message)
        }
      } else {
        console.warn(`[venaliv] Áudio "${acaoObj.audio_id}" sem link configurado — pulei o envio.`)
      }
      break
    }

    case 'enviar_imagem': {
      const url = ASSETS.imagens[acaoObj.imagem_id]
      if (url) {
        try {
          await sock.sendMessage(jid, { image: { url }, caption: texto || '' })
        } catch (e) {
          console.error(`[venaliv] Falha ao enviar imagem "${acaoObj.imagem_id}":`, e.message)
          if (texto) await enviarTextoEmPartes(sock, jid, texto)
        }
      } else {
        console.warn(`[venaliv] Imagem "${acaoObj.imagem_id}" ainda sem link hospedado — pulei o envio.`)
        if (texto) await enviarTextoEmPartes(sock, jid, texto)
      }
      break
    }

    case 'enviar_video': {
      const url = ASSETS.videos[acaoObj.video_id]
      if (url) {
        try {
          await sock.sendMessage(jid, { video: { url }, caption: texto || '' })
        } catch (e) {
          console.error(`[venaliv] Falha ao enviar vídeo "${acaoObj.video_id}":`, e.message)
          if (texto) await enviarTextoEmPartes(sock, jid, texto)
        }
      } else {
        console.warn(`[venaliv] Vídeo "${acaoObj.video_id}" ainda sem link hospedado — pulei o envio.`)
        if (texto) await enviarTextoEmPartes(sock, jid, texto)
      }
      break
    }

    case 'termo_aceito': {
      // Cliente confirmou o aceite do termo — aciona agendamento de entrega.
      // Mensagem fixa (não deixa a variação da IA mexer nisso), conforme padrão definido.
      await sock.sendMessage(jid, { text: 'Em breve, nosso time vai te enviar o agendamento com todas as informações 💚' })
      await notificarHumano(sock, canalInternoJid, {
        jidCliente: jid,
        motivo: '🚨 *URGENTE* — ACEITE OK, GERAR AGENDAMENTO',
        mensagemCliente: JSON.stringify(acaoObj.dados_coletados || {})
      })
      break
    }

    case 'gerar_termo':
    case 'enviar_termo': {
      // Gera o PDF de verdade a partir do template e manda pra cliente automaticamente.
      // Se a 1ª tentativa falhar (rede, arquivo temporário, etc.), tenta mais uma vez
      // antes de desistir e avisar erro — evita depender da cliente notar e perguntar de novo.
      let pdfPath = null
      let ultimoErro = null
      for (let tentativa = 1; tentativa <= 2 && !pdfPath; tentativa++) {
        try {
          pdfPath = await gerarTermoPDF(acaoObj.dados_coletados || {})
        } catch (e) {
          ultimoErro = e
          console.warn(`[venaliv] Tentativa ${tentativa} de gerar o Termo falhou:`, e.message)
          if (tentativa === 1) await new Promise(r => setTimeout(r, 1500))
        }
      }
      if (pdfPath) {
        if (texto) await enviarTextoEmPartes(sock, jid, texto)
        try {
          await sock.sendMessage(jid, {
            document: fs.readFileSync(pdfPath),
            mimetype: 'application/pdf',
            fileName: 'Termo-Reconhecimento-Divida-Venaliv.pdf'
          })
          // Sequência fixa depois do documento — sempre igual, não varia com a IA
          await new Promise(r => setTimeout(r, 500))
          await sock.sendMessage(jid, { text: 'Aqui está 🥰' })
          await new Promise(r => setTimeout(r, 700))
          await sock.sendMessage(jid, { text: 'Depois de ler, me confirme por favor: de acordo com o termo, posso enviar o seu pedido?' })
          await notificarHumano(sock, canalInternoJid, {
            jidCliente: jid,
            motivo: '📄 TERMO GERADO, FALTA ACEITE',
            mensagemCliente: JSON.stringify(acaoObj.dados_coletados || {})
          })
        } catch (e) {
          console.error('[venaliv] PDF gerado mas falhou ao enviar pro WhatsApp:', e.message)
          await notificarHumano(sock, canalInternoJid, {
            jidCliente: jid,
            motivo: `⚠️ Termo gerado mas falhou ao enviar pro WhatsApp (${e.message}) — enviar manualmente`,
            mensagemCliente: JSON.stringify(acaoObj.dados_coletados || {})
          })
        }
      } else {
        console.error('[venaliv] Falha ao gerar o Termo em PDF (após retry):', ultimoErro?.message)
        if (texto) await enviarTextoEmPartes(sock, jid, texto)
        await notificarHumano(sock, canalInternoJid, {
          jidCliente: jid,
          motivo: `⚠️ Falha ao gerar o Termo automaticamente (${ultimoErro?.message}) — gerar e enviar manualmente`,
          mensagemCliente: JSON.stringify(acaoObj.dados_coletados || {})
        })
      }
      break
    }

    case 'enviar_checkout_pagamento': {
      // Ainda não automatizado (depende do checkout Payt) — escala pra humano
      if (texto) await enviarTextoEmPartes(sock, jid, texto)
      await notificarHumano(sock, canalInternoJid, {
        jidCliente: jid,
        motivo: `Pedido pronto para fechamento (${acaoObj.acao}) — gerar/enviar manualmente por enquanto`,
        mensagemCliente: JSON.stringify(acaoObj.dados_coletados || {})
      })
      break
    }

    case 'escalar_humano': {
      // Mantém a resposta normal pra cliente, mas não notifica mais o WhatsApp interno
      // pra esse tipo de escalada genérica (era ruído — disparava com frequência sem
      // necessidade real de ação, ex: quando a cliente só disse que ia "confirmar com
      // a equipe dela e retornar"). Se sentir falta de avisos de escalada legítimos em
      // outro momento específico da conversa, me avise que ajustamos de novo.
      if (texto) await enviarTextoEmPartes(sock, jid, texto)
      break
    }

    case 'coletar_dados':
    case 'responder_texto':
    default: {
      if (texto) await enviarTextoEmPartes(sock, jid, texto)
      break
    }
  }
}

module.exports = { executarAcao, ASSETS, gerarTermoPDF }