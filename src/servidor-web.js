/**
 * servidor-web.js
 * Painel web acessível pelo celular via Wi-Fi local (ou ngrok para acesso externo)
 * Roda na porta 3000 — acesse: http://IP-DO-COMPUTADOR:3000
 */

const http    = require('http')
const fs      = require('fs')
const path    = require('path')
const os      = require('os')
const crypto  = require('crypto')

function getIPLocal() {
  const ifaces = os.networkInterfaces()
  for (const nome of Object.keys(ifaces)) {
    for (const iface of ifaces[nome]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address
    }
  }
  return 'localhost'
}

class ServidorWeb {
  constructor({ porta = 3000, senhaAdmin = '1234', dataPath, onComando } = {}) {
    this.porta      = porta
    this.senhaAdmin = senhaAdmin
    this.dataPath   = dataPath
    this.onComando  = onComando || (() => {})
    this.sessoes    = new Map()   // token → { expira, role }
    this.mensagens  = []          // buffer circular últimas 200
    this.servidor   = null
    this.dados      = { status: 'offline', numero: '', resumoAtendentes: {}, campanhas: [] }
  }

  atualizar(dados) { Object.assign(this.dados, dados) }

  addMensagem(msg) {
    this.mensagens.unshift(msg)
    if (this.mensagens.length > 200) this.mensagens.pop()
  }

  _gerarToken() {
    const tok = crypto.randomBytes(24).toString('hex')
    this.sessoes.set(tok, { expira: Date.now() + 8 * 3600000 })
    return tok
  }

  _autenticado(req) {
    const cookie = req.headers.cookie || ''
    const tok = cookie.split(';').map(c => c.trim()).find(c => c.startsWith('zapbot_token='))?.split('=')[1]
    if (!tok) return false
    const sessao = this.sessoes.get(tok)
    if (!sessao || sessao.expira < Date.now()) { this.sessoes.delete(tok); return false }
    return true
  }

  _json(res, dados, status = 200) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify(dados))
  }

  _html(res, html) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(html)
  }

  iniciar() {
    this.servidor = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*')

      const url = new URL(req.url, 'http://localhost')
      const rota = url.pathname

      // ── Login ──────────────────────────────────────────────────────────────
      if (rota === '/login' && req.method === 'POST') {
        let body = ''
        req.on('data', d => body += d)
        req.on('end', () => {
          try {
            const { senha } = JSON.parse(body)
            if (senha === this.senhaAdmin) {
              const tok = this._gerarToken()
              res.setHeader('Set-Cookie', `zapbot_token=${tok}; Path=/; Max-Age=28800; HttpOnly`)
              this._json(res, { ok: true })
            } else {
              this._json(res, { ok: false, msg: 'Senha incorreta' }, 401)
            }
          } catch { this._json(res, { ok: false }, 400) }
        })
        return
      }

      // ── Página de login ────────────────────────────────────────────────────
      if (rota === '/login' || (rota === '/' && !this._autenticado(req))) {
        this._html(res, paginaLogin())
        return
      }

      // ── Protegido ──────────────────────────────────────────────────────────
      if (!this._autenticado(req) && rota !== '/login') {
        res.writeHead(302, { Location: '/login' }); res.end(); return
      }

      // ── API ────────────────────────────────────────────────────────────────
      if (rota === '/api/status')     return this._json(res, this.dados)
      if (rota === '/api/mensagens')  return this._json(res, this.mensagens.slice(0, 50))
      if (rota === '/api/atendentes') return this._json(res, this.dados.resumoAtendentes || {})
      if (rota === '/api/campanhas')  return this._json(res, this.dados.campanhas || [])

      if (rota === '/api/comando' && req.method === 'POST') {
        let body = ''
        req.on('data', d => body += d)
        req.on('end', async () => {
          try {
            const cmd = JSON.parse(body)
            const resultado = await this.onComando(cmd)
            this._json(res, { ok: true, resultado })
          } catch (e) { this._json(res, { ok: false, msg: e.message }, 500) }
        })
        return
      }

      // ── Painel principal ───────────────────────────────────────────────────
      if (rota === '/') {
        this._html(res, paginaWeb())
        return
      }

      res.writeHead(404); res.end('Not found')
    })

    this.servidor.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`[servidor-web] Porta ${this.porta} já está em uso (provavelmente outra instância do ZapBot ainda rodando). O painel web ficará indisponível, mas o bot do WhatsApp continua funcionando normalmente.`)
      } else {
        console.error('[servidor-web] Erro no painel web:', err.message)
      }
    })

    this.servidor.listen(this.porta, '0.0.0.0', () => {
      const ip = getIPLocal()
      console.log(`\n🌐 Painel web disponível em:`)
      console.log(`   → No computador: http://localhost:${this.porta}`)
      console.log(`   → No celular (mesma rede Wi-Fi): http://${ip}:${this.porta}\n`)
    })

    return { ip: getIPLocal(), porta: this.porta }
  }

  parar() {
    this.servidor?.close()
  }
}

// ── HTMLs ─────────────────────────────────────────────────────────────────────

function paginaLogin() {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ZapBot – Login</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,sans-serif;background:#f0fdf4;display:flex;align-items:center;justify-content:center;min-height:100vh}
.card{background:#fff;border-radius:16px;padding:36px 28px;width:340px;box-shadow:0 4px 24px rgba(0,0,0,.08)}
.logo{text-align:center;font-size:32px;margin-bottom:8px}
h1{text-align:center;font-size:20px;color:#111;margin-bottom:4px}
p{text-align:center;font-size:13px;color:#6b7280;margin-bottom:24px}
label{font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:5px}
input{width:100%;padding:11px 14px;border:1px solid #d1d5db;border-radius:10px;font-size:15px;outline:none;margin-bottom:16px}
input:focus{border-color:#25D366}
button{width:100%;padding:12px;background:#25D366;color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer}
button:hover{background:#1da851}
.erro{color:#dc2626;font-size:13px;text-align:center;margin-top:10px;display:none}
</style></head><body>
<div class="card">
  <div class="logo">🤖</div>
  <h1>ZapBot</h1>
  <p>Painel de atendimento</p>
  <label>Senha de acesso</label>
  <input type="password" id="senha" placeholder="••••••••" onkeydown="if(event.key==='Enter')entrar()">
  <button onclick="entrar()">Entrar</button>
  <div class="erro" id="erro">Senha incorreta. Tente novamente.</div>
</div>
<script>
async function entrar(){
  const senha=document.getElementById('senha').value
  const r=await fetch('/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({senha})})
  const d=await r.json()
  if(d.ok) location.href='/'
  else { document.getElementById('erro').style.display='block' }
}
</script></body></html>`
}

function paginaWeb() {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ZapBot – Painel</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,sans-serif;background:#f7f8fa;color:#111}
.topbar{background:#fff;border-bottom:1px solid #e5e7eb;padding:12px 16px;display:flex;align-items:center;gap:10px;position:sticky;top:0;z-index:10}
.logo{font-weight:700;font-size:17px;color:#25D366}
.status-dot{width:8px;height:8px;border-radius:50%;background:#d1d5db;margin-left:auto}
.status-dot.online{background:#25D366}
.status-txt{font-size:12px;color:#6b7280}
.tabs{display:flex;gap:0;border-bottom:1px solid #e5e7eb;background:#fff;overflow-x:auto}
.tab{padding:12px 16px;font-size:13px;font-weight:500;color:#6b7280;cursor:pointer;white-space:nowrap;border-bottom:2px solid transparent}
.tab.active{color:#25D366;border-bottom-color:#25D366}
.content{padding:16px}
.panel{display:none}.panel.active{display:block}
.card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:12px}
.card-title{font-size:14px;font-weight:600;margin-bottom:12px}
.stat-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
.stat{background:#f0fdf4;border-radius:10px;padding:14px;text-align:center}
.stat-val{font-size:24px;font-weight:700;color:#16a34a}
.stat-lbl{font-size:11px;color:#6b7280;margin-top:2px}
.msg-item{padding:10px 0;border-bottom:1px solid #f3f4f6;display:flex;flex-direction:column;gap:3px}
.msg-item:last-child{border-bottom:none}
.msg-num{font-size:12px;font-weight:600;color:#374151}
.msg-txt{font-size:13px;color:#111}
.msg-hora{font-size:11px;color:#9ca3af}
.at-card{background:#f9fafb;border-radius:10px;padding:12px;margin-bottom:8px;display:flex;align-items:center;gap:12px}
.at-avatar{width:40px;height:40px;border-radius:50%;background:#dcfce7;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:#16a34a;flex-shrink:0}
.at-nome{font-size:14px;font-weight:600}
.at-info{font-size:12px;color:#6b7280;margin-top:2px}
.badge{display:inline-block;font-size:10px;padding:2px 8px;border-radius:6px;font-weight:600}
.badge-online{background:#dcfce7;color:#14532d}
.badge-ausente{background:#fef3c7;color:#78350f}
.badge-offline{background:#f3f4f6;color:#4b5563}
.camp-item{padding:10px 0;border-bottom:1px solid #f3f4f6}
.camp-item:last-child{border-bottom:none}
.camp-nome{font-size:13px;font-weight:600}
.camp-info{font-size:12px;color:#6b7280;margin-top:3px}
.prog-bar{height:6px;background:#f3f4f6;border-radius:4px;margin-top:6px;overflow:hidden}
.prog-fill{height:100%;background:#25D366;border-radius:4px;transition:width .5s}
.btn{padding:8px 16px;border-radius:8px;border:none;cursor:pointer;font-size:13px;font-weight:500}
.btn-green{background:#25D366;color:#fff}
.btn-outline{background:#fff;border:1px solid #e5e7eb;color:#374151}
.btn-red{background:#fee2e2;color:#991b1b}
.input{width:100%;padding:9px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;margin-bottom:8px;outline:none}
.input:focus{border-color:#25D366}
textarea.input{min-height:80px;resize:vertical;font-family:inherit}
.empty{text-align:center;color:#9ca3af;padding:24px;font-size:13px}
.flex{display:flex;gap:8px;align-items:center}
</style></head><body>

<div class="topbar">
  <div class="logo">🤖 ZapBot</div>
  <div class="status-dot" id="sdot"></div>
  <div class="status-txt" id="stxt">Carregando...</div>
</div>

<div class="tabs">
  <div class="tab active" onclick="aba('monitor',this)">📊 Monitor</div>
  <div class="tab" onclick="aba('atendentes',this)">👥 Atendentes</div>
  <div class="tab" onclick="aba('broadcast',this)">📢 Broadcast</div>
</div>

<div class="content">

  <!-- MONITOR -->
  <div class="panel active" id="p-monitor">
    <div class="stat-grid">
      <div class="stat"><div class="stat-val" id="s-msgs">0</div><div class="stat-lbl">Mensagens hoje</div></div>
      <div class="stat"><div class="stat-val" id="s-fila">0</div><div class="stat-lbl">Na fila</div></div>
    </div>
    <div class="card">
      <div class="card-title">Conversas recentes</div>
      <div id="lista-msgs"><div class="empty">Nenhuma mensagem ainda</div></div>
    </div>
  </div>

  <!-- ATENDENTES -->
  <div class="panel" id="p-atendentes">
    <div class="card">
      <div class="card-title">Meu status</div>
      <div class="flex" style="margin-bottom:12px">
        <button class="btn btn-green" onclick="setStatus('online')">🟢 Online</button>
        <button class="btn btn-outline" onclick="setStatus('ausente')">🟡 Ausente</button>
        <button class="btn btn-outline" onclick="setStatus('offline')">⚫ Offline</button>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Equipe</div>
      <div id="lista-ats"><div class="empty">Nenhum atendente</div></div>
    </div>
    <div class="card">
      <div class="card-title">Adicionar atendente</div>
      <input class="input" id="at-nome" placeholder="Nome">
      <input class="input" id="at-id" placeholder="ID (ex: joao)">
      <input class="input" type="password" id="at-senha" placeholder="Senha">
      <button class="btn btn-green" onclick="addAtendente()">Adicionar</button>
    </div>
  </div>

  <!-- BROADCAST -->
  <div class="panel" id="p-broadcast">
    <div class="card">
      <div class="card-title">Nova campanha</div>
      <input class="input" id="bc-nome" placeholder="Nome da campanha">
      <textarea class="input" id="bc-msg" placeholder="Mensagem (use {nome} para personalizar)"></textarea>
      <input class="input" id="bc-tags" placeholder="Tags dos contatos (ex: pacientes, clientes) — deixe vazio para todos">
      <div class="flex">
        <button class="btn btn-green" onclick="criarCampanha(false)">▶ Enviar agora</button>
        <button class="btn btn-outline" onclick="criarCampanha(true)">🕐 Agendar</button>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Campanhas</div>
      <div id="lista-camp"><div class="empty">Nenhuma campanha</div></div>
    </div>
  </div>

</div>

<script>
let intervalo, meuId = localStorage.getItem('at_id') || ''

function aba(id, el) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'))
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
  document.getElementById('p-'+id).classList.add('active')
  el.classList.add('active')
}

async function api(rota) {
  const r = await fetch(rota)
  return r.json()
}

async function cmd(tipo, dados={}) {
  const r = await fetch('/api/comando', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({tipo,...dados}) })
  return r.json()
}

async function atualizar() {
  try {
    const [status, msgs, ats, camps] = await Promise.all([
      api('/api/status'), api('/api/mensagens'), api('/api/atendentes'), api('/api/campanhas')
    ])

    // Status
    const online = status.status === 'online'
    document.getElementById('sdot').className = 'status-dot' + (online ? ' online' : '')
    document.getElementById('stxt').textContent = online ? '🟢 ' + (status.numero ? '+'+status.numero : 'Conectado') : '⚫ Desconectado'
    document.getElementById('s-msgs').textContent = msgs.length
    document.getElementById('s-fila').textContent = ats.filaTamanho || 0

    // Mensagens
    const lm = document.getElementById('lista-msgs')
    if (msgs.length) {
      lm.innerHTML = msgs.slice(0,20).map(m => \`
        <div class="msg-item">
          <div class="msg-num">+\${(m.jid||'').replace('@s.whatsapp.net','')}</div>
          <div class="msg-txt">\${esc(m.texto)}</div>
          <div class="msg-hora">\${m.hora||''}</div>
        </div>\`).join('')
    } else lm.innerHTML = '<div class="empty">Nenhuma mensagem ainda</div>'

    // Atendentes
    const la = document.getElementById('lista-ats')
    if (ats.atendentes?.length) {
      la.innerHTML = ats.atendentes.map(a => \`
        <div class="at-card">
          <div class="at-avatar">\${a.nome[0].toUpperCase()}</div>
          <div style="flex:1">
            <div class="at-nome">\${esc(a.nome)}</div>
            <div class="at-info">\${a.conversasAtivas} conversas ativas · \${a.totalAtendidos} total</div>
          </div>
          <span class="badge badge-\${a.status}">\${a.status}</span>
        </div>\`).join('')
    } else la.innerHTML = '<div class="empty">Nenhum atendente cadastrado</div>'

    // Campanhas
    const lc = document.getElementById('lista-camp')
    if (camps.length) {
      lc.innerHTML = camps.map(c => {
        const pct = c.relatorio.total ? Math.round(c.relatorio.enviados/c.relatorio.total*100) : 0
        return \`
        <div class="camp-item">
          <div class="camp-nome">\${esc(c.nome)} <span class="badge badge-\${c.status==='concluida'?'online':c.status==='enviando'?'ausente':'offline'}">\${c.status}</span></div>
          <div class="camp-info">\${c.relatorio.enviados}/\${c.relatorio.total} enviados · \${c.relatorio.erros} erros</div>
          \${c.status==='enviando'?\`<div class="prog-bar"><div class="prog-fill" style="width:\${pct}%"></div></div>\`:''}
          \${c.status==='enviando'?\`<button class="btn btn-red" style="margin-top:8px;font-size:12px;padding:5px 10px" onclick="cmd('pausar-campanha',{id:'\${c.id}'})">⏸ Pausar</button>\`:''}
        </div>\`}).join('')
    } else lc.innerHTML = '<div class="empty">Nenhuma campanha criada</div>'

  } catch(e) { console.error(e) }
}

async function setStatus(status) {
  if (!meuId) {
    meuId = prompt('Seu ID de atendente:') || ''
    if (meuId) localStorage.setItem('at_id', meuId)
  }
  await cmd('set-status', { id: meuId, status })
}

async function addAtendente() {
  const nome = document.getElementById('at-nome').value.trim()
  const id   = document.getElementById('at-id').value.trim()
  const senha= document.getElementById('at-senha').value
  if (!nome || !id || !senha) return alert('Preencha todos os campos')
  await cmd('add-atendente', { id, nome, senha })
  document.getElementById('at-nome').value = ''
  document.getElementById('at-id').value   = ''
  document.getElementById('at-senha').value= ''
}

async function criarCampanha(agendar) {
  const nome = document.getElementById('bc-nome').value.trim()
  const msg  = document.getElementById('bc-msg').value.trim()
  const tagsRaw = document.getElementById('bc-tags').value.trim()
  const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()) : []
  if (!nome || !msg) return alert('Preencha nome e mensagem')

  let agendarPara = null
  if (agendar) {
    const dt = prompt('Data e hora (ex: 2025-12-25T09:00):')
    if (!dt) return
    agendarPara = new Date(dt).toISOString()
  }
  await cmd('criar-campanha', { nome, mensagem: msg, tags, agendarPara })
  document.getElementById('bc-nome').value = ''
  document.getElementById('bc-msg').value  = ''
  document.getElementById('bc-tags').value = ''
}

function esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }

atualizar()
intervalo = setInterval(atualizar, 4000)
</script></body></html>`
}

module.exports = { ServidorWeb, getIPLocal }
