const router = require('express').Router();
const ctrl = require('../controllers/appointment.controller');
const validate = require('../middlewares/validate');
const { authenticate, authorize } = require('../middlewares/auth');
const { uploadNotas, parseNotas } = require('../middlewares/upload');
const { appointmentCreateSchema, appointmentUpdateSchema, decisionSchema, respostaSchema, reagendarSchema, entregaSchema } = require('../validators/schemas');

router.use(authenticate);

router.get('/ocupacao', authorize('admin'), ctrl.ocupacao); // rotas fixas antes de /:id
router.get('/semana', authorize('admin'), ctrl.semana);
router.get('/', ctrl.list);
router.post('/', authorize('fornecedor'), uploadNotas, parseNotas, validate(appointmentCreateSchema), ctrl.create);
router.get('/:id', ctrl.getOne);
router.put('/:id', authorize('fornecedor'), uploadNotas, parseNotas, validate(appointmentUpdateSchema), ctrl.update);
router.delete('/:id', ctrl.remove);
router.patch('/:id/decisao', authorize('admin'), validate(decisionSchema), ctrl.decidir);
router.patch('/:id/agendamento', authorize('admin'), validate(reagendarSchema), ctrl.reagendar);
router.patch('/:id/entrega', authorize('admin'), validate(entregaSchema), ctrl.registrarEntrega);
router.patch('/:id/resposta', authorize('fornecedor'), validate(respostaSchema), ctrl.responderProposta);
router.get('/:id/arquivos/:arquivo', ctrl.baixarArquivo);

module.exports = router;
