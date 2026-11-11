const nodemailer = require('nodemailer');
const config = require('../config');
const User = require('../models/User');
const { dataBR } = require('../utils/date');

const simulado = !config.smtp.host;

const transport = simulado
  ? nodemailer.createTransport({ jsonTransport: true })
  : nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    });

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function enviar({ to, subject, text, html }) {
  if (!to || (Array.isArray(to) && !to.length)) return;
  const info = await transport.sendMail({ from: config.mailFrom, to, subject, text, html });
  if (simulado) {
    // Sem SMTP configurado (desenvolvimento): mostra o e-mail no console.
    console.log(`\n[e-mail simulado]\nPara: ${[].concat(to).join(', ')}\nAssunto: ${subject}\n${text}\n`);
  }
  return info;
}

async function destinatariosAdmin() {
  if (config.notifyEmails.length) return config.notifyEmails;
  const admins = await User.find({ role: 'admin', ativo: true }).select('email');
  return admins.map((a) => a.email);
}

// ap = agendamento com "fornecedor" populado
async function notificarNovaSolicitacao(ap) {
  const to = await destinatariosAdmin();
  const subject = `Nova solicitação de agendamento — ${ap.fornecedor.razaoSocial}`;
  const linhas = [
    `Fornecedor: ${ap.fornecedor.razaoSocial}`,
    `Data sugerida: ${dataBR(ap.dataSugerida)}`,
    `Peso: ${ap.pesoKg} kg`,
    `Volumes: ${ap.volumes}`,
    `Notas (${ap.notas.length}): ${ap.notas.join(', ')}`,
    `Arquivos anexados: ${ap.arquivos.length}`,
    ap.observacao ? `Observação: ${ap.observacao}` : null,
  ].filter(Boolean);
  await enviar({
    to,
    subject,
    text: `${linhas.join('\n')}\n\nAcesse o painel para aprovar ou recusar.`,
    html: `<h2>Nova solicitação de agendamento</h2><ul>${linhas.map((l) => `<li>${esc(l)}</li>`).join('')}</ul><p>Acesse o painel para aprovar ou recusar.</p>`,
  });
}

async function notificarDecisao(ap) {
  const aprovado = ap.status === 'aprovado';
  const subject = aprovado ? 'Agendamento aprovado' : 'Agendamento recusado';
  const linhas = aprovado
    ? [`Seu recebimento foi aprovado para ${dataBR(ap.dataAprovada)} às ${ap.horarioAprovado}.`]
    : ['Sua solicitação não pôde ser aprovada.', `Motivo: ${ap.observacaoAdmin}`];
  if (aprovado && ap.observacaoAdmin) linhas.push(`Observação do CD: ${ap.observacaoAdmin}`);
  linhas.push(`Notas: ${ap.notas.join(', ')}`);
  await enviar({
    to: ap.fornecedor.email,
    subject,
    text: linhas.join('\n'),
    html: `<h2>${esc(subject)}</h2>${linhas.map((l) => `<p>${esc(l)}</p>`).join('')}`,
  });
}

async function notificarContraproposta(ap) {
  const linhas = [
    `O Centro de Distribuição não pôde receber na data sugerida e propõe outra:`,
    `Nova data: ${dataBR(ap.dataProposta)} às ${ap.horarioProposto}`,
    ap.observacaoAdmin ? `Observação do CD: ${ap.observacaoAdmin}` : null,
    `Notas: ${ap.notas.join(', ')}`,
    'Acesse o portal para aceitar ou recusar a proposta.',
  ].filter(Boolean);
  await enviar({
    to: ap.fornecedor.email,
    subject: 'Contraproposta de data para o seu agendamento',
    text: linhas.join('\n'),
    html: `<h2>Contraproposta de data</h2>${linhas.map((l) => `<p>${esc(l)}</p>`).join('')}`,
  });
}

// Avisa o CD quando o fornecedor responde a uma contraproposta.
async function notificarRespostaFornecedor(ap) {
  const aceitou = ap.status === 'aprovado';
  const linhas = [
    `${ap.fornecedor.razaoSocial} ${aceitou ? 'ACEITOU' : 'RECUSOU'} a contraproposta.`,
    aceitou ? `Recebimento confirmado: ${dataBR(ap.dataAprovada)} às ${ap.horarioAprovado}` : null,
    ap.respostaFornecedor ? `Comentário: ${ap.respostaFornecedor}` : null,
  ].filter(Boolean);
  await enviar({
    to: await destinatariosAdmin(),
    subject: `Contraproposta ${aceitou ? 'aceita' : 'recusada'} — ${ap.fornecedor.razaoSocial}`,
    text: linhas.join('\n'),
    html: `<h2>Resposta à contraproposta</h2>${linhas.map((l) => `<p>${esc(l)}</p>`).join('')}`,
  });
}

async function notificarReagendamento(ap) {
  const linhas = [
    'O Centro de Distribuição alterou a data/horário do seu recebimento.',
    `Antes: ${dataBR(ap.dataAprovadaAnterior)} às ${ap.horarioAprovadoAnterior}`,
    `Agora: ${dataBR(ap.dataAprovada)} às ${ap.horarioAprovado}`,
    ap.observacaoAdmin ? `Observação do CD: ${ap.observacaoAdmin}` : null,
    `Notas: ${ap.notas.join(', ')}`,
  ].filter(Boolean);
  await enviar({
    to: ap.fornecedor.email,
    subject: 'Seu agendamento de recebimento foi alterado',
    text: linhas.join('\n'),
    html: `<h2>Agendamento alterado</h2>${linhas.map((l) => `<p>${esc(l)}</p>`).join('')}`,
  });
}

async function notificarEntrega(ap) {
  const ok = ap.status === 'recebido';
  const linhas = [
    ok ? 'Sua carga foi recebida no Centro de Distribuição.' : 'Sua carga foi recusada no ato da entrega.',
    `Data e hora: ${dataBR(ap.dataRecebimento)} às ${ap.horarioRecebimento}`,
    ap.observacaoEntrega ? `${ok ? 'Observação' : 'Motivo'}: ${ap.observacaoEntrega}` : null,
    `Notas: ${ap.notas.join(', ')}`,
  ].filter(Boolean);
  await enviar({
    to: ap.fornecedor.email,
    subject: ok ? 'Carga recebida' : 'Carga recusada na entrega',
    text: linhas.join('\n'),
    html: `<h2>${ok ? 'Carga recebida' : 'Carga recusada na entrega'}</h2>${linhas.map((l) => `<p>${esc(l)}</p>`).join('')}`,
  });
}

module.exports = {
  notificarNovaSolicitacao, notificarDecisao, notificarContraproposta, notificarRespostaFornecedor,
  notificarReagendamento, notificarEntrega,
};
