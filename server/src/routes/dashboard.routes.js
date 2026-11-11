const router = require('express').Router();
const ctrl = require('../controllers/dashboard.controller');
const { authenticate, authorize } = require('../middlewares/auth');

router.get('/', authenticate, authorize('admin'), ctrl.resumo);
router.get('/fornecedor', authenticate, authorize('fornecedor'), ctrl.resumoFornecedor);

module.exports = router;
