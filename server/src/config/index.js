require('dotenv').config();

const list = (v) => (v || '').split(',').map((s) => s.trim()).filter(Boolean);

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3001,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/cd_agendamento',
  jwtSecret: process.env.JWT_SECRET || (process.env.NODE_ENV === 'test' ? 'segredo-de-teste' : undefined),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  docas: Number(process.env.DOCAS) || 2,
  // Roraima/Amazonas = UTC-4. Usado para decidir o que é "hoje".
  tzOffsetHours: -4,
  uploadDir: require('path').join(__dirname, '..', '..', 'uploads'),
  maxFileSize: 5 * 1024 * 1024,
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  mailFrom: process.env.MAIL_FROM || 'Agendamento CD <nao-responder@cd.local>',
  notifyEmails: list(process.env.NOTIFY_EMAILS),
};
