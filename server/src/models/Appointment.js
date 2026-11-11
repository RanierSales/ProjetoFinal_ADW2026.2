const { Schema, model } = require('mongoose');

const STATUS = ['pendente', 'aprovado', 'recusado'];

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
    observacaoAdmin: { type: String, trim: true, maxlength: 500 },
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
