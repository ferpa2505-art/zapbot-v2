/**
 * google-agenda.js
 * Integração real com Google Calendar via OAuth2
 * O cliente autoriza uma vez, depois o bot agenda automaticamente
 */

const fs   = require('fs')
const path = require('path')
const http = require('http')
const { execSync } = require('child_process')

const TOKEN_PATH  = p => path.join(p, 'google-token.json')
const CREDS_PATH  = p => path.join(p, 'google-credentials.json')

// ── Credenciais padrão (o dono do sistema configura UMA vez via painel) ──────
const SCOPES = ['https://www.googleapis.com/auth/calendar']

class GoogleAgenda {
  constructor(dataPath) {
    this.dataPath = dataPath
    this.auth     = null
    this.calendar = null
  }

  temCredenciais() {
    return fs.existsSync(CREDS_PATH(this.dataPath))
  }

  salvarCredenciais(clientId, clientSecret) {
    const creds = {
      installed: {
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uris: ['http://localhost:9999/oauth2callback'],
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token'
      }
    }
    fs.writeFileSync(CREDS_PATH(this.dataPath), JSON.stringify(creds, null, 2))
  }

  async autorizar(onUrlGerada) {
    const { google } = require('googleapis')
    const raw   = JSON.parse(fs.readFileSync(CREDS_PATH(this.dataPath)))
    const creds = raw.installed || raw.web

    this.oAuth2 = new google.auth.OAuth2(
      creds.client_id,
      creds.client_secret,
      'http://localhost:9999/oauth2callback'
    )

    // Token já existe?
    if (fs.existsSync(TOKEN_PATH(this.dataPath))) {
      const token = JSON.parse(fs.readFileSync(TOKEN_PATH(this.dataPath)))
      this.oAuth2.setCredentials(token)
      this.calendar = google.calendar({ version: 'v3', auth: this.oAuth2 })
      return true
    }

    // Gera URL de autorização
    const url = this.oAuth2.generateAuthUrl({ access_type: 'offline', scope: SCOPES })
    onUrlGerada && onUrlGerada(url)

    // Servidor local para capturar o callback
    return new Promise((resolve, reject) => {
      const server = http.createServer(async (req, res) => {
        if (!req.url.startsWith('/oauth2callback')) return
        const code = new URL('http://localhost:9999' + req.url).searchParams.get('code')
        res.end('<h2 style="font-family:sans-serif;color:#16a34a">✅ ZapBot conectado ao Google Agenda!<br>Pode fechar esta aba.</h2>')
        server.close()
        try {
          const { tokens } = await this.oAuth2.getToken(code)
          this.oAuth2.setCredentials(tokens)
          fs.writeFileSync(TOKEN_PATH(this.dataPath), JSON.stringify(tokens))
          this.calendar = google.calendar({ version: 'v3', auth: this.oAuth2 })
          resolve(true)
        } catch (err) { reject(err) }
      })
      server.listen(9999)
    })
  }

  async listarHorariosDisponiveis(data, durMinutos = 60) {
    if (!this.calendar) throw new Error('Google Agenda não autorizado')
    const inicio = new Date(data)
    inicio.setHours(8, 0, 0, 0)
    const fim = new Date(data)
    fim.setHours(18, 0, 0, 0)

    const { data: { items } } = await this.calendar.events.list({
      calendarId: 'primary',
      timeMin: inicio.toISOString(),
      timeMax: fim.toISOString(),
      singleEvents: true,
      orderBy: 'startTime'
    })

    // Gera slots de 1h e remove ocupados
    const slots = []
    for (let h = 8; h < 18; h++) {
      const slotInicio = new Date(data)
      slotInicio.setHours(h, 0, 0, 0)
      const slotFim = new Date(slotInicio.getTime() + durMinutos * 60000)
      const ocupado = items.some(ev => {
        const evI = new Date(ev.start.dateTime || ev.start.date)
        const evF = new Date(ev.end.dateTime   || ev.end.date)
        return slotInicio < evF && slotFim > evI
      })
      if (!ocupado) slots.push(`${String(h).padStart(2,'0')}:00`)
    }
    return slots
  }

  async criarEvento({ titulo, descricao, data, hora, durMinutos = 60, emailCliente, nomeCliente }) {
    if (!this.calendar) throw new Error('Google Agenda não autorizado')
    const [ano, mes, dia] = data.split('-').map(Number)
    const [h, m]          = hora.split(':').map(Number)

    const inicio = new Date(ano, mes - 1, dia, h, m)
    const fim    = new Date(inicio.getTime() + durMinutos * 60000)

    const evento = {
      summary: titulo || `Agendamento – ${nomeCliente}`,
      description: descricao || `Cliente: ${nomeCliente}\nAgendado via ZapBot`,
      start: { dateTime: inicio.toISOString(), timeZone: 'America/Sao_Paulo' },
      end:   { dateTime: fim.toISOString(),    timeZone: 'America/Sao_Paulo' },
      reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 60 }, { method: 'email', minutes: 1440 }] }
    }

    if (emailCliente) {
      evento.attendees = [{ email: emailCliente, displayName: nomeCliente }]
    }

    const { data: ev } = await this.calendar.events.insert({ calendarId: 'primary', resource: evento, sendUpdates: 'all' })
    return { id: ev.id, link: ev.htmlLink, inicio: ev.start.dateTime, fim: ev.end.dateTime }
  }

  async cancelarEvento(eventoId) {
    if (!this.calendar) return false
    await this.calendar.events.delete({ calendarId: 'primary', eventId: eventoId, sendUpdates: 'all' })
    return true
  }

  async listarProximosEventos(max = 10) {
    if (!this.calendar) return []
    const { data: { items } } = await this.calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      maxResults: max,
      singleEvents: true,
      orderBy: 'startTime'
    })
    return items.map(ev => ({
      id:     ev.id,
      titulo: ev.summary,
      inicio: ev.start.dateTime || ev.start.date,
      fim:    ev.end.dateTime   || ev.end.date,
      link:   ev.htmlLink
    }))
  }
}

// ── Instância global (singleton por dataPath) ─────────────────────────────────
const instancias = new Map()
function getAgenda(dataPath) {
  if (!instancias.has(dataPath)) instancias.set(dataPath, new GoogleAgenda(dataPath))
  return instancias.get(dataPath)
}

module.exports = { GoogleAgenda, getAgenda }
