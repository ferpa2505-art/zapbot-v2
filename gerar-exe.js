#!/usr/bin/env node
/**
 * ╔══════════════════════════════════════════╗
 * ║   ZapBot v3 – Gerador de instalador .exe ║
 * ║   Execute: node gerar-exe.js             ║
 * ╚══════════════════════════════════════════╝
 *
 * Pré-requisito: Node.js 18+ → https://nodejs.org
 * Funciona em: Windows 10/11, macOS 11+, Ubuntu 20+
 */

const { execSync } = require('child_process')
const fs   = require('fs')
const path = require('path')
const os   = require('os')
const https = require('https')

const G  = '\x1b[32m', A = '\x1b[33m', R = '\x1b[31m', B = '\x1b[1m', X = '\x1b[0m'
const ok   = m => console.log(G + '  ✔ ' + X + m)
const warn = m => console.log(A + '  ⚠ ' + X + m)
const err  = m => console.log(R + '  ✖ ' + X + m)
const info = m => console.log('  → ' + m)
const h1   = m => console.log('\n' + B + m + X)

h1('╔══════════════════════════════════════════╗')
h1('║   ZapBot – Gerando instalador .exe       ║')
h1('╚══════════════════════════════════════════╝\n')

const plat = os.platform()
const isWin = plat === 'win32'
const isMac = plat === 'darwin'

function run(cmd, label, opts = {}) {
  info(label || cmd)
  try {
    execSync(cmd, { stdio: 'inherit', cwd: __dirname, shell: true, ...opts })
    ok('Concluído')
    return true
  } catch(e) {
    err('Falhou. Veja o erro acima.')
    return false
  }
}

// ── 1. Verificar Node.js ──────────────────────────────────────────────────────
h1('1/5  Verificando ambiente...')
const nodeVer = parseInt(process.version.replace('v','').split('.')[0])
if (nodeVer < 18) { err('Node.js 18+ necessário. Baixe em https://nodejs.org'); process.exit(1) }
ok(`Node.js ${process.version} (${plat} ${os.arch()})`)
if (!isWin) warn('Para gerar .exe no Mac/Linux instale o Wine: brew install --cask wine-stable')

// ── 2. Instalar dependências ──────────────────────────────────────────────────
h1('2/5  Instalando dependências...')

const nm = path.join(__dirname, 'node_modules')
if (!fs.existsSync(nm)) {
  if (!run('npm install', 'Instalando dependências de produção...')) process.exit(1)
} else {
  ok('node_modules já existe')
}

// electron + electron-builder
const ebPath = path.join(nm, 'electron-builder')
if (!fs.existsSync(ebPath)) {
  if (!run('npm install --save-dev electron@31 electron-builder@24', 'Instalando Electron e electron-builder...')) process.exit(1)
} else {
  ok('Electron e electron-builder já instalados')
}

// ── 3. Gerar ícone ────────────────────────────────────────────────────────────
h1('3/5  Gerando ícone...')

const assetsDir = path.join(__dirname, 'assets')
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir)

// SVG do ícone
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="110" fill="#111827"/>
  <rect x="12" y="12" width="488" height="488" rx="100" fill="#25D366"/>
  <path fill="#fff" d="M256 72C155.4 72 73 154.4 73 255c0 35 9.7 67.7 26.6 95.7L72 440l92.3-24.1C191.2 431 222.9 440 256 440c100.6 0 183-82.4 183-185S356.6 72 256 72zm95.6 264.8c-4 11-23.2 21.1-32 22.3-8.2 1.1-18.5 1.6-29.8-1.9-6.9-2.1-15.7-5-26.9-9.8-47.4-20.4-78.3-68-80.7-71.2-2.3-3.1-19.3-25.6-19.3-48.9 0-23.3 12.2-34.8 16.6-39.6 4.3-4.7 9.4-5.9 12.6-5.9.9 0 1.8 0 2.6.1 3.4.1 5.1.3 7.4 5.7l15.8 37.3c2.2 5.1 1.5 8.4-.4 11.4l-6.5 8.4c-1 1.4-1.9 2.7-.8 5.3 4.9 9.5 12.9 21.3 24.7 30.3 17 12.8 30.3 16.7 34.6 18.5 1.7.7 3.8.5 5-.9l9.4-11.2c2.8-3.4 6-4 10.1-2.6l36.7 17.3c3.4 1.6 3.7 3.2 3.1 7.4z"/>
</svg>`

const svgPath = path.join(assetsDir, 'icon.svg')
fs.writeFileSync(svgPath, svg)
ok('SVG do ícone gerado')

// Tenta gerar PNG com sharp
let iconGerado = false
try {
  const sharp = require('sharp')
  const buf = Buffer.from(svg)
  sharp(buf).resize(512,512).png().toFile(path.join(assetsDir,'icon.png'), (e) => { if(!e) ok('icon.png gerado') })
  sharp(buf).resize(256,256).png().toFile(path.join(assetsDir,'icon-256.png'), () => {})
  iconGerado = true
} catch {
  try {
    info('Instalando sharp para gerar ícone PNG...')
    execSync('npm install sharp', { stdio: 'inherit', cwd: __dirname, shell: true })
    const sharp = require('sharp')
    const buf = Buffer.from(svg)
    sharp(buf).resize(512,512).png().toFile(path.join(assetsDir,'icon.png'), () => {})
    sharp(buf).resize(256,256).png().toFile(path.join(assetsDir,'icon-256.png'), () => {})
    iconGerado = true
    ok('icon.png gerado com sharp')
  } catch {
    warn('Não foi possível gerar PNG — será usado ícone padrão do Electron.')
    warn('Para ícone personalizado: npm install sharp && node gerar-exe.js')
  }
}

// No Windows, tenta gerar .ico a partir do PNG
if (isWin && iconGerado) {
  try {
    execSync('npm list -g png-to-ico', { stdio: 'pipe' })
    execSync(`png-to-ico ${path.join(assetsDir,'icon-256.png')} > ${path.join(assetsDir,'icon.ico')}`, { shell: true, cwd: __dirname })
    ok('icon.ico gerado')
  } catch {
    warn('png-to-ico não encontrado. Execute: npm install -g png-to-ico')
    warn('Continuando com ícone padrão...')
  }
}

// ── 4. Build ──────────────────────────────────────────────────────────────────
h1('4/5  Compilando o aplicativo...')
info('Isso pode levar 3–10 minutos na primeira vez (Electron é baixado ~100MB)\n')

let buildOk = false
if (isWin) {
  buildOk = run('npx electron-builder --win --x64', 'Gerando instalador Windows (.exe)...')
} else if (isMac) {
  buildOk = run('npx electron-builder --mac', 'Gerando DMG para Mac...')
} else {
  buildOk = run('npx electron-builder --linux', 'Gerando AppImage para Linux...')
  if (!buildOk) {
    warn('Tentando formato deb...')
    buildOk = run('npx electron-builder --linux deb', 'Gerando .deb...')
  }
}

if (!buildOk) {
  err('\nBuild falhou. Soluções comuns:')
  info('1. Verifique sua conexão com a internet')
  info('2. Rode como Administrador (Windows) ou com sudo (Linux/Mac)')
  info('3. Apague node_modules e rode novamente')
  process.exit(1)
}

// ── 5. Resultado ──────────────────────────────────────────────────────────────
h1('5/5  Pronto!')

const distDir = path.join(__dirname, 'dist')
if (fs.existsSync(distDir)) {
  const arquivos = fs.readdirSync(distDir).filter(f => /\.(exe|dmg|AppImage|deb|msi)$/i.test(f))
  if (arquivos.length) {
    console.log('')
    arquivos.forEach(f => {
      const sz = (fs.statSync(path.join(distDir,f)).size / 1024 / 1024).toFixed(1)
      ok(`dist/${f}  —  ${sz} MB`)
    })
    console.log('')
    ok('Instalador gerado com sucesso!')
    info('Envie o arquivo acima para seu cliente.')
    info('O cliente instala dando dois cliques — sem precisar do Node.js.')
  }
}

console.log('\n' + G + B + '  ZapBot pronto para distribuição! 🚀' + X + '\n')
