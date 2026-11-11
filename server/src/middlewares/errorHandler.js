const fs = require('fs');
const multer = require('multer');
const AppError = require('../utils/AppError');

function limparArquivos(files) {
  (files || []).forEach((f) => fs.unlink(f.path, () => {}));
}

// eslint-disable-next-line no-unused-vars
module.exports = (err, req, res, _next) => {
  // Se a requisição falhou, não deixa arquivo órfão em disco.
  limparArquivos(req.files);

  let status = err.status || 500;
  let message = err.message || 'Erro interno do servidor';
  let details = err.details;

  if (err instanceof multer.MulterError) {
    status = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'Cada arquivo deve ter no máximo 5 MB' : 'Erro no envio dos arquivos';
  } else if (err.name === 'ValidationError') {
    status = 400;
    message = 'Dados inválidos';
    details = Object.values(err.errors).map((e) => e.message);
  } else if (err.name === 'CastError') {
    status = 400;
    message = 'Identificador inválido';
  } else if (err.code === 11000) {
    status = 409;
    const campo = Object.keys(err.keyPattern || {})[0];
    message = campo === 'cnpj' ? 'Já existe um fornecedor com este CNPJ' : 'Registro duplicado';
  }

  if (status >= 500 && !(err instanceof AppError)) console.error(err);
  res.status(status).json({ message: status >= 500 ? 'Erro interno do servidor' : message, details });
};
