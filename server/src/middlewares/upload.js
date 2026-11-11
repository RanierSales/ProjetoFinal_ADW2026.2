const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const config = require('../config');
const AppError = require('../utils/AppError');

fs.mkdirSync(config.uploadDir, { recursive: true });

const PERMITIDOS = {
  '.pdf': ['application/pdf'],
  '.xml': ['text/xml', 'application/xml'],
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, config.uploadDir),
  // Nome aleatório: o nome original nunca vira caminho em disco (evita path traversal).
  filename: (_req, file, cb) => cb(null, crypto.randomUUID() + path.extname(file.originalname).toLowerCase()),
});

const upload = multer({
  storage,
  limits: { fileSize: config.maxFileSize, files: 5 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!PERMITIDOS[ext] || !PERMITIDOS[ext].includes(file.mimetype)) {
      return cb(new AppError(400, 'Envie apenas arquivos PDF ou XML da nota fiscal'));
    }
    cb(null, true);
  },
});

const uploadNotas = upload.array('arquivos', 5);

// Em multipart tudo chega como texto: "notas" vem como JSON ('["123","456"]') ou separado por vírgula/linha.
function parseNotas(req, _res, next) {
  if (typeof req.body.notas === 'string') {
    try {
      req.body.notas = JSON.parse(req.body.notas);
    } catch {
      req.body.notas = req.body.notas.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
    }
  }
  next();
}

module.exports = { uploadNotas, parseNotas };
