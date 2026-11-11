const mongoose = require('mongoose');
const Appointment = require('../models/Appointment');
const Supplier = require('../models/Supplier');
const asyncHandler = require('../utils/asyncHandler');
const { hoje } = require('../utils/date');

exports.resumo = asyncHandler(async (_req, res) => {
  const hojeStr = hoje();

  const [porStatus, aprovadosFuturos, proximos, pendentesAntigos, fornecedoresAtivos, atrasados] = await Promise.all([
    Appointment.aggregate([{ $group: { _id: '$status', total: { $sum: 1 } } }]),
    Appointment.aggregate([
      { $match: { status: 'aprovado', dataAprovada: { $gte: hojeStr } } },
      { $group: { _id: null, pesoKg: { $sum: '$pesoKg' }, volumes: { $sum: '$volumes' }, recebimentos: { $sum: 1 } } },
    ]),
    Appointment.find({ status: 'aprovado', dataAprovada: { $gte: hojeStr } })
      .populate('fornecedor', 'razaoSocial')
      .sort({ dataAprovada: 1, horarioAprovado: 1 })
      .limit(8),
    Appointment.find({ status: 'pendente' }).populate('fornecedor', 'razaoSocial').sort({ dataSugerida: 1, createdAt: 1 }).limit(5),
    Supplier.countDocuments({ ativo: true }),
    // aprovados cuja data já passou e ainda não tiveram baixa (recebido/recusado)
    Appointment.countDocuments({ status: 'aprovado', dataAprovada: { $lt: hojeStr } }),
  ]);

  const totais = { pendente: 0, contraproposta: 0, aprovado: 0, recebido: 0, recusado_entrega: 0, recusado: 0 };
  porStatus.forEach((s) => { totais[s._id] = s.total; });
  const agenda = aprovadosFuturos[0] || { pesoKg: 0, volumes: 0, recebimentos: 0 };

  res.json({
    totais,
    agenda: { pesoKg: agenda.pesoKg, volumes: agenda.volumes, recebimentos: agenda.recebimentos },
    proximos,
    pendentesAntigos,
    fornecedoresAtivos,
    atrasados,
  });
});

// Painel do fornecedor: o que já foi entregue e o que ainda está pendente de entrega.
exports.resumoFornecedor = asyncHandler(async (req, res) => {
  const fornecedor = new mongoose.Types.ObjectId(String(req.user.fornecedor));
  const hojeStr = hoje();

  const [porStatus, entregue, pendentesEntrega, ultimasEntregas, recusadasNaEntrega] = await Promise.all([
    Appointment.aggregate([{ $match: { fornecedor } }, { $group: { _id: '$status', total: { $sum: 1 } } }]),
    Appointment.aggregate([
      { $match: { fornecedor, status: 'recebido' } },
      { $group: { _id: null, pesoKg: { $sum: '$pesoKg' }, volumes: { $sum: '$volumes' } } },
    ]),
    Appointment.find({ fornecedor, status: 'aprovado' }).sort({ dataAprovada: 1, horarioAprovado: 1 }).limit(20),
    Appointment.find({ fornecedor, status: 'recebido' }).sort({ dataRecebimento: -1, horarioRecebimento: -1 }).limit(10),
    Appointment.find({ fornecedor, status: 'recusado_entrega' }).sort({ dataRecebimento: -1, horarioRecebimento: -1 }).limit(5),
  ]);

  const totais = { pendente: 0, contraproposta: 0, aprovado: 0, recebido: 0, recusado_entrega: 0, recusado: 0 };
  porStatus.forEach((s) => { totais[s._id] = s.total; });
  const ent = entregue[0] || { pesoKg: 0, volumes: 0 };

  res.json({
    totais,
    entregue: { pesoKg: ent.pesoKg, volumes: ent.volumes },
    pendentesEntrega: pendentesEntrega.map((a) => ({ ...a.toJSON(), atrasada: a.dataAprovada < hojeStr })),
    ultimasEntregas,
    recusadasNaEntrega,
  });
});
