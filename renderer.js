// ========== BIBLIOTECAS ==========
const { jsPDF } = require('jspdf');
require('jspdf-autotable');
const { createClient } = require('@supabase/supabase-js');

// ========== CONFIGURAÇÕES ==========
const SUPABASE_URL = 'https://cmdbhxnlhwwfssodtxpl.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ejR2-145S05asosBAk5M0g_8Kvcz9Z4';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ========== AUTENTICAÇÃO ==========
let usuarioAtual = null;
const USUARIOS_KEY = 'wb_os_usuarios';

function carregarUsuarios() {
    const usuarios = localStorage.getItem(USUARIOS_KEY);
    if (usuarios) return JSON.parse(usuarios);
    const defaultUsers = [{ id: 1, nome: "Wander", usuario: "wander", senha: btoa("123456"), email: "wander@wb.com" }];
    localStorage.setItem(USUARIOS_KEY, JSON.stringify(defaultUsers));
    return defaultUsers;
}

function fazerLogin(usuario, senha) {
    const usuarios = carregarUsuarios();
    const user = usuarios.find(u => u.usuario === usuario);
    if (user && atob(user.senha) === senha) {
        usuarioAtual = { id: user.id, nome: user.nome, usuario: user.usuario };
        localStorage.setItem('wb_os_sessao', JSON.stringify(usuarioAtual));
        return true;
    }
    return false;
}

function verificarSessao() {
    const sessao = localStorage.getItem('wb_os_sessao');
    if (sessao) {
        usuarioAtual = JSON.parse(sessao);
        return true;
    }
    return false;
}

function fazerLogout() {
    localStorage.removeItem('wb_os_sessao');
    usuarioAtual = null;
    location.reload();
}

function registrarUsuario(nome, usuario, senha, confirmarSenha) {
    if (!nome || !usuario || !senha) { alert('Preencha todos os campos!'); return false; }
    if (senha !== confirmarSenha) { alert('As senhas não coincidem!'); return false; }
    if (senha.length < 4) { alert('A senha deve ter no mínimo 4 caracteres!'); return false; }
    
    const usuarios = carregarUsuarios();
    if (usuarios.find(u => u.usuario === usuario)) { alert('Usuário já existe!'); return false; }
    
    usuarios.push({ id: Date.now(), nome, usuario, senha: btoa(senha), email: '' });
    localStorage.setItem(USUARIOS_KEY, JSON.stringify(usuarios));
    alert('✅ Usuário cadastrado! Faça login.');
    return true;
}

function recuperarSenha(usuario, email) {
    const usuarios = carregarUsuarios();
    const user = usuarios.find(u => u.usuario === usuario);
    if (user) { alert(`Sua senha é: ${atob(user.senha)}`); return true; }
    alert('Usuário não encontrado!');
    return false;
}

function mostrarInterfaceUsuario() {
    const userNomeSpan = document.getElementById('user-nome');
    if (userNomeSpan && usuarioAtual) userNomeSpan.textContent = usuarioAtual.nome;
}

// ========== DADOS ==========
let clientes = [];
let ordens = [];
let agendamentos = [];

// ========== AGENDAMENTOS COM SUPABASE ==========
async function carregarAgendamentosSupabase() {
    try {
        const { data, error } = await supabase.from('agendamentos').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        agendamentos = data || [];
        return agendamentos;
    } catch (error) {
        console.error('Erro ao carregar agendamentos:', error);
        agendamentos = [];
        return [];
    }
}

async function excluirAgendamentoSupabase(id) {
    try {
        await supabase.from('agendamentos').delete().eq('id', id);
        await carregarAgendamentosSupabase();
        renderDashboard();
    } catch (error) { console.error('Erro ao excluir:', error); }
}

async function marcarAgendamentoComoLidoSupabase(id) {
    try {
        await supabase.from('agendamentos').update({ status: 'lido' }).eq('id', id);
        await carregarAgendamentosSupabase();
    } catch (error) { console.error('Erro ao marcar como lido:', error); }
}

function criarOSdoAgendamento(agendamento) {
    let cliente = clientes.find(c => c.telefone === agendamento.telefone);
    if (!cliente) {
        cliente = { id: Date.now(), nome: agendamento.nome, telefone: agendamento.telefone, email: '' };
        clientes.push(cliente);
        salvarClientes();
    }
    renderNovaOS();
    setTimeout(() => {
        const clienteSelect = document.getElementById('clienteId');
        if (clienteSelect) clienteSelect.value = cliente.id;
        const equipamentoInput = document.getElementById('equipamento');
        if (equipamentoInput) equipamentoInput.value = agendamento.equipamento;
        const obsTextarea = document.getElementById('descricao');
        if (obsTextarea) obsTextarea.value = `Agendamento: ${agendamento.data} às ${agendamento.horario}\nObservações: ${agendamento.obs || 'Nenhuma'}`;
    }, 100);
}

// ========== FUNÇÕES DE PDF ==========
function salvarPDFComEscolha(blob, nomeArquivo) {
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = nomeArquivo;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    alert('✅ PDF gerado! Escolha o local para salvar.');
}

async function enviarPDF_WA(pdfBlob, nomeArquivo, cliente, os) {
    if (!cliente?.telefone) {
        alert('❌ Cliente não tem telefone cadastrado!');
        salvarPDFComEscolha(pdfBlob, nomeArquivo);
        return;
    }
    const confirmar = confirm(`📱 Enviar OS via WhatsApp para ${cliente.nome}?\nTelefone: ${cliente.telefone}`);
    if (!confirmar) { salvarPDFComEscolha(pdfBlob, nomeArquivo); return; }
    
    const mensagem = `🔫 *WB AIRSOFT - ORDEM DE SERVIÇO* 🔫\n\nOlá *${cliente.nome}*,\n\nSegue OS do seu equipamento.\n📋 *OS:* ${os.id.toString().slice(-8)}\n🔧 *Equipamento:* ${os.equipamento || 'Não informado'}\n💰 *Valor:* R$ ${(os.valor || 0).toFixed(2)}\n📅 *Entrada:* ${formatarData(os.data)}\n\n*WB Airsoft* 🔫`;
    const telefone = cliente.telefone.replace(/\D/g, '');
    window.open(`https://wa.me/55${telefone}?text=${encodeURIComponent(mensagem)}`, '_blank');
    alert(`✅ WhatsApp aberto!\nEnvie a mensagem e anexe o PDF:\n${nomeArquivo}`);
    salvarPDFComEscolha(pdfBlob, nomeArquivo);
}

async function gerarPDF_OS(osId, enviarWhatsApp = false) {
    const os = ordens.find(o => o.id === osId);
    if (!os) { alert('OS não encontrada!'); return; }
    const cliente = clientes.find(c => c.id === os.clienteId);
    if (!cliente) { alert('Cliente não encontrado!'); return; }
    
    try {
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const corPrimaria = [0, 51, 102];
        const corSecundaria = [0, 102, 204];
        const corDestaque = [220, 53, 69];
        
        // CABEÇALHO
        doc.setFillColor(corPrimaria[0], corPrimaria[1], corPrimaria[2]);
        doc.rect(0, 0, 210, 45, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text('WB AIRSOFT', 20, 22);
        doc.setFontSize(9);
        doc.text('Ordem de Serviço - Manutenção Especializada', 20, 35);
        doc.setFontSize(12);
        doc.text(`OS #${os.id.toString().slice(-8)}`, 170, 22, { align: 'right' });
        doc.text(`Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 170, 35, { align: 'right' });
        
        // STATUS
        const statusText = os.status === 'pendente' ? 'PENDENTE' : os.status === 'andamento' ? 'EM ANDAMENTO' : os.status === 'concluido' ? 'CONCLUÍDO' : 'PENDENTE';
        doc.setFillColor(100, 100, 100);
        doc.roundedRect(150, 48, 50, 8, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.text(statusText, 175, 55, { align: 'center' });
        
        let yPos = 70;
        
        // DADOS DO CLIENTE
        doc.setFillColor(corSecundaria[0], corSecundaria[1], corSecundaria[2]);
        doc.rect(15, yPos, 180, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.text('DADOS DO CLIENTE', 20, yPos + 5.5);
        yPos += 12;
        doc.setFillColor(248, 249, 250);
        doc.roundedRect(15, yPos - 3, 180, 35, 3, 3, 'F');
        doc.setTextColor(60, 60, 60);
        doc.setFontSize(10);
        doc.text(`Nome: ${cliente.nome}`, 25, yPos + 5);
        doc.text(`Telefone: ${cliente.telefone || 'Não informado'}`, 25, yPos + 15);
        doc.text(`E-mail: ${cliente.email || 'Não informado'}`, 25, yPos + 25);
        yPos += 42;
        
        // DADOS DO EQUIPAMENTO
        doc.setFillColor(corSecundaria[0], corSecundaria[1], corSecundaria[2]);
        doc.rect(15, yPos, 180, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.text('DADOS DO EQUIPAMENTO', 20, yPos + 5.5);
        yPos += 12;
        doc.setFillColor(248, 249, 250);
        doc.roundedRect(15, yPos - 3, 180, 25, 3, 3, 'F');
        doc.setTextColor(60, 60, 60);
        doc.text(`Equipamento: ${os.equipamento || 'Não informado'}`, 25, yPos + 5);
        doc.text(`Data de entrada: ${formatarData(os.data)}`, 25, yPos + 15);
        yPos += 32;
        
        // DESCRIÇÃO
        doc.setFillColor(corSecundaria[0], corSecundaria[1], corSecundaria[2]);
        doc.rect(15, yPos, 180, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.text('DESCRIÇÃO DO SERVIÇO', 20, yPos + 5.5);
        yPos += 12;
        const descricao = os.descricao || 'Sem descrição detalhada';
        const linhasDescricao = doc.splitTextToSize(descricao, 170);
        const alturaDesc = Math.max(20, linhasDescricao.length * 5 + 5);
        doc.setFillColor(248, 249, 250);
        doc.roundedRect(15, yPos - 3, 180, alturaDesc, 3, 3, 'F');
        doc.setTextColor(80, 80, 80);
        doc.setFontSize(9);
        doc.text(linhasDescricao, 20, yPos + 3);
        yPos += alturaDesc + 10;
        
        // TABELA DE VALORES
        const valorTotal = os.valor || 0;
        doc.setFillColor(corPrimaria[0], corPrimaria[1], corPrimaria[2]);
        doc.rect(15, yPos, 180, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.text('DESCRIÇÃO', 20, yPos + 5.5);
        doc.text('VALOR (R$)', 160, yPos + 5.5, { align: 'right' });
        yPos += 10;
        doc.setFillColor(248, 249, 250);
        doc.rect(15, yPos - 2, 180, 8, 'F');
        doc.setTextColor(60, 60, 60);
        doc.text('Serviço de manutenção especializada', 20, yPos + 3);
        doc.text(`R$ ${valorTotal.toFixed(2)}`, 160, yPos + 3, { align: 'right' });
        yPos += 12;
        doc.setDrawColor(200, 200, 200);
        doc.line(15, yPos - 2, 195, yPos - 2);
        doc.setFillColor(233, 236, 239);
        doc.rect(15, yPos, 180, 8, 'F');
        doc.setTextColor(corDestaque[0], corDestaque[1], corDestaque[2]);
        doc.setFontSize(10);
        doc.text('TOTAL GERAL', 140, yPos + 5.5);
        doc.text(`R$ ${valorTotal.toFixed(2)}`, 160, yPos + 5.5, { align: 'right' });
        yPos += 20;
        
        // OBSERVAÇÕES
        doc.setFillColor(corSecundaria[0], corSecundaria[1], corSecundaria[2]);
        doc.rect(15, yPos, 180, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.text('INFORMAÇÕES ADICIONAIS', 20, yPos + 5.5);
        yPos += 12;
        doc.setFillColor(248, 249, 250);
        doc.roundedRect(15, yPos - 3, 180, 28, 3, 3, 'F');
        doc.setTextColor(80, 80, 80);
        doc.setFontSize(8);
        doc.text('• Garantia de 30 dias sobre o serviço realizado', 20, yPos + 4);
        doc.text('• Peças substituídas têm garantia do fabricante', 20, yPos + 12);
        doc.text('• O prazo de execução será informado no momento', 20, yPos + 20);
        yPos += 35;
        
        // ASSINATURAS
        doc.setDrawColor(150, 150, 150);
        doc.setLineWidth(0.5);
        doc.line(30, yPos, 85, yPos);
        doc.line(125, yPos, 180, yPos);
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(8);
        doc.text('Assinatura do Cliente', 45, yPos + 5);
        doc.text('Assinatura do Técnico', 140, yPos + 5);
        
        // RODAPÉ
        doc.setFillColor(corPrimaria[0], corPrimaria[1], corPrimaria[2]);
        doc.rect(0, 285, 210, 12, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7);
        doc.text('WB Airsoft - Especialista em manutenção de equipamentos Airsoft', 105, 290, { align: 'center' });
        doc.text('📍 Retirada e devolução na loja | ⏰ Horário comercial: 09h às 18h', 105, 296, { align: 'center' });
        
        const pdfBlob = doc.output('blob');
        const nomeArquivo = `OS_${os.id.toString().slice(-8)}_${cliente.nome.replace(/\s/g, '_')}.pdf`;
        
        if (enviarWhatsApp) {
            await enviarPDF_WA(pdfBlob, nomeArquivo, cliente, os);
        } else {
            salvarPDFComEscolha(pdfBlob, nomeArquivo);
        }
    } catch (error) {
        console.error('❌ Erro ao gerar PDF:', error);
        alert('Erro ao gerar PDF: ' + error.message);
    }
}

// ========== RENDER TODOS OS AGENDAMENTOS ==========
async function renderAgendamentos() {
    await carregarAgendamentosSupabase();
    const html = `
        <div class="card-agendamentos">
            <div class="agendamentos-header">
                <h3>📅 Histórico de Agendamentos</h3>
                <button id="btn-voltar-dashboard" class="btn-voltar">← Voltar ao Dashboard</button>
            </div>
            <div class="lista-agendamentos">
                ${agendamentos.length === 0 ? '<div class="empty-message">📭 Nenhum agendamento recebido ainda</div>' : agendamentos.map(a => `
                    <div class="agendamento-card ${a.status === 'pendente' ? 'agendamento-pendente' : 'agendamento-lido'}">
                        <div><strong>👤 ${a.nome}</strong><span class="agendamento-status ${a.status}">${a.status === 'pendente' ? '📌 Pendente' : '✅ Processado'}</span></div>
                        <div class="agendamento-detalhes">
                            <div>📞 ${a.telefone}</div><div>🔫 ${a.equipamento}</div>
                            <div>📅 ${a.data} às ${a.horario}</div><div>📝 ${a.obs || 'Sem observações'}</div>
                            <small>📨 Recebido em: ${new Date(a.created_at).toLocaleString('pt-BR')}</small>
                        </div>
                        <div class="agendamento-actions">
                            ${a.status === 'pendente' ? `<button class="btn-criar-os-agendamento-lista" data-id="${a.id}">➕ Criar OS</button>` : ''}
                            <button class="btn-excluir-agendamento-lista" data-id="${a.id}">🗑️ Excluir</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    document.getElementById('content-area').innerHTML = html;
    document.getElementById('page-title').textContent = 'Agendamentos';
    document.getElementById('btn-voltar-dashboard')?.addEventListener('click', () => { renderDashboard(); document.getElementById('page-title').textContent = 'Dashboard'; });
    document.querySelectorAll('.btn-criar-os-agendamento-lista').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = parseInt(btn.dataset.id);
            const agendamento = agendamentos.find(a => a.id === id);
            if (agendamento) { criarOSdoAgendamento(agendamento); await marcarAgendamentoComoLidoSupabase(id); }
        });
    });
    document.querySelectorAll('.btn-excluir-agendamento-lista').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (confirm('Excluir este agendamento?')) { await excluirAgendamentoSupabase(parseInt(btn.dataset.id)); await renderAgendamentos(); }
        });
    });
}

// ========== SISTEMA DE LEMBRETE DE REVISÃO ==========
function calcularProximaRevisao(dataOS) {
    const data = new Date(dataOS);
    data.setMonth(data.getMonth() + 6);
    return data.toISOString().split('T')[0];
}

function getRevisoesPendentes() {
    const revisoes = [];
    ordens.forEach(os => {
        if (os.status === 'concluido' && os.data) {
            const proximaRevisao = calcularProximaRevisao(os.data);
            const cliente = clientes.find(c => c.id === os.clienteId);
            if (cliente) revisoes.push({
                osId: os.id, clienteId: cliente.id, clienteNome: cliente.nome,
                clienteTelefone: cliente.telefone, equipamento: os.equipamento || 'Não informado',
                dataUltimaOS: os.data, dataProximaRevisao: proximaRevisao,
                status: new Date(proximaRevisao) < new Date() ? 'atrasada' : 'proxima'
            });
        }
    });
    return revisoes;
}

function enviarLembreteRevisaoWhatsApp(clienteNome, clienteTelefone, equipamento) {
    if (!clienteTelefone) { alert('Cliente não tem telefone cadastrado!'); return; }
    const telefone = clienteTelefone.replace(/\D/g, '');
    const mensagem = `🔧 *WB Airsoft - Lembrete de Revisão*\n\nOlá ${clienteNome}! Seu equipamento (${equipamento}) já está na hora de uma revisão periódica.\n\n📅 Agende uma visita para manutenção preventiva.\n\n*WB Airsoft - Qualidade e confiança!* 🔫`;
    window.open(`https://wa.me/55${telefone}?text=${encodeURIComponent(mensagem)}`, '_blank');
}

function renderTodasRevisoes() {
    const revisoes = getRevisoesPendentes();
    const revisoesProximas = revisoes.filter(r => r.status === 'proxima');
    const revisoesAtrasadas = revisoes.filter(r => r.status === 'atrasada');
    const html = `
        <div class="card">
            <div class="revisoes-header"><h3>🔧 Revisões Periódicas</h3><button id="btn-voltar-dashboard-revisoes" class="btn-voltar-revisoes">← Voltar</button></div>
            <div style="padding: 20px;">
                ${revisoes.length === 0 ? '<div class="empty-message">✅ Nenhuma revisão pendente</div>' : `
                    ${revisoesAtrasadas.length > 0 ? `<h4 style="color:#f44336;">⚠️ ATRASADAS</h4>${revisoesAtrasadas.map(r => `
                        <div class="revisao-item ${r.status}"><div><strong>👤 ${r.clienteNome}</strong><br>🔫 ${r.equipamento}<br>📅 Próxima revisão: ${new Date(r.dataProximaRevisao).toLocaleDateString('pt-BR')}</div>
                        <button class="btn-enviar-lembrete-lista" data-cliente="${r.clienteNome}" data-telefone="${r.clienteTelefone}" data-equipamento="${r.equipamento}">💬 Enviar Lembrete</button></div>
                    `).join('')}` : ''}
                    ${revisoesProximas.length > 0 ? `<h4 style="color:#ff9800;">⏰ PRÓXIMAS</h4>${revisoesProximas.map(r => `
                        <div class="revisao-item ${r.status}"><div><strong>👤 ${r.clienteNome}</strong><br>🔫 ${r.equipamento}<br>📅 Próxima revisão: ${new Date(r.dataProximaRevisao).toLocaleDateString('pt-BR')}</div>
                        <button class="btn-enviar-lembrete-lista" data-cliente="${r.clienteNome}" data-telefone="${r.clienteTelefone}" data-equipamento="${r.equipamento}">💬 Enviar Lembrete</button></div>
                    `).join('')}` : ''}
                `}
            </div>
        </div>
    `;
    document.getElementById('content-area').innerHTML = html;
    document.getElementById('page-title').textContent = 'Revisões';
    document.getElementById('btn-voltar-dashboard-revisoes')?.addEventListener('click', () => { renderDashboard(); document.getElementById('page-title').textContent = 'Dashboard'; });
    document.querySelectorAll('.btn-enviar-lembrete-lista').forEach(btn => {
        btn.addEventListener('click', () => enviarLembreteRevisaoWhatsApp(btn.dataset.cliente, btn.dataset.telefone, btn.dataset.equipamento));
    });
}

// ========== FUNÇÕES AUXILIARES ==========
function carregarDados() {
    const clientesSalvo = localStorage.getItem('wb_os_clientes');
    const ordensSalvo = localStorage.getItem('wb_os_ordens');
    if (clientesSalvo) clientes = JSON.parse(clientesSalvo);
    if (ordensSalvo) ordens = JSON.parse(ordensSalvo);
    if (clientes.length === 0) {
        clientes = [{ id: 1, nome: "João Silva", telefone: "(11) 99999-9999", email: "joao@email.com" }, { id: 2, nome: "Maria Santos", telefone: "(11) 88888-8888", email: "maria@email.com" }];
        localStorage.setItem('wb_os_clientes', JSON.stringify(clientes));
    }
}

function salvarClientes() { localStorage.setItem('wb_os_clientes', JSON.stringify(clientes)); }
function salvarOrdens() { localStorage.setItem('wb_os_ordens', JSON.stringify(ordens)); }
function getDataAtual() { return new Date().toISOString().split('T')[0]; }
function formatarData(dataISO) { if (!dataISO) return ''; const p = dataISO.split('-'); return `${p[2]}/${p[1]}/${p[0]}`; }
function atualizarContador() { const c = document.getElementById('contador-os'); if (c) c.textContent = `${ordens.length} OS`; }

// ========== RENDER DASHBOARD ==========
async function renderDashboard() {
    console.log('Renderizando Dashboard...');
    await carregarAgendamentosSupabase();
    const agendamentosPendentes = agendamentos.filter(a => a.status === 'pendente');
    const revisoes = getRevisoesPendentes();
    const totalRevisoes = revisoes.length;
    
    const contentArea = document.getElementById('content-area');
    if (!contentArea) return;
    
    const totalClientes = clientes.length;
    const totalOrdens = ordens.length;
    const totaisStatus = {
        pendente: ordens.filter(o => o.status === 'pendente').length,
        andamento: ordens.filter(o => o.status === 'andamento').length,
        concluido: ordens.filter(o => o.status === 'concluido').length,
        aguardando_aprovacao: ordens.filter(o => o.status === 'aguardando_aprovacao').length,
        aguardando_pagamento: ordens.filter(o => o.status === 'aguardando_pagamento').length,
        cancelado: ordens.filter(o => o.status === 'cancelado').length
    };
    const ultimasOS = [...ordens].reverse().slice(0, 5);
    
    contentArea.innerHTML = `
        <div class="dashboard-profissional">
            <div class="welcome-header"><h2>👋 Olá, ${usuarioAtual?.nome || 'Usuário'}!</h2><p>Bem-vindo ao seu sistema de gestão de ordens de serviço</p></div>
            <div class="stats-grid-dashboard">
                <div class="stat-card-dashboard"><div class="stat-icon">👥</div><div class="stat-info"><div class="stat-number">${totalClientes}</div><div class="stat-label">Clientes</div></div></div>
                <div class="stat-card-dashboard"><div class="stat-icon">📋</div><div class="stat-info"><div class="stat-number">${totalOrdens}</div><div class="stat-label">Total de OS</div></div></div>
            </div>
            <div class="revisoes-card"><div class="revisoes-header"><h3>🔧 Revisões Periódicas ${totalRevisoes > 0 ? `<span class="badge-revisao">${totalRevisoes} pendente(s)</span>` : ''}</h3><button id="btn-ver-todas-revisoes" class="btn-ver-revisoes">Ver todas →</button></div>
                ${totalRevisoes === 0 ? '<div class="empty-message">✅ Nenhuma revisão pendente</div>' : `<div class="revisoes-lista">${revisoes.slice(0, 3).map(r => `<div class="revisao-item ${r.status}"><div><strong>👤 ${r.clienteNome}</strong><br>🔫 ${r.equipamento}<br>📅 Próxima: ${new Date(r.dataProximaRevisao).toLocaleDateString('pt-BR')}</div><button class="btn-enviar-lembrete" data-cliente="${r.clienteNome}" data-telefone="${r.clienteTelefone}" data-equipamento="${r.equipamento}">💬 Enviar</button></div>`).join('')}${totalRevisoes > 3 ? `<div class="mais-revisoes">+ ${totalRevisoes - 3} revisão(ões)</div>` : ''}</div>`}
            </div>
            <div class="agendamentos-card"><div class="agendamentos-header"><h3>📅 Novos Agendamentos ${agendamentosPendentes.length > 0 ? `<span class="badge-novo">${agendamentosPendentes.length} novo(s)</span>` : ''}</h3><button id="btn-ver-agendamentos" class="btn-ver-agendamentos">Ver todos →</button></div>
                ${agendamentosPendentes.length === 0 ? '<div class="empty-message">Nenhum agendamento pendente</div>' : `<div class="agendamentos-lista">${agendamentosPendentes.slice(0, 3).map(a => `<div class="agendamento-item"><div class="agendamento-info"><strong>👤 ${a.nome}</strong><span>📞 ${a.telefone}</span><span>🔫 ${a.equipamento}</span><span>📅 ${a.data} às ${a.horario}</span></div><div class="agendamento-actions"><button class="btn-criar-os-agendamento" data-id="${a.id}">➕ Criar OS</button><button class="btn-ignorar-agendamento" data-id="${a.id}">🗑️ Ignorar</button></div></div>`).join('')}${agendamentosPendentes.length > 3 ? `<div class="mais-agendamentos">+ ${agendamentosPendentes.length - 3} agendamento(s)</div>` : ''}</div>`}
            </div>
            <div class="status-cards-grid">
                <div class="status-card-item status-pendente"><div class="status-card-icon">⏳</div><div class="status-card-info"><div class="status-card-number">${totaisStatus.pendente}</div><div class="status-card-label">Pendentes</div></div></div>
                <div class="status-card-item status-aprovacao"><div class="status-card-icon">📋</div><div class="status-card-info"><div class="status-card-number">${totaisStatus.aguardando_aprovacao}</div><div class="status-card-label">Aguardando Aprovação</div></div></div>
                <div class="status-card-item status-pagamento"><div class="status-card-icon">💳</div><div class="status-card-info"><div class="status-card-number">${totaisStatus.aguardando_pagamento}</div><div class="status-card-label">Aguardando Pagamento</div></div></div>
                <div class="status-card-item status-andamento"><div class="status-card-icon">🔧</div><div class="status-card-info"><div class="status-card-number">${totaisStatus.andamento}</div><div class="status-card-label">Em Andamento</div></div></div>
                <div class="status-card-item status-concluido"><div class="status-card-icon">✅</div><div class="status-card-info"><div class="status-card-number">${totaisStatus.concluido}</div><div class="status-card-label">Concluídos</div></div></div>
                <div class="status-card-item status-cancelado"><div class="status-card-icon">❌</div><div class="status-card-info"><div class="status-card-number">${totaisStatus.cancelado}</div><div class="status-card-label">Cancelados</div></div></div>
            </div>
            <div class="ultimas-os-card"><h3>📋 Últimas Ordens de Serviço</h3>${ultimasOS.length === 0 ? '<div class="empty-message">Nenhuma OS cadastrada</div>' : `<div class="ultimas-os-list">${ultimasOS.map(os => { const c = clientes.find(c => c.id === os.clienteId); return `<div class="ultima-os-item"><div class="os-info"><span class="os-data">📅 ${formatarData(os.data)}</span><span class="os-cliente">👤 ${c?.nome || 'N/A'}</span></div><div class="os-valor-status"><span class="os-valor">R$ ${(os.valor || 0).toFixed(2)}</span><span class="os-status status-badge status-${os.status}">${os.status === 'pendente' ? 'Pendente' : os.status === 'andamento' ? 'Em Andamento' : 'Concluído'}</span></div></div>`; }).join('')}</div>`}<button id="btn-ver-todas" class="btn-ver-todas">Ver todas as OS →</button></div>
            <div class="atalhos-card"><h3>⚡ Atalhos Rápidos</h3><div class="atalhos-grid"><button class="atalho-btn" id="atalho-nova-os">➕ Nova OS</button><button class="atalho-btn" id="atalho-clientes">👥 Cadastrar Cliente</button><button class="atalho-btn" id="atalho-listar">📋 Listar OS</button><button class="atalho-btn" id="atalho-resumo">📊 Ver Resumo</button></div></div>
        </div>
    `;
    
    document.getElementById('btn-ver-todas')?.addEventListener('click', () => document.getElementById('btn-listar-os')?.click());
    document.getElementById('atalho-nova-os')?.addEventListener('click', () => document.getElementById('btn-nova-os')?.click());
    document.getElementById('atalho-clientes')?.addEventListener('click', () => document.getElementById('btn-clientes')?.click());
    document.getElementById('atalho-listar')?.addEventListener('click', () => document.getElementById('btn-listar-os')?.click());
    document.getElementById('atalho-resumo')?.addEventListener('click', () => document.getElementById('btn-resumo')?.click());
    
    document.querySelectorAll('.btn-criar-os-agendamento').forEach(btn => {
        btn.addEventListener('click', async () => { const id = parseInt(btn.dataset.id); const a = agendamentos.find(a => a.id === id); if (a) { criarOSdoAgendamento(a); await marcarAgendamentoComoLidoSupabase(id); } });
    });
    document.querySelectorAll('.btn-ignorar-agendamento').forEach(btn => {
        btn.addEventListener('click', async () => { if (confirm('Marcar como ignorado?')) { await excluirAgendamentoSupabase(parseInt(btn.dataset.id)); await renderDashboard(); } });
    });
    document.getElementById('btn-ver-agendamentos')?.addEventListener('click', () => renderAgendamentos());
    document.querySelectorAll('.btn-enviar-lembrete').forEach(btn => {
        btn.addEventListener('click', () => enviarLembreteRevisaoWhatsApp(btn.dataset.cliente, btn.dataset.telefone, btn.dataset.equipamento));
    });
    document.getElementById('btn-ver-todas-revisoes')?.addEventListener('click', () => renderTodasRevisoes());
}

// ========== RENDER CLIENTES ==========
function renderClientes() {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = `
        <div class="card"><h3>➕ Novo Cliente</h3><form id="form-cliente"><div class="form-group"><label>Nome *</label><input type="text" id="nome" required placeholder="Digite o nome"></div><div class="form-group"><label>Telefone</label><input type="text" id="telefone" placeholder="(99) 99999-9999"></div><div class="form-group"><label>Email</label><input type="email" id="email" placeholder="cliente@email.com"></div><button type="submit">➕ Cadastrar Cliente</button></form></div>
        <div class="card"><h3>👥 Clientes Cadastrados</h3><div id="lista-clientes" class="clientes-lista">${clientes.length === 0 ? '<div class="empty-message">Nenhum cliente cadastrado</div>' : clientes.map(c => `<div class="cliente-card"><strong>${c.nome}</strong><div class="cliente-info">${c.telefone ? `<span>📞 ${c.telefone}</span>` : ''}${c.email ? `<span>✉️ ${c.email}</span>` : ''}</div><div class="cliente-actions"><button class="btn-editar-cliente" data-id="${c.id}">✏️ Editar</button><button class="btn-excluir-cliente" data-id="${c.id}">🗑️ Excluir</button></div></div>`).join('')}</div></div>
    `;
    document.getElementById('form-cliente')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const nome = document.getElementById('nome').value;
        if (!nome) { alert('Nome é obrigatório!'); return; }
        clientes.push({ id: Date.now(), nome, telefone: document.getElementById('telefone').value || '', email: document.getElementById('email').value || '' });
        salvarClientes();
        renderClientes();
        alert('Cliente cadastrado!');
    });
    document.querySelectorAll('.btn-editar-cliente').forEach(btn => btn.addEventListener('click', () => editarCliente(parseInt(btn.dataset.id))));
    document.querySelectorAll('.btn-excluir-cliente').forEach(btn => btn.addEventListener('click', () => excluirCliente(parseInt(btn.dataset.id))));
}

function editarCliente(clienteId) {
    const cliente = clientes.find(c => c.id === clienteId);
    if (!cliente) return;
    const html = `<div class="card"><h3>✏️ Editar Cliente</h3><div class="form-group"><label>Nome *</label><input type="text" id="edit-nome" value="${cliente.nome}" required></div><div class="form-group"><label>Telefone</label><input type="text" id="edit-telefone" value="${cliente.telefone || ''}"></div><div class="form-group"><label>Email</label><input type="email" id="edit-email" value="${cliente.email || ''}"></div><div style="display:flex;gap:10px;justify-content:flex-end;"><button id="btn-cancelar-edicao" class="btn-secondary">❌ Cancelar</button><button id="btn-salvar-edicao" class="btn-primary">💾 Salvar</button></div></div>`;
    document.getElementById('content-area').innerHTML = html;
    document.getElementById('page-title').textContent = 'Editar Cliente';
    document.getElementById('btn-salvar-edicao')?.addEventListener('click', () => {
        const nome = document.getElementById('edit-nome').value;
        if (!nome) { alert('Nome é obrigatório!'); return; }
        cliente.nome = nome;
        cliente.telefone = document.getElementById('edit-telefone').value || '';
        cliente.email = document.getElementById('edit-email').value || '';
        salvarClientes();
        renderClientes();
        document.getElementById('page-title').textContent = 'Clientes';
    });
    document.getElementById('btn-cancelar-edicao')?.addEventListener('click', () => { renderClientes(); document.getElementById('page-title').textContent = 'Clientes'; });
}

function excluirCliente(clienteId) {
    const cliente = clientes.find(c => c.id === clienteId);
    if (!cliente) return;
    if (confirm(`Excluir cliente "${cliente.nome}"?`)) {
        const index = clientes.findIndex(c => c.id === clienteId);
        if (index !== -1) {
            clientes.splice(index, 1);
            salvarClientes();
            ordens.forEach(os => { if (os.clienteId === clienteId) os.clienteId = null; });
            salvarOrdens();
            renderClientes();
            atualizarContador();
            if (document.getElementById('page-title').textContent === 'Dashboard') renderDashboard();
        }
    }
}

// ========== RENDER NOVA OS ==========
function renderNovaOS() {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = `
        <div class="card"><h3>📝 Nova Ordem de Serviço</h3>
            <div class="form-group"><label>📅 Data</label><input type="date" id="data" value="${getDataAtual()}"></div>
            <div class="form-group"><label>👤 Cliente</label><select id="clienteId"><option value="">Selecione um cliente</option>${clientes.map(c => `<option value="${c.id}">${c.nome}</option>`).join('')}</select></div>
            <div class="form-group"><label>🔫 Equipamento</label><input type="text" id="equipamento" placeholder="Ex: Pistola Glock 17"></div>
            <div class="form-group"><label>📝 Descrição</label><textarea id="descricao" rows="3"></textarea></div>
            <div class="form-group"><label>💰 Valor (R$)</label><input type="number" id="valor" step="0.01"></div>
            <div class="form-group"><label>📌 Status</label><select id="status"><option value="pendente">⏳ Pendente</option><option value="andamento">🔧 Em Andamento</option><option value="concluido">✅ Concluído</option></select></div>
            <button id="btn-salvar-os">💾 Salvar OS</button>
        </div>
    `;
    document.getElementById('btn-salvar-os')?.addEventListener('click', () => {
        const clienteId = document.getElementById('clienteId').value;
        if (!clienteId) { alert('Selecione um cliente'); return; }
        ordens.push({ id: Date.now(), clienteId: parseInt(clienteId), data: document.getElementById('data').value, equipamento: document.getElementById('equipamento').value, descricao: document.getElementById('descricao').value, valor: parseFloat(document.getElementById('valor').value) || 0, status: document.getElementById('status').value, total: parseFloat(document.getElementById('valor').value) || 0 });
        salvarOrdens();
        alert('OS salva!');
        renderListarOS();
        document.getElementById('btn-listar-os')?.click();
    });
}

// ========== RENDER LISTAR OS ==========
function renderListarOS() {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = `
        <div class="card">
            <div class="listar-os-header"><h3>📋 Ordens de Serviço</h3><div class="filtro-status-container"><label>🔍 Filtrar:</label><select id="filtro-status-listar" class="filtro-status-listar"><option value="todos">📌 Todos</option><option value="pendente">⏳ Pendente</option><option value="andamento">🔧 Em Andamento</option><option value="concluido">✅ Concluído</option><option value="aguardando_aprovacao">📋 Aguardando Aprovação</option><option value="aguardando_pagamento">💳 Aguardando Pagamento</option><option value="cancelado">❌ Cancelado</option></select></div></div>
            <div id="lista-os" class="lista-os-grid">${renderizarCardsOS('todos')}</div>
        </div>
    `;
    document.getElementById('filtro-status-listar')?.addEventListener('change', (e) => {
        document.getElementById('lista-os').innerHTML = renderizarCardsOS(e.target.value);
        aplicarEventosStatus();
        aplicarEventosAcoes();
    });
    aplicarEventosStatus();
    aplicarEventosAcoes();
}

function aplicarEventosStatus() {
    document.querySelectorAll('.btn-mudar-status').forEach(select => {
        select.removeEventListener('change', handleStatusChange);
        select.addEventListener('change', handleStatusChange);
    });
}

function handleStatusChange(e) {
    e.stopPropagation();
    const id = parseInt(e.target.dataset.id);
    const os = ordens.find(o => o.id === id);
    if (os) {
        os.status = e.target.value;
        salvarOrdens();
        atualizarContador();
    }
}

function aplicarEventosAcoes() {
    document.querySelectorAll('.btn-excluir-os').forEach(btn => {
        btn.removeEventListener('click', handleExcluirClick);
        btn.addEventListener('click', handleExcluirClick);
    });
    document.querySelectorAll('.btn-pdf-os').forEach(btn => {
        btn.removeEventListener('click', handlePdfClick);
        btn.addEventListener('click', handlePdfClick);
    });
    document.querySelectorAll('.btn-whatsapp-os').forEach(btn => {
        btn.removeEventListener('click', handleWhatsAppClick);
        btn.addEventListener('click', handleWhatsAppClick);
    });
}

function handleExcluirClick(e) {
    e.stopPropagation();
    const id = parseInt(e.target.dataset.id);
    if (confirm('Excluir esta OS?')) {
        const index = ordens.findIndex(o => o.id === id);
        if (index !== -1) { ordens.splice(index, 1); salvarOrdens(); renderListarOS(); atualizarContador(); }
    }
}

function handlePdfClick(e) {
    e.stopPropagation();
    const id = parseInt(e.target.dataset.id);
    const acao = confirm('📄 OK = Enviar WhatsApp | Cancelar = Salvar PDF');
    acao ? gerarPDF_OS(id, true) : gerarPDF_OS(id, false);
}

function handleWhatsAppClick(e) {
    e.stopPropagation();
    gerarPDF_OS(parseInt(e.target.dataset.id), true);
}

function renderizarCardsOS(filtro) {
    let ordensFiltradas = filtro !== 'todos' ? ordens.filter(o => o.status === filtro) : [...ordens];
    if (ordensFiltradas.length === 0) return '<div class="empty-message">📭 Nenhuma OS cadastrada</div>';
    return ordensFiltradas.slice().reverse().map(os => {
        const c = clientes.find(c => c.id === os.clienteId);
        return `<div class="os-card-compact">
            <div class="os-card-header"><span class="os-id">#${os.id.toString().slice(-6)}</span><span class="os-data">📅 ${formatarData(os.data)}</span></div>
            <div class="os-card-body">
                <div class="os-cliente"><span class="label">👤 Cliente:</span><span class="valor">${c?.nome || 'Cliente removido'}</span></div>
                <div class="os-equipamento"><span class="label">🔫 Equipamento:</span><span class="valor">${os.equipamento || '-'}</span></div>
                <div class="os-descricao"><span class="label">📝 Descrição:</span><span class="valor">${os.descricao || '-'}</span></div>
                <div class="os-valor"><span class="label">💰 Valor:</span><span class="valor">R$ ${(os.valor || 0).toFixed(2)}</span></div>
            </div>
            <div class="os-card-footer">
                <div class="os-status-container"><span class="label">📌 Status:</span><select class="btn-mudar-status status-select status-${os.status}" data-id="${os.id}">
                    <option value="pendente" ${os.status === 'pendente' ? 'selected' : ''}>⏳ Pendente</option>
                    <option value="andamento" ${os.status === 'andamento' ? 'selected' : ''}>🔧 Em Andamento</option>
                    <option value="concluido" ${os.status === 'concluido' ? 'selected' : ''}>✅ Concluído</option>
                    <option value="aguardando_aprovacao" ${os.status === 'aguardando_aprovacao' ? 'selected' : ''}>📋 Aguardando Aprovação</option>
                    <option value="aguardando_pagamento" ${os.status === 'aguardando_pagamento' ? 'selected' : ''}>💳 Aguardando Pagamento</option>
                    <option value="cancelado" ${os.status === 'cancelado' ? 'selected' : ''}>❌ Cancelado</option>
                </select></div>
                <div class="os-actions"><button class="btn-whatsapp-os" data-id="${os.id}" title="WhatsApp">💬</button><button class="btn-pdf-os" data-id="${os.id}" title="PDF">📄</button><button class="btn-excluir-os" data-id="${os.id}" title="Excluir">🗑️</button></div>
            </div>
        </div>`;
    }).join('');
}

// ========== RENDER RESUMO ==========
function renderResumo() {
    const totalClientes = clientes.length;
    const totalOrdens = ordens.length;
    const totalFaturamento = ordens.reduce((acc, os) => acc + (os.valor || 0), 0);
    const ticketMedio = totalOrdens > 0 ? totalFaturamento / totalOrdens : 0;
    const osPorStatus = {
        pendente: ordens.filter(o => o.status === 'pendente').length,
        andamento: ordens.filter(o => o.status === 'andamento').length,
        concluido: ordens.filter(o => o.status === 'concluido').length
    };
    const html = `
        <div class="card"><h3>📊 Resumo do Sistema</h3>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;">
                <div style="background:rgba(0,102,204,0.1);border-radius:12px;padding:16px;text-align:center;"><div style="font-size:32px;">👥</div><div style="font-size:28px;font-weight:bold;color:#0066cc;">${totalClientes}</div><div>Clientes</div></div>
                <div style="background:rgba(0,102,204,0.1);border-radius:12px;padding:16px;text-align:center;"><div style="font-size:32px;">📋</div><div style="font-size:28px;font-weight:bold;color:#0066cc;">${totalOrdens}</div><div>Ordens de Serviço</div></div>
                <div style="background:rgba(0,102,204,0.1);border-radius:12px;padding:16px;text-align:center;"><div style="font-size:32px;">💰</div><div style="font-size:28px;font-weight:bold;color:#0066cc;">R$ ${totalFaturamento.toFixed(2)}</div><div>Faturamento Total</div></div>
                <div style="background:rgba(0,102,204,0.1);border-radius:12px;padding:16px;text-align:center;"><div style="font-size:32px;">🎫</div><div style="font-size:28px;font-weight:bold;color:#0066cc;">R$ ${ticketMedio.toFixed(2)}</div><div>Ticket Médio</div></div>
            </div>
            <h4 style="margin:20px 0 10px;">📌 OS por Status</h4>
            <div style="display:flex;gap:16px;flex-wrap:wrap;">
                <div style="background:#ff980020;border-radius:12px;padding:12px;text-align:center;flex:1;"><div style="font-size:24px;font-weight:bold;color:#ff9800;">${osPorStatus.pendente}</div><div>⏳ Pendente</div></div>
                <div style="background:#00bcd420;border-radius:12px;padding:12px;text-align:center;flex:1;"><div style="font-size:24px;font-weight:bold;color:#00bcd4;">${osPorStatus.andamento}</div><div>🔧 Em Andamento</div></div>
                <div style="background:#00c85320;border-radius:12px;padding:12px;text-align:center;flex:1;"><div style="font-size:24px;font-weight:bold;color:#00c853;">${osPorStatus.concluido}</div><div>✅ Concluído</div></div>
            </div>
        </div>
    `;
    document.getElementById('content-area').innerHTML = html;
    document.getElementById('page-title').textContent = 'Resumo';
}

// ========== RENDER FINANCEIRO ==========
let faturamentoChart = null;

function renderFinanceiro() {
    const faturamentoPorMes = {};
    const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    ordens.forEach(os => {
        if (os.status === 'concluido' && os.data) {
            const data = new Date(os.data);
            const chave = `${data.getFullYear()}-${data.getMonth()}`;
            if (!faturamentoPorMes[chave]) faturamentoPorMes[chave] = { mes: data.getMonth(), ano: data.getFullYear(), total: 0 };
            faturamentoPorMes[chave].total += os.valor || 0;
        }
    });
    
    const ultimosMeses = Object.values(faturamentoPorMes).sort((a, b) => {
        if (a.ano !== b.ano) return a.ano - b.ano;
        return a.mes - b.mes;
    }).slice(-6);
    
    const html = `
        <div class="card"><h3>💰 Financeiro</h3>
            <div style="margin-bottom:20px;"><canvas id="faturamentoChart" style="max-height:300px;width:100%;"></canvas></div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px;">
                <div style="background:rgba(0,200,83,0.1);border-radius:12px;padding:16px;"><div style="font-size:12px;color:#00c853;">Faturamento Total</div><div style="font-size:28px;font-weight:bold;">R$ ${ordens.filter(o => o.status === 'concluido').reduce((acc, o) => acc + (o.valor || 0), 0).toFixed(2)}</div></div>
                <div style="background:rgba(255,152,0,0.1);border-radius:12px;padding:16px;"><div style="font-size:12px;color:#ff9800;">A Receber</div><div style="font-size:28px;font-weight:bold;">R$ ${ordens.filter(o => o.status === 'aguardando_pagamento').reduce((acc, o) => acc + (o.valor || 0), 0).toFixed(2)}</div></div>
                <div style="background:rgba(33,150,243,0.1);border-radius:12px;padding:16px;"><div style="font-size:12px;color:#2196f3;">Média por OS</div><div style="font-size:28px;font-weight:bold;">R$ ${(ordens.filter(o => o.status === 'concluido').reduce((acc, o) => acc + (o.valor || 0), 0) / (ordens.filter(o => o.status === 'concluido').length || 1)).toFixed(2)}</div></div>
            </div>
        </div>
    `;
    document.getElementById('content-area').innerHTML = html;
    document.getElementById('page-title').textContent = 'Financeiro';
    
    const ctx = document.getElementById('faturamentoChart');
    if (ctx && ultimosMeses.length > 0) {
        if (faturamentoChart) faturamentoChart.destroy();
        faturamentoChart = new Chart(ctx, {
            type: 'line',
            data: { labels: ultimosMeses.map(m => `${mesesNomes[m.mes]}/${m.ano}`), datasets: [{ label: 'Faturamento (R$)', data: ultimosMeses.map(m => m.total), borderColor: '#0066cc', backgroundColor: 'rgba(0,102,204,0.1)', fill: true, tension: 0.4 }] },
            options: { responsive: true, maintainAspectRatio: true, plugins: { tooltip: { callbacks: { label: (ctx) => `R$ ${ctx.raw.toFixed(2)}` } } } }
        });
    }
}

// ========== RENDER RELATÓRIOS ==========
let relatorioChart = null;

function renderRelatorios() {
    const ordensConcluidas = ordens.filter(o => o.status === 'concluido');
    const totalFaturamento = ordensConcluidas.reduce((acc, o) => acc + (o.valor || 0), 0);
    const equipamentosCount = {};
    ordens.forEach(os => { if (os.equipamento && os.equipamento !== '-') equipamentosCount[os.equipamento] = (equipamentosCount[os.equipamento] || 0) + 1; });
    const topEquipamentos = Object.entries(equipamentosCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
    
    const html = `
        <div class="card"><h3>📊 Relatórios</h3>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:20px;">
                <div style="background:rgba(0,102,204,0.1);border-radius:12px;padding:16px;text-align:center;"><div style="font-size:28px;font-weight:bold;">${ordens.length}</div><div>Total OS</div></div>
                <div style="background:rgba(0,200,83,0.1);border-radius:12px;padding:16px;text-align:center;"><div style="font-size:28px;font-weight:bold;">${ordensConcluidas.length}</div><div>OS Concluídas</div></div>
                <div style="background:rgba(255,152,0,0.1);border-radius:12px;padding:16px;text-align:center;"><div style="font-size:28px;font-weight:bold;">R$ ${totalFaturamento.toFixed(2)}</div><div>Faturamento</div></div>
            </div>
            <h4>🔫 Top 5 Equipamentos</h4>
            <div style="margin-top:15px;">${topEquipamentos.length === 0 ? '<div class="empty-message">Nenhum dado</div>' : topEquipamentos.map((e, i) => `<div style="display:flex;justify-content:space-between;padding:10px;border-bottom:1px solid var(--card-border);"><span>${i+1}. ${e[0]}</span><span style="font-weight:bold;">${e[1]}x</span></div>`).join('')}</div>
            <div style="margin-top:20px;"><canvas id="relatorioChart" style="max-height:300px;"></canvas></div>
            <div style="margin-top:20px;"><button id="exportarRelatorioExcel" class="btn-exportar-rel">📊 Exportar Relatório (Excel)</button></div>
        </div>
    `;
    document.getElementById('content-area').innerHTML = html;
    document.getElementById('page-title').textContent = 'Relatórios';
    
    const ctx = document.getElementById('relatorioChart');
    if (ctx && topEquipamentos.length > 0) {
        if (relatorioChart) relatorioChart.destroy();
        relatorioChart = new Chart(ctx, {
            type: 'bar',
            data: { labels: topEquipamentos.map(e => e[0]), datasets: [{ label: 'Quantidade de OS', data: topEquipamentos.map(e => e[1]), backgroundColor: '#0066cc', borderRadius: 6 }] },
            options: { responsive: true, maintainAspectRatio: true }
        });
    }
    
    document.getElementById('exportarRelatorioExcel')?.addEventListener('click', () => {
        let csv = "Data,Cliente,Equipamento,Valor,Status\n";
        ordens.forEach(os => {
            const c = clientes.find(c => c.id === os.clienteId);
            csv += `"${formatarData(os.data)}","${c?.nome || 'N/A'}","${os.equipamento || '-'}","${(os.valor || 0).toFixed(2)}","${os.status}"\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `relatorio_os_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
        alert('✅ Relatório exportado!');
    });
}

// ========== RENDER BACKUP ==========
let backups = [];
let intervaloBackup = null;

function carregarBackups() {
    const backupsSalvo = localStorage.getItem('wb_os_backups');
    if (backupsSalvo) backups = JSON.parse(backupsSalvo);
}

function salvarBackupLista() { localStorage.setItem('wb_os_backups', JSON.stringify(backups)); }

function realizarBackup() {
    const dados = { versao: '1.0.0', data_backup: new Date().toISOString(), clientes, ordens, config: { tema: localStorage.getItem('tema'), usuarios: localStorage.getItem('wb_os_usuarios') } };
    const nomeArquivo = `backup_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    const jsonStr = JSON.stringify(dados, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = nomeArquivo;
    link.click();
    URL.revokeObjectURL(link.href);
    backups.unshift({ id: Date.now(), nome: nomeArquivo, data: new Date().toISOString(), tamanho: jsonStr.length, registros: { clientes: clientes.length, ordens: ordens.length } });
    if (backups.length > 10) backups = backups.slice(0, 10);
    salvarBackupLista();
    alert(`✅ Backup realizado!\nArquivo: ${nomeArquivo}`);
}

function restaurarBackup(arquivo) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const dados = JSON.parse(e.target.result);
                if (!dados.clientes || !dados.ordens) throw new Error('Backup inválido!');
                clientes = dados.clientes;
                ordens = dados.ordens;
                salvarClientes();
                salvarOrdens();
                if (dados.config?.tema) { localStorage.setItem('tema', dados.config.tema); carregarTema(); }
                alert('✅ Backup restaurado! O app será recarregado.');
                setTimeout(() => location.reload(), 1500);
                resolve(true);
            } catch (error) { reject(error); }
        };
        reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
        reader.readAsText(arquivo);
    });
}

function iniciarBackupAutomatico() {
    if (intervaloBackup) clearInterval(intervaloBackup);
    intervaloBackup = setInterval(() => realizarBackup(), 86400000);
    console.log('✅ Backup automático agendado');
}

function renderBackup() {
    carregarBackups();
    const html = `
        <div class="backup-container">
            <div class="backup-header"><h2>💾 Backup e Recuperação</h2><p>Proteja seus dados</p></div>
            <div class="backup-cards"><div class="backup-card"><div class="backup-card-icon">📊</div><div><div class="backup-card-valor">${clientes.length}</div><div>Clientes</div></div></div>
            <div class="backup-card"><div class="backup-card-icon">📋</div><div><div class="backup-card-valor">${ordens.length}</div><div>OS</div></div></div>
            <div class="backup-card"><div class="backup-card-icon">💾</div><div><div class="backup-card-valor">${backups.length}</div><div>Backups</div></div></div></div>
            <div class="backup-acoes"><button id="btn-backup-agora" class="btn-backup-principal">💾 Backup Agora</button><button id="btn-restaurar-backup" class="btn-restaurar">📂 Restaurar</button><button id="btn-backup-automatico" class="btn-backup-auto">⚙️ Backup Automático</button></div>
            <div class="backup-historico"><h3>📜 Histórico</h3><div class="backup-lista">${backups.length === 0 ? '<div class="empty-message">Nenhum backup</div>' : backups.map(b => `<div class="backup-item"><div><div class="backup-item-nome">${b.nome}</div><div class="backup-item-data">${new Date(b.data).toLocaleString('pt-BR')}</div></div><button class="btn-excluir-backup" data-id="${b.id}">🗑️</button></div>`).join('')}</div></div>
        </div>
    `;
    document.getElementById('content-area').innerHTML = html;
    document.getElementById('page-title').textContent = 'Backup';
    document.getElementById('btn-backup-agora')?.addEventListener('click', () => { realizarBackup(); renderBackup(); });
    document.getElementById('btn-restaurar-backup')?.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            if (e.target.files[0] && confirm('Restaurar backup? Isso substituirá os dados atuais.')) {
                try { await restaurarBackup(e.target.files[0]); } catch (error) { alert('Erro: ' + error.message); }
            }
        };
        input.click();
    });
    document.getElementById('btn-backup-automatico')?.addEventListener('click', () => {
        if (intervaloBackup) { pararBackupAutomatico(); alert('Backup automático desativado!'); } 
        else { iniciarBackupAutomatico(); alert('Backup automático ativado!'); }
        renderBackup();
    });
    document.querySelectorAll('.btn-excluir-backup').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.id);
            if (confirm('Excluir este backup?')) { backups = backups.filter(b => b.id !== id); salvarBackupLista(); renderBackup(); }
        });
    });
}

function pararBackupAutomatico() {
    if (intervaloBackup) { clearInterval(intervaloBackup); intervaloBackup = null; }
}

// ========== BASE DE CONHECIMENTO ==========
const conhecimentoTecnico = [
    { id: 1, problema: "Pistola não dispara", sintomas: ["gatilho não responde", "sem disparo"], causas: ["Bateria descarregada", "Motor queimado"], solucoes: ["Verifique a bateria", "Teste o motor"], tipo: "pistola", urgencia: "alta" },
    { id: 2, problema: "Fuzil com baixo desempenho", sintomas: ["tiro fraco", "alcance reduzido"], causas: ["Mola cansada", "Cilindro com vazamento"], solucoes: ["Substituir a mola", "Verificar vedação"], tipo: "fuzil", urgencia: "media" },
    { id: 3, problema: "GBB com vazamento de gás", sintomas: ["gás vazando", "poucos disparos"], causas: ["O-rings ressecados", "Válvula defeituosa"], solucoes: ["Lubrificar O-rings", "Substituir válvulas"], tipo: "gbb", urgencia: "alta" }
];

function buscarConhecimento(consulta) {
    const consultaLower = consulta.toLowerCase();
    const resultados = [];
    conhecimentoTecnico.forEach(item => {
        let pontuacao = 0;
        if (item.problema.toLowerCase().includes(consultaLower)) pontuacao += 10;
        item.sintomas.forEach(s => { if (s.toLowerCase().includes(consultaLower)) pontuacao += 5; });
        if (pontuacao > 0) resultados.push(item);
    });
    return resultados.slice(0, 5);
}

// ========== TEMA ==========
function alternarTema() {
    document.body.classList.toggle('light-theme');
    const isLight = document.body.classList.contains('light-theme');
    localStorage.setItem('tema', isLight ? 'light' : 'dark');
    document.getElementById('btn-tema').innerHTML = isLight ? '☀️ Tema Claro' : '🌙 Tema Escuro';
}

function carregarTema() {
    if (localStorage.getItem('tema') === 'light') {
        document.body.classList.add('light-theme');
        document.getElementById('btn-tema').innerHTML = '☀️ Tema Claro';
    } else {
        document.getElementById('btn-tema').innerHTML = '🌙 Tema Escuro';
    }
}

// ========== CONFIGURAR BOTÕES ==========
function configurarBotoes() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            const page = item.dataset.page;
            document.getElementById('page-title').textContent = page === 'dashboard' ? 'Dashboard' : page === 'clientes' ? 'Clientes' : page === 'nova-os' ? 'Nova OS' : page === 'listar-os' ? 'Listar OS' : page === 'resumo' ? 'Resumo' : page === 'financeiro' ? 'Financeiro' : page === 'relatorios' ? 'Relatórios' : page === 'agendamentos' ? 'Agendamentos' : 'Backup';
            if (page === 'dashboard') renderDashboard();
            else if (page === 'clientes') renderClientes();
            else if (page === 'nova-os') renderNovaOS();
            else if (page === 'listar-os') renderListarOS();
            else if (page === 'resumo') renderResumo();
            else if (page === 'financeiro') renderFinanceiro();
            else if (page === 'relatorios') renderRelatorios();
            else if (page === 'agendamentos') renderAgendamentos();
            else if (page === 'backup') renderBackup();
        });
    });
    document.getElementById('btn-tema')?.addEventListener('click', alternarTema);
}

// ========== CONFIGURAR AUTENTICAÇÃO ==========
function configurarAutenticacao() {
    document.getElementById('btn-login')?.addEventListener('click', () => {
        const usuario = document.getElementById('login-usuario').value;
        const senha = document.getElementById('login-senha').value;
        if (fazerLogin(usuario, senha)) location.reload();
        else alert('❌ Usuário ou senha incorretos!\n\nUsuário: wander\nSenha: 123456');
    });
    document.getElementById('btn-cadastrar')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('cadastro-form').style.display = 'block';
    });
    document.getElementById('btn-registrar')?.addEventListener('click', () => {
        const nome = document.getElementById('cadastro-nome').value;
        const usuario = document.getElementById('cadastro-usuario').value;
        const senha = document.getElementById('cadastro-senha').value;
        const confirmar = document.getElementById('cadastro-confirmar').value;
        if (registrarUsuario(nome, usuario, senha, confirmar)) {
            document.getElementById('cadastro-form').style.display = 'none';
            document.getElementById('login-form').style.display = 'block';
        }
    });
    document.getElementById('btn-voltar-login')?.addEventListener('click', () => {
        document.getElementById('cadastro-form').style.display = 'none';
        document.getElementById('login-form').style.display = 'block';
    });
    document.getElementById('btn-esqueci')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('recuperar-form').style.display = 'block';
    });
    document.getElementById('btn-recuperar')?.addEventListener('click', () => {
        const usuario = document.getElementById('recuperar-usuario').value;
        const email = document.getElementById('recuperar-email').value;
        if (recuperarSenha(usuario, email)) {
            document.getElementById('recuperar-form').style.display = 'none';
            document.getElementById('login-form').style.display = 'block';
        }
    });
    document.getElementById('btn-voltar-recuperar')?.addEventListener('click', () => {
        document.getElementById('recuperar-form').style.display = 'none';
        document.getElementById('login-form').style.display = 'block';
    });
    document.getElementById('btn-logout')?.addEventListener('click', fazerLogout);
}

// ========== LOGO EDITÁVEL ==========
let logoBase64 = localStorage.getItem('app_logo');

function carregarLogo() {
    const logoPlaceholder = document.getElementById('logo-placeholder');
    if (!logoPlaceholder) return;
    if (logoBase64 && logoBase64 !== 'null') logoPlaceholder.innerHTML = `<img src="${logoBase64}" class="logo-img"><div class="logo-edit-icon">✏️</div>`;
    else logoPlaceholder.innerHTML = `<span id="logo-text">🔫</span><div class="logo-edit-icon">✏️</div>`;
}

function abrirModalLogo() {
    const modal = document.createElement('div');
    modal.className = 'modal-upload-logo';
    modal.innerHTML = `<div class="modal-upload-content"><h3>🎨 Personalizar Logo</h3><div class="preview-logo" id="preview-logo">${logoBase64 && logoBase64 !== 'null' ? `<img src="${logoBase64}">` : '<span>🔫</span>'}</div><input type="file" id="logo-input" accept="image/*"><div class="modal-buttons"><button id="btn-salvar-logo" class="btn-upload">💾 Salvar</button><button id="btn-remover-logo" class="btn-remover-logo">🗑️ Remover</button><button id="btn-cancelar-logo" class="btn-cancelar-logo">Cancelar</button></div></div>`;
    document.body.appendChild(modal);
    document.getElementById('logo-input')?.addEventListener('change', (e) => {
        if (e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (event) => { document.getElementById('preview-logo').innerHTML = `<img src="${event.target.result}">`; };
            reader.readAsDataURL(e.target.files[0]);
        }
    });
    document.getElementById('btn-salvar-logo')?.addEventListener('click', () => {
        const file = document.getElementById('logo-input').files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                logoBase64 = event.target.result;
                localStorage.setItem('app_logo', logoBase64);
                carregarLogo();
                modal.remove();
                alert('✅ Logo salva!');
            };
            reader.readAsDataURL(file);
        } else alert('Selecione uma imagem!');
    });
    document.getElementById('btn-remover-logo')?.addEventListener('click', () => {
        if (confirm('Remover logo?')) {
            logoBase64 = null;
            localStorage.removeItem('app_logo');
            carregarLogo();
            modal.remove();
            alert('✅ Logo removida!');
        }
    });
    document.getElementById('btn-cancelar-logo')?.addEventListener('click', () => modal.remove());
}

// ========== INICIAR ==========
async function init() {
    console.log('Iniciando sistema...');
    configurarAutenticacao();
    if (verificarSessao()) {
        mostrarInterfaceUsuario();
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
        carregarDados();
        await carregarAgendamentosSupabase();
        atualizarContador();
        carregarTema();
        configurarBotoes();
        carregarBackups();
        iniciarBackupAutomatico();
        setTimeout(() => renderDashboard(), 100);
    } else {
        document.getElementById('login-container').style.display = 'flex';
        document.getElementById('app-container').style.display = 'none';
    }
}

document.getElementById('sidebar-header')?.addEventListener('click', abrirModalLogo);
carregarLogo();
init();

// ========== DASHBOARD PROFISSIONAL v2 ==========
async function renderDashboard() {
    console.log('Renderizando Dashboard...');
    await carregarAgendamentosSupabase();
    document.getElementById('page-title').textContent = 'Dashboard';
    const agendamentosPendentes = agendamentos.filter(a => a.status === 'pendente');
    const revisoes = getRevisoesPendentes();
    const totalRevisoes = revisoes.length;
    const statusInfo = {
        pendente: { rotulo: 'Pendente', cor: '#f59e0b', icone: '⏳' },
        aguardando_aprovacao: { rotulo: 'Aguardando Aprovação', cor: '#8b5cf6', icone: '📝' },
        aguardando_pagamento: { rotulo: 'Aguardando Pagamento', cor: '#06b6d4', icone: '💳' },
        andamento: { rotulo: 'Em Andamento', cor: '#3b82f6', icone: '🔧' },
        concluido: { rotulo: 'Concluído', cor: '#22c55e', icone: '✅' },
        cancelado: { rotulo: 'Cancelado', cor: '#ef4444', icone: '❌' }
    };
    const contarStatus = {};
    Object.keys(statusInfo).forEach(s => { contarStatus[s] = ordens.filter(o => o.status === s).length; });
    const faturamentoConcluido = ordens.filter(o => o.status === 'concluido').reduce((acc, o) => acc + (o.valor || 0), 0);
    const aReceber = ordens.filter(o => o.status === 'pendente' || o.status === 'aguardando_pagamento').reduce((acc, o) => acc + (o.valor || 0), 0);
    const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const iniciais = nome => (nome || '?').trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();
    const ultimasOS = [...ordens].sort((a, b) => (b.id || 0) - (a.id || 0)).slice(0, 6);
    const listaOS = ultimasOS.length ? ultimasOS.map(os => {
        const cliente = clientes.find(c => c.id === os.clienteId);
        const st = statusInfo[os.status] || statusInfo.pendente;
        return `<div class="db2-os-row"><div class="db2-avatar" style="background:${st.cor}22;color:${st.cor};">${iniciais(cliente?.nome)}</div><div class="db2-os-info"><strong>${cliente?.nome || 'Cliente removido'}</strong><span>${os.equipamento || 'Equipamento não informado'} · ${new Date(os.data || Date.now()).toLocaleDateString('pt-BR')}</span></div><div class="db2-os-right"><span class="db2-pill" style="background:${st.cor}18;color:${st.cor};">${st.icone} ${st.rotulo}</span><strong class="db2-os-valor">R$ ${(os.valor || 0).toFixed(2).replace('.', ',')}</strong></div></div>`;
    }).join('') : '<div class="db2-empty">📋 Nenhuma OS ainda — crie a primeira em "Nova OS"</div>';
    const blocoRevisoes = revisoes.length ? revisoes.slice(0, 3).map(r => `<div class="db2-item"><div class="db2-item-main"><strong>👤 ${r.clienteNome}</strong><span>🔫 ${r.equipamento} · próxima: ${new Date(r.dataProximaRevisao).toLocaleDateString('pt-BR')}</span></div><button class="btn-enviar-lembrete db2-mini-btn" data-cliente="${r.clienteNome}" data-telefone="${r.clienteTelefone}" data-equipamento="${r.equipamento}">💬 Lembrete</button></div>`).join('') + (totalRevisoes > 3 ? `<div class="db2-more">+ ${totalRevisoes - 3} revisão(ões)</div>` : '') : '<div class="db2-empty">✅ Nenhuma revisão pendente</div>';
    const blocoAgendamentos = agendamentosPendentes.length ? agendamentosPendentes.slice(0, 3).map(a => `<div class="db2-item"><div class="db2-item-main"><strong>📅 ${a.nome}</strong><span>${a.equipamento || 'Equipamento não informado'} · ${a.data} às ${a.horario}</span></div><div class="db2-item-actions"><button class="btn-criar-os-agendamento db2-mini-btn primary" data-id="${a.id}">➕ OS</button><button class="btn-ignorar-agendamento db2-mini-btn danger" data-id="${a.id}">🗑️</button></div></div>`).join('') + (agendamentosPendentes.length > 3 ? `<div class="db2-more">+ ${agendamentosPendentes.length - 3} agendamento(s)</div>` : '') : '<div class="db2-empty">📭 Nenhum agendamento novo</div>';
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = `
        <div class="db2-root">
            <div class="db2-header">
                <div><h2>👋 Olá, ${usuarioAtual?.nome || 'Usuário'}!</h2><p>${hoje.charAt(0).toUpperCase() + hoje.slice(1)}</p></div>
                <div class="db2-header-actions"><button class="db2-btn ghost" id="atalho-clientes">👥 Clientes</button><button class="db2-btn primary" id="atalho-nova">➕ Nova OS</button></div>
            </div>
            <div class="db2-kpis">
                <div class="db2-kpi"><div class="db2-kpi-icon blue">👥</div><div><span class="db2-kpi-valor">${clientes.length}</span><span class="db2-kpi-rotulo">Clientes</span></div></div>
                <div class="db2-kpi"><div class="db2-kpi-icon violet">📋</div><div><span class="db2-kpi-valor">${ordens.length}</span><span class="db2-kpi-rotulo">Total de OS</span></div></div>
                <div class="db2-kpi"><div class="db2-kpi-icon green">💰</div><div><span class="db2-kpi-valor">R$ ${faturamentoConcluido.toFixed(2).replace('.', ',')}</span><span class="db2-kpi-rotulo">Faturado (concluídas)</span></div></div>
                <div class="db2-kpi"><div class="db2-kpi-icon amber">⏱️</div><div><span class="db2-kpi-valor">R$ ${aReceber.toFixed(2).replace('.', ',')}</span><span class="db2-kpi-rotulo">A receber</span></div></div>
            </div>
            <div class="db2-pipeline">
                ${Object.keys(statusInfo).map(s => `<div class="db2-stage" style="--st:${statusInfo[s].cor};"><span class="db2-stage-count">${contarStatus[s]}</span><span class="db2-stage-rotulo">${statusInfo[s].rotulo}</span></div>`).join('')}
            </div>
            <div class="db2-grid-2">
                <div class="db2-card"><div class="db2-card-head"><h3>📅 Novos Agendamentos</h3>${agendamentosPendentes.length ? '<button class="db2-link" id="btn-ver-agendamentos">Ver todas →</button>' : ''}</div>${blocoAgendamentos}</div>
                <div class="db2-card"><div class="db2-card-head"><h3>🔧 Revisões Periódicas</h3></div>${blocoRevisoes}</div>
            </div>
            <div class="db2-card"><div class="db2-card-head"><h3>📋 Últimas Ordens de Serviço</h3><button class="db2-link" id="atalho-listar">Ver todas →</button></div><div class="db2-os-list">${listaOS}</div></div>
        </div>
    `;
    document.getElementById('atalho-clientes')?.addEventListener('click', () => document.querySelector('.nav-item[data-page="clientes"]')?.click());
    document.getElementById('atalho-nova')?.addEventListener('click', () => document.querySelector('.nav-item[data-page="nova-os"]')?.click());
    document.getElementById('atalho-listar')?.addEventListener('click', () => document.querySelector('.nav-item[data-page="listar-os"]')?.click());
    document.getElementById('btn-ver-agendamentos')?.addEventListener('click', () => renderAgendamentos());
    document.querySelectorAll('.btn-criar-os-agendamento').forEach(btn => {
        btn.addEventListener('click', async () => { const id = parseInt(btn.dataset.id); const a = agendamentos.find(a => a.id === id); if (a) { criarOSdoAgendamento(a); await marcarAgendamentoComoLidoSupabase(id); } });
    });
    document.querySelectorAll('.btn-ignorar-agendamento').forEach(btn => {
        btn.addEventListener('click', async () => { if (confirm('Marcar como ignorado?')) { await excluirAgendamentoSupabase(parseInt(btn.dataset.id)); await renderDashboard(); } });
    });
    document.querySelectorAll('.btn-enviar-lembrete').forEach(btn => {
        btn.addEventListener('click', () => enviarLembreteRevisaoWhatsApp(btn.dataset.cliente, btn.dataset.telefone, btn.dataset.equipamento));
    });
}

// ========== DASHBOARD v3 (INTERATIVA) ==========
let db3Filtro = 'todas';
let db3Busca = '';

async function renderDashboard() {
    console.log('Renderizando Dashboard v3...');
    await carregarAgendamentosSupabase();
    document.getElementById('page-title').textContent = 'Dashboard';
    db3Filtro = 'todas';
    db3Busca = '';
    const agendamentosPendentes = agendamentos.filter(a => a.status === 'pendente');
    const revisoes = getRevisoesPendentes();
    const statusInfo = {
        pendente: { rotulo: 'Pendente', cor: '#f59e0b', icone: '⏳' },
        aguardando_aprovacao: { rotulo: 'Aguardando Aprovação', cor: '#8b5cf6', icone: '📝' },
        aguardando_pagamento: { rotulo: 'Aguardando Pagamento', cor: '#06b6d4', icone: '💳' },
        andamento: { rotulo: 'Em Andamento', cor: '#3b82f6', icone: '🔧' },
        concluido: { rotulo: 'Concluído', cor: '#22c55e', icone: '✅' },
        cancelado: { rotulo: 'Cancelado', cor: '#ef4444', icone: '❌' }
    };
    const contarStatus = {};
    Object.keys(statusInfo).forEach(s => { contarStatus[s] = ordens.filter(o => o.status === s).length; });
    const faturamentoConcluido = ordens.filter(o => o.status === 'concluido').reduce((acc, o) => acc + (o.valor || 0), 0);
    const aReceber = ordens.filter(o => o.status === 'pendente' || o.status === 'aguardando_pagamento').reduce((acc, o) => acc + (o.valor || 0), 0);
    const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const iniciais = nome => (nome || '?').trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();
    const aba = s => `<button class="db3-tab" data-filtro="${s}" style="--st:${statusInfo[s].cor};"><span>${statusInfo[s].icone} ${statusInfo[s].rotulo}</span><strong>${contarStatus[s]}</strong></button>`;
    const acoesCentro = (agendamentosPendentes.length || revisoes.length) ? `
        ${agendamentosPendentes.map(a => `<div class="db3-acao"><div class="db3-acao-info"><strong>📅 ${a.nome}</strong><span>agendou ${a.equipamento || 'equipamento'} · ${a.data} às ${a.horario}</span></div><div class="db3-acao-botoes"><button class="btn-criar-os-agendamento db3-mini primary" data-id="${a.id}">➕ Criar OS</button><button class="btn-ignorar-agendamento db3-mini danger" data-id="${a.id}">🗑️</button></div></div>`).join('')}
        ${revisoes.slice(0, 3).map(r => `<div class="db3-acao"><div class="db3-acao-info"><strong>🔧 ${r.clienteNome}</strong><span>revisão de ${r.equipamento} · próxima: ${new Date(r.dataProximaRevisao).toLocaleDateString('pt-BR')}</span></div><button class="btn-enviar-lembrete db3-mini" data-cliente="${r.clienteNome}" data-telefone="${r.clienteTelefone}" data-equipamento="${r.equipamento}">💬 Lembrete</button></div>`).join('')}` : '';
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = `
        <div class="db2-root">
            <div class="db2-header">
                <div><h2>👋 Olá, ${usuarioAtual?.nome || 'Usuário'}!</h2><p>${hoje.charAt(0).toUpperCase() + hoje.slice(1)}</p></div>
                <div class="db2-header-actions"><button class="db2-btn ghost" id="atalho-clientes">👥 Clientes</button><button class="db2-btn primary" id="atalho-nova">➕ Nova OS</button></div>
            </div>
            <div class="db2-kpis">
                <div class="db2-kpi"><div class="db2-kpi-icon blue">👥</div><div><span class="db2-kpi-valor">${clientes.length}</span><span class="db2-kpi-rotulo">Clientes</span></div></div>
                <div class="db2-kpi"><div class="db2-kpi-icon violet">📋</div><div><span class="db2-kpi-valor">${ordens.length}</span><span class="db2-kpi-rotulo">Total de OS</span></div></div>
                <div class="db2-kpi"><div class="db2-kpi-icon green">💰</div><div><span class="db2-kpi-valor">R$ ${faturamentoConcluido.toFixed(2).replace('.', ',')}</span><span class="db2-kpi-rotulo">Faturado</span></div></div>
                <div class="db2-kpi"><div class="db2-kpi-icon amber">⏱️</div><div><span class="db2-kpi-valor">R$ ${aReceber.toFixed(2).replace('.', ',')}</span><span class="db2-kpi-rotulo">A receber</span></div></div>
            </div>
            <div class="db3-tabs">
                <button class="db3-tab active" data-filtro="todas" style="--st:#4f8cff;"><span>📋 Todas</span><strong>${ordens.length}</strong></button>
                ${Object.keys(statusInfo).map(s => aba(s)).join('')}
            </div>
            <div class="db2-card">
                <div class="db2-card-head"><h3>🔔 Ações Pendentes</h3></div>
                ${acoesCentro || '<div class="db3-tudo-em-dia">✅ Tudo em dia — nenhum agendamento ou revisão pendente</div>'}
            </div>
            <div class="db2-card">
                <div class="db2-card-head"><h3>📋 Ordens de Serviço</h3><input type="text" id="db3-busca" class="db3-busca" placeholder="🔍 Buscar cliente ou equipamento..."></div>
                <div id="db3-lista"></div>
            </div>
        </div>
    `;
    const pintarLista = () => {
        const termo = db3Busca.toLowerCase();
        const filtradas = ordens.filter(o => (db3Filtro === 'todas' || o.status === db3Filtro) && (!termo || (clientes.find(c => c.id === o.clienteId)?.nome || '').toLowerCase().includes(termo) || (o.equipamento || '').toLowerCase().includes(termo))).sort((a, b) => (b.id || 0) - (a.id || 0));
        document.getElementById('db3-lista').innerHTML = filtradas.length ? filtradas.map(os => {
            const cliente = clientes.find(c => c.id === os.clienteId);
            const st = statusInfo[os.status] || statusInfo.pendente;
            return `<div class="db2-os-row db3-linha"><div class="db2-avatar" style="background:${st.cor}22;color:${st.cor};">${iniciais(cliente?.nome)}</div><div class="db2-os-info"><strong>${cliente?.nome || 'Cliente removido'}</strong><span>${os.equipamento || 'Equipamento não informado'} · ${new Date(os.data || Date.now()).toLocaleDateString('pt-BR')}</span></div><div class="db2-os-right"><span class="db2-pill" style="background:${st.cor}18;color:${st.cor};">${st.icone} ${st.rotulo}</span><span class="db3-valor">R$ ${(os.valor || 0).toFixed(2).replace('.', ',')}</span></div><div class="db3-row-actions"><button class="db3-ico" title="Enviar WhatsApp" onclick="gerarPDF_OS(${os.id}, true)">💬</button><button class="db3-ico" title="Salvar PDF" onclick="gerarPDF_OS(${os.id}, false)">📄</button><button class="db3-ico del" title="Excluir" onclick="db3ExcluirOS(${os.id})">🗑️</button></div></div>`;
        }).join('') : '<div class="db2-empty">🔍 Nenhuma OS encontrada com esse filtro</div>';
    };
    pintarLista();
    document.querySelectorAll('.db3-tab').forEach(t => t.addEventListener('click', () => {
        document.querySelectorAll('.db3-tab').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        db3Filtro = t.dataset.filtro;
        pintarLista();
    }));
    document.getElementById('db3-busca')?.addEventListener('input', e => { db3Busca = e.target.value; pintarLista(); });
    document.getElementById('atalho-clientes')?.addEventListener('click', () => document.querySelector('.nav-item[data-page="clientes"]')?.click());
    document.getElementById('atalho-nova')?.addEventListener('click', () => document.querySelector('.nav-item[data-page="nova-os"]')?.click());
    document.querySelectorAll('.btn-criar-os-agendamento').forEach(btn => btn.addEventListener('click', async () => { const id = parseInt(btn.dataset.id); const a = agendamentos.find(a => a.id === id); if (a) { criarOSdoAgendamento(a); await marcarAgendamentoComoLidoSupabase(id); } }));
    document.querySelectorAll('.btn-ignorar-agendamento').forEach(btn => btn.addEventListener('click', async () => { if (confirm('Marcar como ignorado?')) { await excluirAgendamentoSupabase(parseInt(btn.dataset.id)); await renderDashboard(); } }));
    document.querySelectorAll('.btn-enviar-lembrete').forEach(btn => btn.addEventListener('click', () => enviarLembreteRevisaoWhatsApp(btn.dataset.cliente, btn.dataset.telefone, btn.dataset.equipamento)));
}

function db3ExcluirOS(id) {
    if (!confirm('Excluir esta OS?')) return;
    const idx = ordens.findIndex(o => o.id === id);
    if (idx !== -1) { ordens.splice(idx, 1); salvarOrdens(); atualizarContador(); renderDashboard(); }
}

// ========== NOVA OS v2 (PROFISSIONAL) ==========
function renderNovaOS() {
    const statusInfo = {
        pendente: { rotulo: 'Pendente', cor: '#f59e0b', icone: '⏳' },
        aguardando_aprovacao: { rotulo: 'Aguardando Aprovação', cor: '#8b5cf6', icone: '📝' },
        aguardando_pagamento: { rotulo: 'Aguardando Pagamento', cor: '#06b6d4', icone: '💳' },
        andamento: { rotulo: 'Em Andamento', cor: '#3b82f6', icone: '🔧' },
        concluido: { rotulo: 'Concluído', cor: '#22c55e', icone: '✅' },
        cancelado: { rotulo: 'Cancelado', cor: '#ef4444', icone: '❌' }
    };
    const opcoesClientes = clientes.map(c => `<option value="${c.id}">${c.nome}${c.telefone ? ' · ' + c.telefone : ''}</option>`).join('');
    const avisoSemClientes = clientes.length === 0 ? `<div class="no2-alert">👥 Você ainda não tem clientes cadastrados. <button class="db2-link" id="no2-ir-clientes">Cadastrar agora →</button></div>` : '';
    document.getElementById('content-area').innerHTML = `
        <div class="no2-root">
            <div class="db2-header"><div><h2>📝 Nova Ordem de Serviço</h2><p>Preencha os dados do serviço — campos com * são obrigatórios</p></div></div>
            ${avisoSemClientes}
            <div class="no2-grid">
                <div class="no2-form">
                    <div class="no2-section"><div class="no2-section-title">👤 Cliente e data</div>
                        <div class="no2-row">
                            <div class="form-group"><label>Cliente *</label><select id="clienteId"><option value="">Selecione um cliente</option>${opcoesClientes}</select></div>
                            <div class="form-group"><label>Data *</label><input type="date" id="data" value="${getDataAtual()}"></div>
                        </div>
                    </div>
                    <div class="no2-section"><div class="no2-section-title">🔫 Equipamento e serviço</div>
                        <div class="form-group"><label>Equipamento *</label><input type="text" id="equipamento" placeholder="Ex: Pistola Glock 17 / Fuzil Krytac"></div>
                        <div class="form-group"><label>Descrição do serviço</label><textarea id="descricao" rows="4" placeholder="Descreva o problema relatado, peças a trocar, serviço combinado..."></textarea></div>
                    </div>
                    <div class="no2-section"><div class="no2-section-title">💰 Valor e status</div>
                        <div class="no2-row">
                            <div class="form-group"><label>Valor (R$)</label><input type="number" id="valor" step="0.01" min="0" placeholder="0,00"></div>
                            <div class="form-group"><label>Status inicial</label><input type="hidden" id="status" value="pendente"><div class="no2-pills">${Object.keys(statusInfo).map(s => `<button type="button" class="no2-pill${s === 'pendente' ? ' active' : ''}" data-status="${s}" style="--st:${statusInfo[s].cor};">${statusInfo[s].icone} ${statusInfo[s].rotulo}</button>`).join('')}</div></div>
                        </div>
                    </div>
                </div>
                <div class="no2-side">
                    <div class="db2-card"><div class="no2-section-title">📄 Resumo da OS</div>
                        <div class="no2-prev-linha"><span>Cliente</span><strong id="no2-p-cliente">—</strong></div>
                        <div class="no2-prev-linha"><span>Equipamento</span><strong id="no2-p-equip">—</strong></div>
                        <div class="no2-prev-linha"><span>Data</span><strong id="no2-p-data">—</strong></div>
                        <div class="no2-prev-linha"><span>Status</span><strong id="no2-p-status">⏳ Pendente</strong></div>
                        <div class="no2-prev-total"><span>Valor</span><strong id="no2-p-valor">R$ 0,00</strong></div>
                    </div>
                    <div class="db2-card"><div class="no2-section-title">💡 Dica</div><p class="no2-dica">A descrição vai para o PDF enviado por WhatsApp — registre ali o problema relatado e o combinado com o cliente.</p></div>
                    <button id="btn-salvar-os" class="no2-salvar">💾 Salvar Ordem de Serviço</button>
                </div>
            </div>
        </div>
    `;
    const atualizarPreview = () => {
        const cliente = clientes.find(c => c.id == document.getElementById('clienteId').value);
        const st = statusInfo[document.getElementById('status').value] || statusInfo.pendente;
        document.getElementById('no2-p-cliente').textContent = cliente ? cliente.nome : '—';
        document.getElementById('no2-p-equip').textContent = document.getElementById('equipamento').value || '—';
        document.getElementById('no2-p-data').textContent = new Date(document.getElementById('data').value + 'T12:00:00').toLocaleDateString('pt-BR');
        document.getElementById('no2-p-status').textContent = `${st.icone} ${st.rotulo}`;
        document.getElementById('no2-p-valor').textContent = 'R$ ' + (parseFloat(document.getElementById('valor').value) || 0).toFixed(2).replace('.', ',');
    };
    ['clienteId', 'equipamento', 'data', 'valor'].forEach(id => document.getElementById(id).addEventListener('input', atualizarPreview));
    document.querySelectorAll('.no2-pill').forEach(pill => pill.addEventListener('click', () => {
        document.querySelectorAll('.no2-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        document.getElementById('status').value = pill.dataset.status;
        atualizarPreview();
    }));
    document.getElementById('no2-ir-clientes')?.addEventListener('click', () => document.querySelector('.nav-item[data-page="clientes"]')?.click());
    document.getElementById('btn-salvar-os').addEventListener('click', () => {
        const clienteId = document.getElementById('clienteId').value;
        if (!clienteId) { alert('Selecione um cliente'); return; }
        const equipamento = document.getElementById('equipamento').value.trim();
        if (!equipamento) { alert('Informe o equipamento'); return; }
        ordens.push({ id: Date.now(), clienteId: parseInt(clienteId), data: document.getElementById('data').value, equipamento, descricao: document.getElementById('descricao').value, valor: parseFloat(document.getElementById('valor').value) || 0, status: document.getElementById('status').value, total: parseFloat(document.getElementById('valor').value) || 0 });
        salvarOrdens();
        alert('✅ OS salva com sucesso!');
        renderListarOS();
    });
}

// ========== CLIENTES v2 (PROFISSIONAL) ==========
let clBusca = '';
let clEditId = null;

function renderClientes() {
    document.getElementById('page-title').textContent = 'Clientes';
    clBusca = '';
    const iniciais = nome => (nome || '?').trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();
    const editando = clEditId ? clientes.find(c => c.id === clEditId) : null;
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = `
        <div class="cl2-root">
            <div class="db2-header">
                <div><h2>👥 Clientes</h2><p>${clientes.length} cliente(s) cadastrado(s) · ${ordens.length} OS no sistema</p></div>
                <div class="db2-header-actions"><button class="db2-btn ghost" id="cl-ir-nova">➕ Nova OS</button></div>
            </div>
            <div class="cl2-grid">
                <div class="db2-card">
                    <div class="no2-section-title">${editando ? '✏️ Editando: ' + editando.nome : '➕ Novo cliente'}</div>
                    <div class="form-group"><label>Nome *</label><input type="text" id="cl-nome" placeholder="Digite o nome" value="${editando ? editando.nome || '' : ''}"></div>
                    <div class="form-group"><label>Telefone (WhatsApp)</label><input type="text" id="cl-telefone" placeholder="(99) 99999-9999" value="${editando ? editando.telefone || '' : ''}"></div>
                    <div class="form-group"><label>Email</label><input type="email" id="cl-email" placeholder="cliente@email.com" value="${editando ? editando.email || '' : ''}"></div>
                    <button id="cl-salvar" class="no2-salvar">${editando ? '💾 Salvar alterações' : '💾 Cadastrar Cliente'}</button>
                    ${editando ? '<button id="cl-cancelar" class="db2-btn ghost" style="width:100%;margin-top:8px;">Cancelar edição</button>' : ''}
                </div>
                <div class="db2-card">
                    <div class="db2-card-head"><h3>📇 Todos os clientes</h3><input type="text" id="cl-busca" class="db3-busca" placeholder="🔍 Buscar nome, telefone ou email..."></div>
                    <div id="cl-lista"></div>
                </div>
            </div>
        </div>
    `;
    const pintar = () => {
        const termo = clBusca.toLowerCase();
        const filtrados = clientes.filter(c => !termo || (c.nome || '').toLowerCase().includes(termo) || (c.telefone || '').includes(termo) || (c.email || '').toLowerCase().includes(termo));
        document.getElementById('cl-lista').innerHTML = filtrados.length ? filtrados.map(c => {
            const totalOS = ordens.filter(o => o.clienteId === c.id).length;
            const telLimpo = (c.telefone || '').replace(/\D/g, '');
            return `<div class="db2-os-row"><div class="db2-avatar" style="background:rgba(79,140,255,.15);color:#4f8cff;">${iniciais(c.nome)}</div><div class="db2-os-info"><strong>${c.nome}</strong><span>${c.telefone ? '📱 ' + c.telefone : '📱 sem telefone'}${c.email ? ' · ✉️ ' + c.email : ''}</span></div><div class="db2-os-right"><span class="db2-pill" style="background:rgba(79,140,255,.12);color:#4f8cff;">📋 ${totalOS} OS</span></div><div class="db3-row-actions">${telLimpo ? `<button class="db3-ico" title="WhatsApp" onclick="window.open('https://wa.me/55${telLimpo}','_blank')">💬</button>` : ''}<button class="db3-ico" title="Editar" onclick="clEditar(${c.id})">✏️</button><button class="db3-ico del" title="Excluir" onclick="clExcluir(${c.id})">🗑️</button></div></div>`;
        }).join('') : '<div class="db2-empty">👥 Nenhum cliente encontrado — cadastre o primeiro no card ao lado</div>';
    };
    pintar();
    document.getElementById('cl-busca').addEventListener('input', e => { clBusca = e.target.value; pintar(); });
    const mascaraTelefone = v => {
        v = v.replace(/\D/g, '').slice(0, 11);
        if (v.length > 7) return `(${v.slice(0, 2)}) ${v.slice(2, v.length > 10 ? 7 : 6)}-${v.slice(v.length > 10 ? 7 : 6)}`;
        if (v.length > 2) return `(${v.slice(0, 2)}) ${v.slice(2)}`;
        if (v.length > 0) return `(${v}`;
        return v;
    };
    document.getElementById('cl-telefone').addEventListener('input', e => { e.target.value = mascaraTelefone(e.target.value); });
    document.getElementById('cl-salvar').addEventListener('click', () => {
        const nome = document.getElementById('cl-nome').value.trim();
        if (!nome) { alert('O nome é obrigatório!'); return; }
        const dados = { nome, telefone: document.getElementById('cl-telefone').value.trim(), email: document.getElementById('cl-email').value.trim() };
        if (clEditId) {
            const c = clientes.find(c => c.id === clEditId);
            if (c) Object.assign(c, dados);
            clEditId = null;
            alert('✅ Cliente atualizado!');
        } else {
            clientes.push({ id: Date.now(), ...dados });
            alert('✅ Cliente cadastrado!');
        }
        salvarClientes();
        renderClientes();
    });
    document.getElementById('cl-cancelar')?.addEventListener('click', () => { clEditId = null; renderClientes(); });
    document.getElementById('cl-ir-nova')?.addEventListener('click', () => document.querySelector('.nav-item[data-page="nova-os"]')?.click());
}

function clEditar(id) { clEditId = id; renderClientes(); document.getElementById('cl-nome')?.focus(); }

function clExcluir(id) {
    if (!confirm('Excluir este cliente? As OS dele ficarão sem cliente vinculado.')) return;
    const index = clientes.findIndex(c => c.id === id);
    if (index === -1) return;
    clientes.splice(index, 1);
    ordens.forEach(o => { if (o.clienteId === id) o.clienteId = null; });
    salvarClientes();
    salvarOrdens();
    atualizarContador?.();
    renderClientes();
}

// ========== FINANCEIRO v2 (PROFISSIONAL) ==========
function renderFinanceiro() {
    document.getElementById('page-title').textContent = 'Financeiro';
    const statusInfo = {
        pendente: { rotulo: 'Pendente', cor: '#f59e0b', icone: '⏳' },
        aguardando_aprovacao: { rotulo: 'Aguardando Aprovação', cor: '#8b5cf6', icone: '📝' },
        aguardando_pagamento: { rotulo: 'Aguardando Pagamento', cor: '#06b6d4', icone: '💳' },
        andamento: { rotulo: 'Em Andamento', cor: '#3b82f6', icone: '🔧' },
        concluido: { rotulo: 'Concluído', cor: '#22c55e', icone: '✅' },
        cancelado: { rotulo: 'Cancelado', cor: '#ef4444', icone: '❌' }
    };
    const concluidas = ordens.filter(o => o.status === 'concluido');
    const faturado = concluidas.reduce((acc, o) => acc + (o.valor || 0), 0);
    const emAberto = ordens.filter(o => o.status === 'pendente' || o.status === 'aguardando_pagamento');
    const aReceber = emAberto.reduce((acc, o) => acc + (o.valor || 0), 0);
    const ticket = concluidas.length ? faturado / concluidas.length : 0;
    const hojeData = new Date();
    const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const ultimos6 = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date(hojeData.getFullYear(), hojeData.getMonth() - i, 1);
        ultimos6.push({ ano: d.getFullYear(), mes: d.getMonth(), total: 0 });
    }
    concluidas.forEach(o => {
        if (!o.data) return;
        const d = new Date(o.data);
        const item = ultimos6.find(m => m.ano === d.getFullYear() && m.mes === d.getMonth());
        if (item) item.total += o.valor || 0;
    });
    const iniciais = nome => (nome || '?').trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();
    const linhaOS = (os, verde) => {
        const cliente = clientes.find(c => c.id === os.clienteId);
        const st = statusInfo[os.status] || statusInfo.pendente;
        return `<div class="db2-os-row"><div class="db2-avatar" style="background:${st.cor}22;color:${st.cor};">${iniciais(cliente?.nome)}</div><div class="db2-os-info"><strong>${cliente?.nome || 'Cliente removido'}</strong><span>${os.equipamento || 'Equipamento não informado'} · ${new Date(os.data || Date.now()).toLocaleDateString('pt-BR')}</span></div><div class="db2-os-right"><span class="db2-pill" style="background:${st.cor}18;color:${st.cor};">${st.icone} ${st.rotulo}</span><strong class="fn2-valor${verde ? ' ok' : ''}">R$ ${(os.valor || 0).toFixed(2).replace('.', ',')}</strong></div></div>`;
    };
    const listaAberto = emAberto.length ? [...emAberto].sort((a, b) => (b.id || 0) - (a.id || 0)).slice(0, 8).map(o => linhaOS(o, false)).join('') : '<div class="db2-empty">🎉 Nenhum valor em aberto — tudo recebido!</div>';
    const listaRecebidos = concluidas.length ? [...concluidas].sort((a, b) => (b.id || 0) - (a.id || 0)).slice(0, 8).map(o => linhaOS(o, true)).join('') : '<div class="db2-empty">📋 Nenhum recebimento registrado ainda</div>';
    const chartHTML = faturado > 0 ? '<div class="fn2-canvas-wrap"><canvas id="faturamentoChart"></canvas></div>' : '<div class="db2-empty">📊 Sem faturamento registrado — o gráfico nasce quando você concluir a primeira OS com valor</div>';
    document.getElementById('content-area').innerHTML = `
        <div class="fn2-root">
            <div class="db2-header">
                <div><h2>💰 Financeiro</h2><p>Visão geral dos valores do negócio · baseado nas OS cadastradas</p></div>
                <div class="db2-header-actions"><button class="db2-btn ghost" id="fn-ir-nova">➕ Nova OS</button><button class="db2-btn primary" id="fn-ir-listar">📋 Ver OS</button></div>
            </div>
            <div class="db2-kpis">
                <div class="db2-kpi"><div class="db2-kpi-icon green">💰</div><div><span class="db2-kpi-valor">R$ ${faturado.toFixed(2).replace('.', ',')}</span><span class="db2-kpi-rotulo">Faturado (concluídas)</span></div></div>
                <div class="db2-kpi"><div class="db2-kpi-icon amber">⏱️</div><div><span class="db2-kpi-valor">R$ ${aReceber.toFixed(2).replace('.', ',')}</span><span class="db2-kpi-rotulo">A receber</span></div></div>
                <div class="db2-kpi"><div class="db2-kpi-icon violet">🎫</div><div><span class="db2-kpi-valor">R$ ${ticket.toFixed(2).replace('.', ',')}</span><span class="db2-kpi-rotulo">Ticket médio</span></div></div>
                <div class="db2-kpi"><div class="db2-kpi-icon blue">✅</div><div><span class="db2-kpi-valor">${concluidas.length}</span><span class="db2-kpi-rotulo">OS concluídas</span></div></div>
            </div>
            <div class="fn2-grid">
                <div class="db2-card"><div class="db2-card-head"><h3>📈 Faturamento — últimos 6 meses</h3></div>${chartHTML}</div>
                <div class="db2-card"><div class="db2-card-head"><h3>💳 Em aberto (R$ ${aReceber.toFixed(2).replace('.', ',')})</h3></div>${listaAberto}</div>
            </div>
            <div class="db2-card"><div class="db2-card-head"><h3>✅ Recebimentos recentes</h3></div>${listaRecebidos}</div>
        </div>
    `;
    document.getElementById('fn-ir-nova')?.addEventListener('click', () => document.querySelector('.nav-item[data-page="nova-os"]')?.click());
    document.getElementById('fn-ir-listar')?.addEventListener('click', () => document.querySelector('.nav-item[data-page="listar-os"]')?.click());
    if (faturado > 0) {
        if (typeof faturamentoChart !== 'undefined' && faturamentoChart) faturamentoChart.destroy();
        const ctx = document.getElementById('faturamentoChart');
        if (ctx) {
            faturamentoChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ultimos6.map(m => `${mesesNomes[m.mes]}/${String(m.ano).slice(2)}`),
                    datasets: [{ data: ultimos6.map(m => m.total), backgroundColor: 'rgba(34,197,94,.65)', hoverBackgroundColor: 'rgba(34,197,94,.95)', borderRadius: 8, maxBarThickness: 46 }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => 'R$ ' + Number(c.raw).toFixed(2).replace('.', ',') } } },
                    scales: { y: { beginAtZero: true, ticks: { callback: v => 'R$ ' + v } }, x: { grid: { display: false } } }
                }
            });
        }
    }
}