const Supplier = require('../models/Supplier');
const User = require('../models/User');
const Appointment = require('../models/Appointment');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { somenteDigitos } = require('../utils/cnpj');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

exports.list = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
  const filtro = {};

  if (typeof req.query.q === 'string' && req.query.q.trim()) {
    const q = req.query.q.trim();
    const digitos = somenteDigitos(q);
    filtro.$or = [{ razaoSocial: new RegExp(escapeRegex(q), 'i') }];
    if (digitos) filtro.$or.push({ cnpj: new RegExp(digitos) });
  }
  if (req.query.ativo === 'true' || req.query.ativo === 'false') filtro.ativo = req.query.ativo === 'true';

  const [data, total] = await Promise.all([
    Supplier.find(filtro).sort({ razaoSocial: 1 }).skip((page - 1) * limit).limit(limit),
    Supplier.countDocuments(filtro),
  ]);
  res.json({ data, total, page, pages: Math.max(Math.ceil(total / limit), 1) });
});

exports.create = asyncHandler(async (req, res) => {
  const fornecedor = await Supplier.create(req.body);
  res.status(201).json(fornecedor);
});

exports.getOne = asyncHandler(async (req, res) => {
  const fornecedor = await Supplier.findById(req.params.id);
  if (!fornecedor) throw new AppError(404, 'Fornecedor não encontrado');
  res.json(fornecedor);
});

exports.update = asyncHandler(async (req, res) => {
  const fornecedor = await Supplier.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!fornecedor) throw new AppError(404, 'Fornecedor não encontrado');
  // Fornecedor desativado perde o acesso ao portal.
  if (req.body.ativo === false) await User.updateMany({ fornecedor: fornecedor._id }, { ativo: false });
  if (req.body.ativo === true) await User.updateMany({ fornecedor: fornecedor._id }, { ativo: true });
  res.json(fornecedor);
});

exports.remove = asyncHandler(async (req, res) => {
  const fornecedor = await Supplier.findById(req.params.id);
  if (!fornecedor) throw new AppError(404, 'Fornecedor não encontrado');
  if (await Appointment.exists({ fornecedor: fornecedor._id })) {
    throw new AppError(409, 'Este fornecedor possui solicitações. Desative-o em vez de excluir.');
  }
  await User.deleteMany({ fornecedor: fornecedor._id });
  await fornecedor.deleteOne();
  res.status(204).end();
});
