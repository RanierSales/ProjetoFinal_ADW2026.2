const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// AuthN: quem é você?
const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new AppError(401, 'Faça login para continuar');

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw new AppError(401, 'Sessão expirada ou inválida. Entre novamente.');
  }

  const user = await User.findById(payload.sub);
  if (!user || !user.ativo) throw new AppError(401, 'Usuário não encontrado ou desativado');
  req.user = user;
  next();
});

// AuthZ: o que você pode fazer?
const authorize = (...roles) => (req, _res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(new AppError(403, 'Você não tem permissão para esta ação'));
  }
  next();
};

module.exports = { authenticate, authorize };
