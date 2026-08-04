#!/usr/bin/env node
/**
 * ZapBot – Instalador automático
 * Execute: node instalar.js
 */

const { execSync, spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const os = require('os')

const VERDE = '\x1b[32m'
const AMARELO = '\x1b[33m'
const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'

function log(msg)  { console.log(VERDE + '✔ ' + RESET + msg) }
function warn(msg) { console.log(AMARELO + '⚠ ' + RESET + msg) }
function titulo(msg){ console.log('\n' + BOLD + msg + RESET) }

titulo('╔════════════════════════════════╗')
titulo('║   ZapBot – Instalação          ║')
titulo('╚════════════════════════════════╝')

function checkNode() {
  try {
    const v = process.version
    const major = parseInt(v.split('.')[0].replace('v',''))
    if (major < 18) { warn('Node.js 18+ é necessário. Você tem ' + v); process.exit(1) }
    log('Node.js ' + v + ' detectado')
  } catch { warn('Node.js não encontrado'); process.exit(1) }
}

function install() {
  titulo('📦 Instalando dependências...')
  try {
    execSync('npm install', { stdio: 'inherit', cwd: __dirname })
    log('Dependências instaladas!')
  } catch { warn('Erro ao instalar dependências.'); process.exit(1) }
}

function start() {
  titulo('🚀 Iniciando ZapBot...')
  const cmd = os.platform() === 'win32' ? 'npm.cmd' : 'npm'
  const child = spawn(cmd, ['start'], { stdio: 'inherit', cwd: __dirname, shell: true })
  child.on('error', err => { warn('Erro ao iniciar: ' + err.message) })
}

checkNode()
if (!fs.existsSync(path.join(__dirname, 'node_modules'))) {
  install()
}
start()
