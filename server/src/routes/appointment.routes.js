const router = require('express').Router();
const ctrl = require('../controllers/appointment.controller');
const validate = require('../middlewares/validate');
const { authenticate, authorize } = require('../middlewares/auth');
const { uploadNotas, parseNotas } = require('../middlewares/upload');
const { appointmentCreateSchema, appointmentUpdateSchema, decisionSchema } = require('../validators/schemas');

router.use(authenticate);

router.get('/ocupacao', authorize('admin'), ctrl.ocupacao); // antes de /:id
router.get('/', ctrl.list);
router.post('/', authorize('fornecedor'), uploadNotas, parseNotas, validate(appointmentCreateSchema), ctrl.create);
router.get('/:id', ctrl.getOne);
router.put('/:id', authorize('fornecedor'), uploadNotas, parseNotas, validate(appointmentUpdateSchema), ctrl.update);
router.delete('/:id', ctrl.remove);
router.patch('/:id/decisao', authorize('admin'), validate(decisionSchema), ctrl.decidir);
router.get('/:id/arquivos/:arquivo', ctrl.baixarArquivo);

module.exports = router;
