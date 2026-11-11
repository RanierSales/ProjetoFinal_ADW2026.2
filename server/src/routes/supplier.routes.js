const router = require('express').Router();
const ctrl = require('../controllers/supplier.controller');
const validate = require('../middlewares/validate');
const { authenticate, authorize } = require('../middlewares/auth');
const { supplierCreateSchema, supplierUpdateSchema } = require('../validators/schemas');

// Tudo aqui é exclusivo do admin.
router.use(authenticate, authorize('admin'));

router.get('/', ctrl.list);
router.post('/', validate(supplierCreateSchema), ctrl.create);
router.get('/:id', ctrl.getOne);
router.put('/:id', validate(supplierUpdateSchema), ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
