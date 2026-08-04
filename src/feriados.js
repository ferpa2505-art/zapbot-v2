/**
 * feriados.js
 * Detecta feriados nacionais, estaduais e municipais automaticamente
 * Fontes: API BrasilAPI (gratuita) + lista estática de fallback
 */

const https = require('https')
const fs    = require('fs')
const path  = require('path')

// ── Feriados nacionais fixos (sempre válidos) ─────────────────────────────────
const NACIONAIS_FIXOS = [
  { mes: 1,  dia: 1,  nome: 'Ano Novo' },
  { mes: 4,  dia: 21, nome: 'Tiradentes' },
  { mes: 5,  dia: 1,  nome: 'Dia do Trabalho' },
  { mes: 9,  dia: 7,  nome: 'Independência do Brasil' },
  { mes: 10, dia: 12, nome: 'Nossa Senhora Aparecida' },
  { mes: 11, dia: 2,  nome: 'Finados' },
  { mes: 11, dia: 15, nome: 'Proclamação da República' },
  { mes: 11, dia: 20, nome: 'Consciência Negra' },
  { mes: 12, dia: 25, nome: 'Natal' },
]

// ── Feriados estaduais por UF ─────────────────────────────────────────────────
const ESTADUAIS = {
  SP: [{ mes:7, dia:9, nome:'Revolução Constitucionalista' }],
  RJ: [{ mes:4, dia:23, nome:'São Jorge' }, { mes:10, dia:28, nome:'Dia do Servidor Público' }],
  MG: [{ mes:4, dia:21, nome:'Tiradentes (estadual)' }],
  BA: [{ mes:7, dia:2, nome:'Independência da Bahia' }],
  RS: [{ mes:9, dia:20, nome:'Revolução Farroupilha' }],
  PE: [{ mes:3, dia:6, nome:'Revolução Pernambucana' }],
  CE: [{ mes:3, dia:25, nome:'Data Magna do Ceará' }],
  GO: [{ mes:10, dia:24, nome:'Fundação de Goiás' }],
  SC: [{ mes:8, dia:11, nome:'Criação da Capitania de SC' }],
  PR: [{ mes:12, dia:19, nome:'Emancipação do Paraná' }],
  AM: [{ mes:9, dia:5, nome:'Elevação ao Estado' }],
  PA: [{ mes:8, dia:15, nome:'Adesão do Pará à Independência' }],
  MT: [{ mes:5, dia:8, nome:'Criação do Estado de MT' }],
  MS: [{ mes:10, dia:11, nome:'Criação do Estado de MS' }],
  DF: [{ mes:4, dia:21, nome:'Fundação de Brasília' }],
  ES: [{ mes:10, dia:22, nome:'Nossa Senhora da Penha' }],
  MA: [{ mes:7, dia:28, nome:'Adesão do Maranhão' }],
  PI: [{ mes:10, dia:19, nome:'Dia do Piauí' }],
  RN: [{ mes:10, dia:3, nome:'Mártires de Cunhaú' }],
  PB: [{ mes:8, dia:5, nome:'Nossa Senhora das Neves' }],
  AL: [{ mes:6, dia:24, nome:'São João (estadual)' }],
  SE: [{ mes:7, dia:8, nome:'Nossa Senhora da Conceição' }],
  TO: [{ mes:10, dia:5, nome:'Criação do Estado de TO' }],
  RO: [{ mes:1, dia:4, nome:'Criação do Estado de RO' }],
  AC: [{ mes:6, dia:15, nome:'Aniversário do Acre' }],
  RR: [{ mes:10, dia:5, nome:'Criação do Estado de RR' }],
  AP: [{ mes:9, dia:13, nome:'Criação do Estado de AP' }],
}

// ── Cálculo de Páscoa (algoritmo de Meeus) ────────────────────────────────────
function calcularPascoa(ano) {
  const a = ano % 19, b = Math.floor(ano/100), c = ano % 100
  const d = Math.floor(b/4), e = b % 4, f = Math.floor((b+8)/25)
  const g = Math.floor((b-f+1)/3), h = (19*a+b-d-g+15) % 30
  const i = Math.floor(c/4), k = c % 4
  const l = (32+2*e+2*i-h-k) % 7
  const m = Math.floor((a+11*h+22*l)/451)
  const mes = Math.floor((h+l-7*m+114)/31)
  const dia = ((h+l-7*m+114) % 31) + 1
  return new Date(ano, mes-1, dia)
}

function feriadosMoveis(ano) {
  const pascoa = calcularPascoa(ano)
  const add = (d, dias) => { const dt = new Date(d); dt.setDate(dt.getDate()+dias); return dt }
  const fmt  = dt => ({ mes: dt.getMonth()+1, dia: dt.getDate() })
  return [
    { ...fmt(add(pascoa,-48)), nome: 'Segunda de Carnaval' },
    { ...fmt(add(pascoa,-47)), nome: 'Terça de Carnaval' },
    { ...fmt(add(pascoa,-2)),  nome: 'Sexta-feira Santa' },
    { ...fmt(pascoa),          nome: 'Páscoa' },
    { ...fmt(add(pascoa,60)),  nome: 'Corpus Christi' },
  ]
}

// ── Busca feriados via BrasilAPI ──────────────────────────────────────────────
function buscarBrasilAPI(ano) {
  return new Promise((resolve) => {
    const req = https.get(`https://brasilapi.com.br/api/feriados/v1/${ano}`, (res) => {
      let body = ''
      res.on('data', d => body += d)
      res.on('end', () => {
        try {
          const lista = JSON.parse(body)
          const result = lista.map(f => {
            const [ano, mes, dia] = f.date.split('-').map(Number)
            return { mes, dia, nome: f.name, tipo: f.type }
          })
          resolve(result)
        } catch { resolve(null) }
      })
    })
    req.on('error', () => resolve(null))
    req.setTimeout(5000, () => { req.destroy(); resolve(null) })
  })
}

// ── Detectar UF a partir do nome da cidade ───────────────────────────────────
function detectarUF(cidade = '') {
  const c = cidade.toLowerCase()
  const mapa = {
    'são paulo': 'SP', 'campinas': 'SP', 'sorocaba': 'SP', 'ribeirão preto': 'SP', 'santos': 'SP',
    'rio de janeiro': 'RJ', 'niterói': 'RJ', 'duque de caxias': 'RJ',
    'belo horizonte': 'MG', 'uberlândia': 'MG', 'juiz de fora': 'MG',
    'salvador': 'BA', 'feira de santana': 'BA',
    'fortaleza': 'CE', 'caucaia': 'CE',
    'manaus': 'AM', 'parintins': 'AM',
    'curitiba': 'PR', 'londrina': 'PR', 'maringá': 'PR',
    'recife': 'PE', 'caruaru': 'PE', 'olinda': 'PE',
    'porto alegre': 'RS', 'caxias do sul': 'RS', 'pelotas': 'RS',
    'belém': 'PA', 'santarém': 'PA',
    'goiânia': 'GO', 'anápolis': 'GO',
    'são luís': 'MA', 'imperatriz': 'MA',
    'maceió': 'AL',
    'natal': 'RN',
    'teresina': 'PI',
    'campo grande': 'MS',
    'cuiabá': 'MT',
    'macapá': 'AP',
    'porto velho': 'RO',
    'boa vista': 'RR',
    'palmas': 'TO',
    'rio branco': 'AC',
    'aracaju': 'SE',
    'joão pessoa': 'PB',
    'vitória': 'ES', 'vila velha': 'ES',
    'florianópolis': 'SC', 'joinville': 'SC', 'blumenau': 'SC',
    'brasília': 'DF',
  }
  for (const [nome, uf] of Object.entries(mapa)) {
    if (c.includes(nome)) return uf
  }
  // Tenta extrair UF do padrão "Cidade – UF" ou "Cidade, UF"
  const match = cidade.match(/[–\-,]\s*([A-Z]{2})\s*$/)
  if (match) return match[1]
  return null
}

// ── Classe principal ──────────────────────────────────────────────────────────
class GerenciadorFeriados {
  constructor(dataPath) {
    this.dataPath  = dataPath
    this.cacheFile = path.join(dataPath, 'feriados-cache.json')
    this.cache     = this._loadCache()
  }

  _loadCache() {
    try { if (fs.existsSync(this.cacheFile)) return JSON.parse(fs.readFileSync(this.cacheFile,'utf8')) } catch {}
    return {}
  }

  _saveCache(ano, dados) {
    this.cache[ano] = { dados, atualizado: new Date().toISOString() }
    fs.mkdirSync(this.dataPath, { recursive: true })
    fs.writeFileSync(this.cacheFile, JSON.stringify(this.cache, null, 2))
  }

  async getFeriados(ano, cidade = '', forcarAtualizar = false) {
    const cacheKey = `${ano}_${cidade}`
    const cached   = this.cache[cacheKey]
    const horasCached = cached ? (Date.now() - new Date(cached.atualizado).getTime()) / 3600000 : Infinity

    if (cached && horasCached < 720 && !forcarAtualizar) return cached.dados

    // Tenta BrasilAPI primeiro
    let feriados = await buscarBrasilAPI(ano)

    if (!feriados) {
      // Fallback: monta lista completa estática
      feriados = [
        ...NACIONAIS_FIXOS,
        ...feriadosMoveis(ano),
      ]
    }

    // Adiciona feriados estaduais se UF detectada
    const uf = detectarUF(cidade)
    if (uf && ESTADUAIS[uf]) {
      for (const f of ESTADUAIS[uf]) {
        if (!feriados.some(x => x.mes === f.mes && x.dia === f.dia)) {
          feriados.push({ ...f, tipo: 'estadual' })
        }
      }
    }

    // Ordena por data
    feriados.sort((a, b) => a.mes !== b.mes ? a.mes - b.mes : a.dia - b.dia)

    const result = { feriados, uf, cidade, ano, fonte: feriados.length > 15 ? 'BrasilAPI' : 'offline' }
    this._saveCache(cacheKey, result)
    return result
  }

  isFeriado(data, feriadosData) {
    if (!feriadosData?.feriados) return null
    const d = new Date(data)
    const mes = d.getMonth() + 1
    const dia = d.getDate()
    return feriadosData.feriados.find(f => f.mes === mes && f.dia === dia) || null
  }

  // Para uso no bot — verifica se hoje é feriado
  async verificarHoje(cidade = '') {
    const hoje = new Date()
    const ano  = hoje.getFullYear()
    const data = await this.getFeriados(ano, cidade)
    return this.isFeriado(hoje, data)
  }

  // Lista feriados do mês atual
  async feriadosDoMes(cidade = '') {
    const hoje = new Date()
    const ano  = hoje.getFullYear()
    const mes  = hoje.getMonth() + 1
    const data = await this.getFeriados(ano, cidade)
    return (data?.feriados || []).filter(f => f.mes === mes)
  }

  // Lista todos os feriados do ano
  async listarTodos(cidade = '') {
    const ano  = new Date().getFullYear()
    return this.getFeriados(ano, cidade)
  }
}

const instancias = new Map()
function getFeriados(dataPath) {
  if (!instancias.has(dataPath)) instancias.set(dataPath, new GerenciadorFeriados(dataPath))
  return instancias.get(dataPath)
}

module.exports = { GerenciadorFeriados, getFeriados, detectarUF, NACIONAIS_FIXOS, ESTADUAIS }
