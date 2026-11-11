const Appointment = require('../models/Appointment');
const Supplier = require('../models/Supplier');
const asyncHandler = require('../utils/asyncHandler');
const { hoje } = require('../utils/date');

exports.resumo = asyncHandler(async (_req, res) => {
  const hojeStr = hoje();

  const [porStatus, aprovadosFuturos, proximos, pendentesAntigos, fornecedoresAtivos] = await Promise.all([
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
  ]);

  const totais = { pendente: 0, aprovado: 0, recusado: 0 };
  porStatus.forEach((s) => { totais[s._id] = s.total; });
  const agenda = aprovadosFuturos[0] || { pesoKg: 0, volumes: 0, recebimentos: 0 };

  res.json({
    totais,
    agenda: { pesoKg: agenda.pesoKg, volumes: agenda.volumes, recebimentos: agenda.recebimentos },
    proximos,
    pendentesAntigos,
    fornecedoresAtivos,
  });
});
