// Evita try/catch em todo controller: qualquer erro cai no errorHandler.
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
