const { Schema, model } = require('mongoose');
const bcrypt = require('bcryptjs');

const ROLES = ['admin', 'fornecedor'];

const userSchema = new Schema(
  {
    nome: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    senha: { type: String, required: true, select: false }, // hash bcrypt, nunca volta nas consultas
    role: { type: String, enum: ROLES, default: 'fornecedor' },
    fornecedor: {
      type: Schema.Types.ObjectId,
      ref: 'Supplier',
      required: function () { return this.role === 'fornecedor'; },
    },
    ativo: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, versionKey: false, transform: (_d, ret) => { delete ret._id; delete ret.senha; return ret; } },
  }
);

userSchema.pre('save', async function () {
  if (!this.isModified('senha')) return;
  this.senha = await bcrypt.hash(this.senha, 10);
});

userSchema.methods.compararSenha = function (senhaPlana) {
  return bcrypt.compare(senhaPlana, this.senha);
};

module.exports = model('User', userSchema);
module.exports.ROLES = ROLES;
