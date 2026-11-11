const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const Supplier = require('../models/Supplier');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const gerarToken = (user) => jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

async function resposta(user) {
  await user.populate('fornecedor', 'razaoSocial cnpj');
  return { token: gerarToken(user), user };
}

// "Primeiro acesso": só funciona se o admin já pré-cadastrou o fornecedor (CNPJ + e-mail conferem).
exports.register = asyncHandler(async (req, res) => {
  const { nome, email, cnpj, senha } = req.body;
  const fornecedor = await Supplier.findOne({ cnpj });
  if (!fornecedor || !fornecedor.ativo || fornecedor.email !== email) {
    throw new AppError(403, 'CNPJ e e-mail não conferem com um fornecedor pré-cadastrado. Fale com o Centro de Distribuição.');
  }
  if (await User.exists({ email })) throw new AppError(409, 'Este e-mail já possui acesso. Faça login.');

  const user = await User.create({ nome, email, senha, role: 'fornecedor', fornecedor: fornecedor._id });
  res.status(201).json(await resposta(user));
});

exports.login = asyncHandler(async (req, res) => {
  const { email, senha } = req.body;
  const user = await User.findOne({ email }).select('+senha');
  // Mesma mensagem para e-mail inexistente e senha errada (não revela quais e-mails existem).
  if (!user || !user.ativo || !(await user.compararSenha(senha))) {
    throw new AppError(401, 'E-mail ou senha incorretos');
  }
  res.json(await resposta(user));
});

exports.me = asyncHandler(async (req, res) => {
  await req.user.populate('fornecedor', 'razaoSocial cnpj');
  res.json(req.user);
});
