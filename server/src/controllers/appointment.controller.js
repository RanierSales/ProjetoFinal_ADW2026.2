const fs = require('fs/promises');
const path = require('path');
const mongoose = require('mongoose');
const config = require('../config');
const Appointment = require('../models/Appointment');
const { STATUS } = require('../models/Appointment');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { hoje, addDays } = require('../utils/date');
const {
  notificarNovaSolicitacao, notificarDecisao, notificarContraproposta, notificarRespostaFornecedor,
  notificarReagendamento, notificarEntrega,
} = require('../services/mailer');
const { emitToAdmins, emitToFornecedor } = require('../services/socket');

const MAX_ARQUIVOS = 5;

// Falha com 409 se o horário já atingiu o número de docas.
async function verificarVaga(data, horario, ignorarId) {
  const filtro = { status: 'aprovado', dataAprovada: data, horarioAprovado: horario };
  if (ignorarId) filtro._id = { $ne: ignorarId };
  const ocupados = await Appointment.countDocuments(filtro);
  if (ocupados >= config.docas) {
    throw new AppError(409, `Horário lotado: já há ${ocupados} recebimento(s) aprovado(s) em ${horario} (${config.docas} doca(s)). Escolha outro horário.`);
  }
}

const removerDoDisco = (arquivos = []) =>
  Promise.all(arquivos.map((a) => fs.unlink(path.join(config.uploadDir, a.arquivo)).catch(() => {})));

const mapearArquivos = (files = []) =>
  files.map((f) => ({ nomeOriginal: f.originalname, arquivo: f.filename, mimetype: f.mimetype, tamanho: f.size }));

// Fornecedor só enxerga o que é dele. Admin enxerga tudo.
async function carregar(req) {
  const ap = await Appointment.findById(req.params.id).populate('fornecedor', 'razaoSocial cnpj email');
  if (!ap) throw new AppError(404, 'Solicitação não encontrada');
  if (req.user.role === 'fornecedor' && String(ap.fornecedor.id) !== String(req.user.fornecedor)) {
    throw new AppError(404, 'Solicitação não encontrada'); // 404 de propósito: não revela que existe
  }
  return ap;
}

exports.create = asyncHandler(async (req, res) => {
  const ap = await Appointment.create({
    ...req.body,
    fornecedor: req.user.fornecedor,
    solicitante: req.user._id,
    arquivos: mapearArquivos(req.files),
  });
  await ap.populate('fornecedor', 'razaoSocial cnpj email');

  // E-mail não pode derrubar a requisição: se falhar, só registra no log.
  notificarNovaSolicitacao(ap).catch((e) => console.error('[mail] falha ao notificar nova solicitação:', e.message));
  emitToAdmins('agendamento:novo', { id: ap.id, fornecedor: ap.fornecedor.razaoSocial });

  res.status(201).json(ap);
});

exports.list = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
  const filtro = {};
  const { status, fornecedor, dataSugerida } = req.query;

  if (typeof status === 'string' && STATUS.includes(status)) filtro.status = status;
  if (typeof dataSugerida === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dataSugerida)) filtro.dataSugerida = dataSugerida;

  if (req.user.role === 'fornecedor') {
    filtro.fornecedor = req.user.fornecedor;
  } else if (typeof fornecedor === 'string' && mongoose.isValidObjectId(fornecedor)) {
    filtro.fornecedor = fornecedor;
  }

  // Para o admin, pendentes mais urgentes primeiro.
  const ordem = req.user.role === 'admin' && filtro.status === 'pendente' ? { dataSugerida: 1, createdAt: 1 } : { createdAt: -1 };

  const [data, total] = await Promise.all([
    Appointment.find(filtro).populate('fornecedor', 'razaoSocial cnpj').sort(ordem).skip((page - 1) * limit).limit(limit),
    Appointment.countDocuments(filtro),
  ]);
  res.json({ data, total, page, pages: Math.max(Math.ceil(total / limit), 1) });
});

exports.getOne = asyncHandler(async (req, res) => {
  res.json(await carregar(req));
});

exports.update = asyncHandler(async (req, res) => {
  const ap = await carregar(req);
  if (ap.status !== 'pendente') throw new AppError(409, 'Só é possível editar solicitações pendentes');

  const novos = mapearArquivos(req.files);
  if (ap.arquivos.length + novos.length > MAX_ARQUIVOS) {
    throw new AppError(400, `Máximo de ${MAX_ARQUIVOS} arquivos por solicitação`);
  }

  ap.set(req.body);
  ap.arquivos.push(...novos);
  await ap.save();
  res.json(ap);
});

exports.remove = asyncHandler(async (req, res) => {
  const ap = await carregar(req);
  if (req.user.role === 'fornecedor' && !['pendente', 'contraproposta'].includes(ap.status)) {
    throw new AppError(409, 'Só é possível cancelar solicitações ainda não decididas');
  }
  await removerDoDisco(ap.arquivos);
  await ap.deleteOne();
  res.status(204).end();
});

// Admin aprova, contrapropõe outra data ou recusa. Também pode rever uma contraproposta ainda sem resposta.
exports.decidir = asyncHandler(async (req, res) => {
  const ap = await carregar(req);
  if (!['pendente', 'contraproposta'].includes(ap.status)) throw new AppError(409, 'Esta solicitação já foi finalizada');

  const { status, dataAprovada, horarioAprovado, dataProposta, horarioProposto, observacaoAdmin } = req.body;

  ap.dataAprovada = undefined;
  ap.horarioAprovado = undefined;
  ap.dataProposta = undefined;
  ap.horarioProposto = undefined;
  ap.recusadoPor = undefined;

  if (status === 'aprovado') {
    await verificarVaga(dataAprovada, horarioAprovado);
    ap.dataAprovada = dataAprovada;
    ap.horarioAprovado = horarioAprovado;
  } else if (status === 'contraproposta') {
    await verificarVaga(dataProposta, horarioProposto);
    ap.dataProposta = dataProposta;
    ap.horarioProposto = horarioProposto;
  } else {
    ap.recusadoPor = 'cd';
  }

  ap.status = status;
  ap.observacaoAdmin = observacaoAdmin || undefined;
  ap.respostaFornecedor = undefined;
  ap.decididoPor = req.user._id;
  ap.decididoEm = new Date();
  await ap.save();

  const aviso = status === 'contraproposta' ? notificarContraproposta(ap) : notificarDecisao(ap);
  aviso.catch((e) => console.error('[mail] falha ao notificar decisão:', e.message));
  emitToFornecedor(ap.fornecedor.id, status === 'contraproposta' ? 'agendamento:contraproposta' : 'agendamento:decidido', { id: ap.id, status });

  res.json(ap);
});

// Fornecedor aceita ou recusa a data sugerida pelo CD.
exports.responderProposta = asyncHandler(async (req, res) => {
  const ap = await carregar(req);
  if (ap.status !== 'contraproposta') throw new AppError(409, 'Não há contraproposta aguardando resposta');

  const { acao, observacao } = req.body;

  if (acao === 'aceitar') {
    if (ap.dataProposta < hoje()) throw new AppError(409, 'A data proposta já passou. Peça ao CD uma nova data.');
    await verificarVaga(ap.dataProposta, ap.horarioProposto); // alguém pode ter ocupado a vaga nesse meio tempo
    ap.status = 'aprovado';
    ap.dataAprovada = ap.dataProposta;
    ap.horarioAprovado = ap.horarioProposto;
  } else {
    ap.status = 'recusado';
    ap.recusadoPor = 'fornecedor';
  }
  ap.dataProposta = undefined;
  ap.horarioProposto = undefined;
  ap.respostaFornecedor = observacao || undefined;
  await ap.save();

  notificarRespostaFornecedor(ap).catch((e) => console.error('[mail] falha ao notificar resposta:', e.message));
  emitToAdmins('agendamento:respondido', { id: ap.id, fornecedor: ap.fornecedor.razaoSocial, status: ap.status });

  res.json(ap);
});

// Admin altera data/horário de um recebimento aprovado. Peso, volumes e notas não são tocados.
exports.reagendar = asyncHandler(async (req, res) => {
  const ap = await carregar(req);
  if (ap.status !== 'aprovado') throw new AppError(409, 'Só é possível reagendar recebimentos aprovados que ainda não foram baixados');

  const { dataAprovada, horarioAprovado, observacaoAdmin } = req.body;
  if (dataAprovada === ap.dataAprovada && horarioAprovado === ap.horarioAprovado) {
    throw new AppError(400, 'Escolha uma data ou horário diferente do atual');
  }
  await verificarVaga(dataAprovada, horarioAprovado, ap._id);

  ap.dataAprovadaAnterior = ap.dataAprovada;
  ap.horarioAprovadoAnterior = ap.horarioAprovado;
  ap.dataAprovada = dataAprovada;
  ap.horarioAprovado = horarioAprovado;
  if (observacaoAdmin) ap.observacaoAdmin = observacaoAdmin;
  await ap.save();

  notificarReagendamento(ap).catch((e) => console.error('[mail] falha ao notificar reagendamento:', e.message));
  emitToFornecedor(ap.fornecedor.id, 'agendamento:atualizado', { id: ap.id, status: ap.status, mensagem: 'O CD alterou a data/horário de um recebimento.' });
  res.json(ap);
});

// Baixa no ato da entrega: recebido ou recusado, com data/hora reais. Também serve para corrigir ou desfazer a baixa.
exports.registrarEntrega = asyncHandler(async (req, res) => {
  const ap = await carregar(req);
  if (!['aprovado', 'recebido', 'recusado_entrega'].includes(ap.status)) {
    throw new AppError(409, 'A entrega só pode ser registrada em solicitações aprovadas');
  }

  const { resultado, dataRecebimento, horarioRecebimento, observacaoEntrega } = req.body;

  if (resultado === 'aprovado') {
    if (ap.status === 'aprovado') throw new AppError(400, 'Esta entrega ainda não foi baixada');
    ap.status = 'aprovado';
    ap.dataRecebimento = undefined;
    ap.horarioRecebimento = undefined;
    ap.observacaoEntrega = undefined;
    ap.baixaPor = undefined;
    ap.baixaEm = undefined;
  } else {
    ap.status = resultado;
    ap.dataRecebimento = dataRecebimento;
    ap.horarioRecebimento = horarioRecebimento;
    ap.observacaoEntrega = observacaoEntrega || undefined;
    ap.baixaPor = req.user._id;
    ap.baixaEm = new Date();
  }
  await ap.save();

  if (resultado !== 'aprovado') {
    notificarEntrega(ap).catch((e) => console.error('[mail] falha ao notificar entrega:', e.message));
    emitToFornecedor(ap.fornecedor.id, 'agendamento:atualizado', {
      id: ap.id,
      status: ap.status,
      mensagem: resultado === 'recebido' ? 'Uma de suas cargas foi recebida.' : 'Uma de suas cargas foi recusada na entrega.',
    });
  }
  res.json(ap);
});

// Agenda de uma semana (7 dias a partir de "inicio") para o calendário do painel.
exports.semana = asyncHandler(async (req, res) => {
  const { inicio } = req.query;
  if (typeof inicio !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(inicio)) throw new AppError(400, 'Informe o início da semana (AAAA-MM-DD)');
  const fim = addDays(inicio, 6);
  const faixa = { $gte: inicio, $lte: fim };
  const popular = (q) => q.populate('fornecedor', 'razaoSocial');

  const [aprovados, contras, pendentes, baixados] = await Promise.all([
    popular(Appointment.find({ status: 'aprovado', dataAprovada: faixa })),
    popular(Appointment.find({ status: 'contraproposta', dataProposta: faixa })),
    popular(Appointment.find({ status: 'pendente', dataSugerida: faixa })),
    popular(Appointment.find({ status: { $in: ['recebido', 'recusado_entrega'] }, dataRecebimento: faixa })),
  ]);

  const evento = (a, tipo, data, horario) => ({
    id: a.id, tipo, data, horario: horario || null,
    fornecedor: a.fornecedor.razaoSocial, pesoKg: a.pesoKg, volumes: a.volumes, quantidadeNotas: a.quantidadeNotas,
  });
  const eventos = [
    ...aprovados.map((a) => evento(a, 'aprovado', a.dataAprovada, a.horarioAprovado)),
    ...contras.map((a) => evento(a, 'contraproposta', a.dataProposta, a.horarioProposto)),
    ...pendentes.map((a) => evento(a, 'pendente', a.dataSugerida, null)),
    ...baixados.map((a) => evento(a, a.status, a.dataRecebimento, a.horarioRecebimento)),
  ].sort((x, y) => x.data.localeCompare(y.data) || (x.horario || '99').localeCompare(y.horario || '99'));

  res.json({ inicio, fim, docas: config.docas, eventos });
});

// Quantos recebimentos já estão aprovados em cada horário de uma data (ajuda o admin a escolher).
exports.ocupacao = asyncHandler(async (req, res) => {
  const { data } = req.query;
  if (typeof data !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new AppError(400, 'Informe a data no formato AAAA-MM-DD');
  const grupos = await Appointment.aggregate([
    { $match: { status: 'aprovado', dataAprovada: data } },
    { $group: { _id: '$horarioAprovado', total: { $sum: 1 } } },
  ]);
  const horarios = Object.fromEntries(grupos.map((g) => [g._id, g.total]));
  res.json({ data, docas: config.docas, horarios });
});

exports.baixarArquivo = asyncHandler(async (req, res) => {
  const ap = await carregar(req);
  // Só serve arquivos que constam no registro (nunca um caminho vindo da URL).
  const arq = ap.arquivos.find((a) => a.arquivo === req.params.arquivo);
  if (!arq) throw new AppError(404, 'Arquivo não encontrado');
  res.download(path.join(config.uploadDir, arq.arquivo), arq.nomeOriginal);
});

