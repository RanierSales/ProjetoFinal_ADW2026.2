const AppError = require('../utils/AppError');
const { mensagens } = require('../validators/schemas');

// O backend nunca confia no frontend: todo body passa por um schema Joi.
module.exports = (schema) => (req, _res, next) => {
  const { error, value } = schema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
    messages: mensagens,
  });
  if (error) {
    const details = error.details.map((d) => d.message.replace(/"/g, ''));
    return next(new AppError(400, 'Dados inválidos', details));
  }
  req.body = value;
  next();
};
