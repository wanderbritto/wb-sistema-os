# WB Sistema OS 🔫

Sistema desktop de gestão de Ordens de Serviço para assistência técnica de airsoft (WB Airsoft).

## Funcionalidades

- 🔐 Login com usuários locais
- 📊 Dashboard com indicadores e alertas
- 👥 Cadastro de clientes
- 📋 Ordens de serviço com filtro por status
- 📄 Geração de PDF da OS
- 💬 Envio da OS por WhatsApp
- 📅 Agendamento online (página pública + Supabase)
- 🔧 Revisões periódicas com lembrete automático
- 💰 Financeiro com gráficos
- 📈 Relatórios e rankings
- 💾 Backup e restauração
- 🌗 Tema claro/escuro

## Tecnologias

- Electron 41 · JavaScript · HTML · CSS
- Supabase (agendamentos na nuvem)
- Chart.js (gráficos) · jsPDF (documentos)

## Como executar

1. npm install
2. npm start

## Estrutura

- main.js — janela principal (Electron)
- renderer.js — lógica do aplicativo
- index.html — interface principal
- agendamento.html — página pública de agendamento
- style.css — estilos