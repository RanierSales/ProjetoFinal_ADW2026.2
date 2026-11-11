const { Schema, model } = require('mongoose');

const supplierSchema = new Schema(
  {
    razaoSocial: { type: String, required: true, trim: true, maxlength: 120 },
    cnpj: { type: String, required: true, unique: true, match: /^\d{14}$/ }, // só dígitos
    email: { type: String, required: true, lowercase: true, trim: true },
    telefone: { type: String, trim: true, maxlength: 20 },
    ativo: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, versionKey: false, transform: (_d, ret) => { delete ret._id; return ret; } },
  }
);

module.exports = model('Supplier', supplierSchema);
