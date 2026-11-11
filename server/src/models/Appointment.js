const { Schema, model } = require('mongoose');

// contraproposta = o CD sugeriu outra data e aguarda a resposta do fornecedor
// recebido / recusado_entrega = baixa feita pelo CD no ato da entrega (recusado = recusa antes da entrega)
const STATUS = ['pendente', 'contraproposta', 'aprovado', 'recebido', 'recusado_entrega', 'recusado'];

const arquivoSchema = new Schema(
  {
    nomeOriginal: { type: String, required: true },
    arquivo: { type: String, required: true }, // nome salvo em disco (UUID)
    mimetype: String,
    tamanho: Number,
  },
  { _id: false }
);

const appointmentSchema = new Schema(
  {
    fornecedor: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true, index: true },
    solicitante: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    pesoKg: { type: Number, required: true, min: 0.01 },
    notas: { type: [String], validate: [(v) => v.length > 0, 'Informe ao menos uma nota'] },
    volumes: { type: Number, required: true, min: 1 },
    dataSugerida: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    observacao: { type: String, trim: true, maxlength: 500 },
    arquivos: { type: [arquivoSchema], default: [] },

    status: { type: String, enum: STATUS, default: 'pendente', index: true },
    dataAprovada: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
    horarioAprovado: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    dataAprovadaAnterior: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ }, // preenchido quando o CD reagenda
    horarioAprovadoAnterior: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    dataRecebimento: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ }, // data/hora reais da entrega
    horarioRecebimento: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    observacaoEntrega: { type: String, trim: true, maxlength: 500 },
    baixaPor: { type: Schema.Types.ObjectId, ref: 'User' },
    baixaEm: Date,
    dataProposta: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
    horarioProposto: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    observacaoAdmin: { type: String, trim: true, maxlength: 500 },
    respostaFornecedor: { type: String, trim: true, maxlength: 500 },
    recusadoPor: { type: String, enum: ['cd', 'fornecedor'] },
    decididoPor: { type: Schema.Types.ObjectId, ref: 'User' },
    decididoEm: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, versionKey: false, transform: (_d, ret) => { delete ret._id; return ret; } },
  }
);

appointmentSchema.virtual('quantidadeNotas').get(function () {
  return this.notas ? this.notas.length : 0;
});

// Consulta de ocupação de horário (aprovados por data+hora)
appointmentSchema.index({ status: 1, dataAprovada: 1, horarioAprovado: 1 });

module.exports = model('Appointment', appointmentSchema);
module.exports.STATUS = STATUS;
