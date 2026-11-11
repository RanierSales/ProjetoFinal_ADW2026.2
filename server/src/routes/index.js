const router = require('express').Router();

router.get('/health', (_req, res) => res.json({ ok: true }));
router.use('/auth', require('./auth.routes'));
router.use('/fornecedores', require('./supplier.routes'));
router.use('/agendamentos', require('./appointment.routes'));
router.use('/dashboard', require('./dashboard.routes'));

module.exports = router;
