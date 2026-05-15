#!/usr/bin/env node
/**
 * Gera ícone SVG → PNG para o ZapBot
 * Requer: npm install sharp (opcional, só para ícone personalizado)
 * Se não tiver sharp, usa ícone padrão do electron-builder
 */
const fs = require('fs')
const path = require('path')

const assetsDir = path.join(__dirname, 'assets')
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir)

// SVG do ícone ZapBot (WhatsApp style)
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="120" fill="#25D366"/>
  <path fill="white" d="M256 80C159 80 80 159 80 256c0 32.8 9 63.4 24.7 89.5L80 432l89-24.3C194.6 423 224.4 432 256 432c97 0 176-79 176-176S353 80 256 80zm88 248c-3.5 9.8-20.6 18.8-28.4 20-7.3 1-16.4 1.4-26.4-1.7-6.1-1.9-13.9-4.4-23.9-8.7C228 323 196 291 185 272c-7.4-12.5-11.6-26.2-11.8-40.2-.2-13.6 4.6-25.4 12.8-34.3 3.8-4.2 8.3-5.2 11.1-5.2.8 0 1.6 0 2.3.1 3 .1 4.5.3 6.5 5l14 33c2 4.5 1.4 7.4-.3 10l-5.8 7.4c-.8 1.2-1.7 2.4-.7 4.7 4.3 8.4 11.4 18.8 21.9 26.8 15 11.3 26.8 14.8 30.6 16.3 1.5.6 3.3.4 4.4-.9l8.3-9.9c2.5-3 5.3-3.5 8.9-2.3l32.4 15.3c3 1.4 3.3 2.8 2.8 6.5z"/>
</svg>`

const svgPath = path.join(assetsDir, 'icon.svg')
fs.writeFileSync(svgPath, svg)
console.log('✔ SVG gerado em assets/icon.svg')

// Tenta converter com sharp se disponível
try {
  const sharp = require('sharp')
  
  Promise.all([
    // PNG 512x512 (Linux)
    sharp(Buffer.from(svg)).resize(512, 512).png().toFile(path.join(assetsDir, 'icon.png')),
    // PNG 256x256 (para ICO)
    sharp(Buffer.from(svg)).resize(256, 256).png().toFile(path.join(assetsDir, 'icon-256.png')),
  ]).then(() => {
    console.log('✔ PNGs gerados!')
    console.log('⚠ Para gerar o .ico (Windows), instale: npm install -g png-to-ico')
    console.log('  Depois rode: png-to-ico assets/icon-256.png > assets/icon.ico')
  })
} catch {
  console.log('ℹ sharp não instalado — usando ícone padrão do electron-builder.')
  console.log('  Para ícone personalizado: npm install sharp && node gerar-icone.js')
}
