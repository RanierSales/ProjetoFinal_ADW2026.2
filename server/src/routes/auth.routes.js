const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const ctrl = require('../controllers/auth.controller');
const validate = require('../middlewares/validate');
const { authenticate } = require('../middlewares/auth');
const { registerSchema, loginSchema } = require('../validators/schemas');

// Freia tentativa de adivinhar senha.
const limitador = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.' },
});

router.post('/register', limitador, validate(registerSchema), ctrl.register);
router.post('/login', limitador, validate(loginSchema), ctrl.login);
router.get('/me', authenticate, ctrl.me);

module.exports = router;
