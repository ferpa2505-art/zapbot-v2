# 🤖 ZapBot v2.0 – Chatbot WhatsApp para Pequenas Empresas

Aplicativo desktop que automatiza o atendimento via WhatsApp usando QR Code — sem pagar API, sem configuração técnica complexa.

## ✨ Novidades da v2.0

- 📅 Horários dia a dia (cada dia com abertura/fechamento individual)
- 🗓 Feriados automáticos por cidade (nacional + estadual via BrasilAPI)
- 🌓 Tema claro / escuro / automático
- 🖼️ Marca d'água com logo da empresa
- 🎨 Cor de destaque personalizável

## ⚡ Requisitos

- **Node.js 18+** → https://nodejs.org (versão LTS)
- Windows 10/11, macOS 11+ ou Linux Ubuntu 20+

## 🚀 Como instalar e rodar

### Windows
1. Extraia o ZIP
2. Dê dois cliques no `INICIAR.bat`

### Mac / Linux
```bash
node instalar.js
```

## 📱 Conectar WhatsApp
1. Clique em **Conectar WhatsApp**
2. No celular: WhatsApp → Menu → Dispositivos conectados → Conectar dispositivo
3. Escaneie o QR Code

## ⚙️ Módulos

| Aba | Funcionalidade |
|-----|---------------|
| Meu negócio | Tipo, nome, horário, endereço |
| Agente | Nome, tom, jargões, comportamento |
| Voz & idioma | Google TTS, sotaque, gênero |
| Horários | Dia a dia + feriados automáticos |
| Fluxo | Menu, escalada, comportamento |
| Mensagens | Todos os textos do bot |
| IA & análise | Claude Vision, imagens, PDFs |
| Pós-atend. | Lembretes, satisfação, reengajamento |
| Problemas | Emergências, reclamações, cobranças |
| Google Agenda | Agendamento integrado |
| Broadcast | Campanhas segmentadas |
| Aparência | Tema, cor, marca d'água |
| Licença | Beta 7 dias, licença paga |
| Monitor | Conversas ao vivo |

## 🛠 Gerar instalador .exe

```bash
node gerar-exe.js
```

---
ZapBot v2.0 — Desenvolvido com Electron + Baileys
