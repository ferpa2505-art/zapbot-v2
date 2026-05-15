/**
 * personalidade.js
 * Toda a configuração de comportamento, identidade e comunicação do agente
 */

// ── Tons de conversa ──────────────────────────────────────────────────────────
const TONS = {
  profissional: {
    nome:     'Profissional',
    desc:     'Formal, cordial e preciso. Ideal para clínicas, escritórios e serviços.',
    exemplo:  'Olá! Como posso ajudá-lo hoje?',
    emojis:   false,
    girias:   false,
  },
  casual: {
    nome:     'Casual',
    desc:     'Descontraído e amigável. Bom para lojas, salões e comércios em geral.',
    exemplo:  'Oi! Tudo bem? Me conta o que você precisa 😊',
    emojis:   true,
    girias:   false,
  },
  tecnico: {
    nome:     'Técnico',
    desc:     'Preciso e especializado. Ótimo para empresas de tecnologia e saúde.',
    exemplo:  'Prezado cliente, poderia especificar o tipo de ocorrência?',
    emojis:   false,
    girias:   false,
  },
  descolado: {
    nome:     'Descolado',
    desc:     'Jovial, com humor e energia. Perfeito para marcas jovens e criativas.',
    exemplo:  'Eee, chegou! 🔥 Me fala o que você tá precisando!',
    emojis:   true,
    girias:   true,
  },
  acolhedor: {
    nome:     'Acolhedor',
    desc:     'Empático e caloroso. Essencial para psicologia, saúde mental e cuidados.',
    exemplo:  'Olá! Fico feliz que você entrou em contato. Como posso ajudar? 💚',
    emojis:   true,
    girias:   false,
  },
  formal: {
    nome:     'Formal',
    desc:     'Extremamente formal. Ideal para advocacia, finanças e órgãos públicos.',
    exemplo:  'Bom dia. Em que posso ser útil ao senhor/à senhora?',
    emojis:   false,
    girias:   false,
  },
}

// ── Jargões por segmento ──────────────────────────────────────────────────────
const JARGOES = {
  medico:      { termos: ['paciente','consulta','prontuário','retorno','encaminhamento','triagem','anamnese','receita','laudo'], tratamento: 'paciente' },
  dentista:    { termos: ['paciente','restauração','limpeza','prótese','ortodontia','extração','raio-x','placa','canal'], tratamento: 'paciente' },
  advogado:    { termos: ['cliente','processo','diligência','petição','audiência','contrato','prazo','jurídico','vara'], tratamento: 'cliente' },
  psico:       { termos: ['cliente','sessão','acolhimento','escuta','processo terapêutico','bem-estar','saúde mental'], tratamento: 'cliente' },
  imobiliaria: { termos: ['imóvel','visita','proposta','escritura','financiamento','condomínio','metragem','IPTU','laudo'], tratamento: 'cliente' },
  loja:        { termos: ['produto','estoque','entrega','pedido','orçamento','garantia','SKU','nota fiscal','frete'], tratamento: 'cliente' },
  restaurante: { termos: ['reserva','cardápio','mesa','delivery','pedido','chef','prato','tempo de espera'], tratamento: 'cliente' },
  salao:       { termos: ['horário','profissional','serviço','coloração','corte','escova','manicure','pedicure'], tratamento: 'cliente' },
  farmacia:    { termos: ['medicamento','receita','genérico','similar','posologia','laboratório','controlado'], tratamento: 'cliente' },
  academia:    { termos: ['aluno','matrícula','treino','modalidade','personal','plano','avaliação física'], tratamento: 'aluno' },
  escola:      { termos: ['aluno','matrícula','turma','série','mensalidade','boletim','secretaria'], tratamento: 'responsável' },
  custom:      { termos: [], tratamento: 'cliente' },
}

// ── Idiomas suportados ────────────────────────────────────────────────────────
const IDIOMAS = {
  'pt-BR': { nome: 'Português (Brasil)',   codigo: 'pt-BR' },
  'pt-PT': { nome: 'Português (Portugal)', codigo: 'pt-PT' },
  'en-US': { nome: 'Inglês (EUA)',         codigo: 'en-US' },
  'es-ES': { nome: 'Espanhol',             codigo: 'es-ES' },
}

// ── Config padrão completa de personalidade ───────────────────────────────────
function defaultPersonalidade() {
  return {
    // Identidade do agente
    nomeAgente:          'ZapBot',
    fotoPerfil:          null,       // base64 ou path
    assinatura:          '',         // texto ao final de cada mensagem

    // Comunicação
    modoResposta:        'texto',    // 'texto' | 'voz' | 'ambos'
    generoVoz:           'feminino', // 'feminino' | 'masculino'
    sotaque:             'sp',
    velocidadeVoz:       1.0,
    tom:                 'profissional',
    idioma:              'pt-BR',

    // Jargões e vocabulário
    jargoesPadrao:       true,       // usar jargões do segmento automaticamente
    jargoesCuston:       [],         // termos extras definidos pelo cliente
    palavrasBloqueadas:  [],         // blacklist de assuntos/palavras

    // Comportamento
    apresentarSeComo:    'assistente virtual',  // ou nome real
    revelarQueEhIA:      false,      // só se perguntado diretamente
    limiteMsgAntesEscalar: 10,       // após N msgs sem resolução → escalada
    tempoMaxResposta:    2,          // segundos de "digitando" antes de responder
    modoPadrao:          'bot',      // 'bot' | 'humano' (desativa bot temporariamente)

    // Horários do CHAT (separado da empresa)
    horarioChat: {
      ativo:    true,
      segSex:   { inicio: '08:00', fim: '22:00' },
      sabado:   { inicio: '09:00', fim: '18:00' },
      domingo:  { ativo: false },
      feriados: false,
      msgForaHorario: 'Nosso atendimento automático está pausado agora. Deixe sua mensagem e retornaremos assim que possível!',
    },

    // Pós-mensagem
    linkWhatsApp:        '',         // link de WhatsApp da empresa para rodapé
    rodape:              '',         // ex: "Atendimento via ZapBot 🤖"

    // IA
    chaveClaudeAPI:      '',
    chaveGoogleTTS:      '',
    usarIAParaRespostas: false,      // usar Claude para respostas livres
    contextWindowIA:     10,         // quantas mensagens anteriores enviar para a IA

    // Análise de mídia
    analisarImagens:     true,
    analisarPDFs:        true,
    msgAguardandoAnalise:'🔍 Analisando o arquivo, aguarde um momento...',

    // Webhook / integração
    webhookURL:          '',
    webhookSecret:       '',
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function dentroDoHorarioChat(horarioChat) {
  if (!horarioChat?.ativo) return true   // sem restrição = sempre ativo
  const agora = new Date()
  const dia   = agora.getDay()           // 0=dom, 6=sab
  const hhmm  = agora.toTimeString().slice(0,5)

  if (dia === 0) {
    if (!horarioChat.domingo?.ativo) return false
    return hhmm >= horarioChat.domingo.inicio && hhmm <= horarioChat.domingo.fim
  }
  if (dia === 6) {
    if (!horarioChat.sabado?.ativo) return false
    return hhmm >= horarioChat.sabado.inicio && hhmm <= horarioChat.sabado.fim
  }
  return hhmm >= horarioChat.segSex.inicio && hhmm <= horarioChat.segSex.fim
}

function aplicarAssinatura(texto, personalidade) {
  if (!personalidade.rodape && !personalidade.assinatura) return texto
  const rodape = personalidade.rodape || personalidade.assinatura
  return texto + '\n\n_' + rodape + '_'
}

function filtrarPalavrasBloqueadas(texto, lista = []) {
  if (!lista.length) return { bloqueado: false }
  const t = texto.toLowerCase()
  const encontrada = lista.find(p => t.includes(p.toLowerCase()))
  return { bloqueado: !!encontrada, palavra: encontrada }
}

module.exports = {
  TONS, JARGOES, IDIOMAS,
  defaultPersonalidade,
  dentroDoHorarioChat,
  aplicarAssinatura,
  filtrarPalavrasBloqueadas,
}
