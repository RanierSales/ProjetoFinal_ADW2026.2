const fs = require('fs/promises');
const path = require('path');
const mongoose = require('mongoose');
const config = require('../config');
const Appointment = require('../models/Appointment');
const { STATUS } = require('../models/Appointment');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { notificarNovaSolicitacao, notificarDecisao } = require('../services/mailer');
const { emitToAdmins, emitToFornecedor } = require('../services/socket');

const MAX_ARQUIVOS = 5;

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
  if (req.user.role === 'fornecedor' && ap.status !== 'pendente') {
    throw new AppError(409, 'Só é possível cancelar solicitações pendentes');
  }
  await removerDoDisco(ap.arquivos);
  await ap.deleteOne();
  res.status(204).end();
});

// Admin aprova (com data+horário) ou recusa (com motivo).
exports.decidir = asyncHandler(async (req, res) => {
  const ap = await carregar(req);
  if (ap.status !== 'pendente') throw new AppError(409, 'Esta solicitação já foi analisada');

  const { status, dataAprovada, horarioAprovado, observacaoAdmin } = req.body;

  if (status === 'aprovado') {
    const ocupados = await Appointment.countDocuments({ status: 'aprovado', dataAprovada, horarioAprovado });
    if (ocupados >= config.docas) {
      throw new AppError(409, `Horário lotado: já há ${ocupados} recebimento(s) aprovado(s) para ${horarioAprovado} (${config.docas} doca(s)).`);
    }
    ap.dataAprovada = dataAprovada;
    ap.horarioAprovado = horarioAprovado;
  }

  ap.status = status;
  ap.observacaoAdmin = observacaoAdmin || undefined;
  ap.decididoPor = req.user._id;
  ap.decididoEm = new Date();
  await ap.save();

  notificarDecisao(ap).catch((e) => console.error('[mail] falha ao notificar decisão:', e.message));
  emitToFornecedor(ap.fornecedor.id, 'agendamento:decidido', { id: ap.id, status: ap.status });

  res.json(ap);
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

