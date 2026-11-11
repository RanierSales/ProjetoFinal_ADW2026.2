const Joi = require('joi');
const { somenteDigitos, cnpjValido } = require('../utils/cnpj');
const { hoje } = require('../utils/date');

// Mensagens em português para os erros mais comuns do Joi
const mensagens = {
  'any.required': 'Preencha o campo {{#label}}',
  'any.only': '{{#label}} possui um valor inválido',
  'string.base': '{{#label}} deve ser um texto',
  'string.empty': '{{#label}} não pode ficar vazio',
  'string.email': '{{#label}} deve ser um e-mail válido',
  'string.min': '{{#label}} deve ter ao menos {{#limit}} caracteres',
  'string.max': '{{#label}} deve ter no máximo {{#limit}} caracteres',
  'string.pattern.base': '{{#label}} está em formato inválido',
  'number.base': '{{#label}} deve ser um número',
  'number.min': '{{#label}} deve ser no mínimo {{#limit}}',
  'number.max': '{{#label}} deve ser no máximo {{#limit}}',
  'number.positive': '{{#label}} deve ser maior que zero',
  'number.integer': '{{#label}} deve ser um número inteiro',
  'array.base': '{{#label}} deve ser uma lista',
  'array.min': 'Informe ao menos {{#limit}} item em {{#label}}',
  'array.max': '{{#label}} aceita no máximo {{#limit}} itens',
  'array.unique': '{{#label}} contém valores repetidos',
  'object.min': 'Envie ao menos um campo para atualizar',
  'any.unknown': '{{#label}} não é permitido neste caso',
};

const cnpj = Joi.string()
  .custom((v, h) => (cnpjValido(v) ? somenteDigitos(v) : h.error('cnpj.invalido')))
  .messages({ 'cnpj.invalido': '{{#label}} é inválido' })
  .label('CNPJ');

const dataISO = (label) =>
  Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .custom((v, h) => {
      const d = new Date(`${v}T00:00:00Z`);
      if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) return h.error('data.invalida');
      return v;
    })
    .messages({ 'data.invalida': '{{#label}} é inválida' })
    .label(label);

const dataFutura = (label) =>
  dataISO(label)
    .custom((v, h) => (v < hoje() ? h.error('data.passada') : v))
    .messages({ 'data.passada': '{{#label}} não pode estar no passado' });

const horario = Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/).label('Horário');

// ---------- Auth ----------
const registerSchema = Joi.object({
  nome: Joi.string().trim().min(3).max(120).required().label('Nome'),
  email: Joi.string().trim().lowercase().email({ tlds: { allow: false } }).required().label('E-mail'),
  cnpj: cnpj.required(),
  senha: Joi.string().min(6).max(72).required().label('Senha'),
});

const loginSchema = Joi.object({
  email: Joi.string().trim().lowercase().email({ tlds: { allow: false } }).required().label('E-mail'),
  senha: Joi.string().required().label('Senha'),
});

// ---------- Fornecedores ----------
const supplierCreateSchema = Joi.object({
  razaoSocial: Joi.string().trim().min(2).max(120).required().label('Razão social'),
  cnpj: cnpj.required(),
  email: Joi.string().trim().lowercase().email({ tlds: { allow: false } }).required().label('E-mail'),
  telefone: Joi.string().trim().allow('').max(20).label('Telefone'),
  ativo: Joi.boolean().label('Ativo'),
});

const supplierUpdateSchema = Joi.object({
  razaoSocial: Joi.string().trim().min(2).max(120).label('Razão social'),
  cnpj,
  email: Joi.string().trim().lowercase().email({ tlds: { allow: false } }).label('E-mail'),
  telefone: Joi.string().trim().allow('').max(20).label('Telefone'),
  ativo: Joi.boolean().label('Ativo'),
}).min(1);

// ---------- Agendamentos ----------
const notas = Joi.array()
  .items(Joi.string().trim().pattern(/^[0-9A-Za-z\-/.]{1,44}$/).label('Número da nota'))
  .min(1)
  .max(50)
  .unique()
  .label('Notas fiscais');

const appointmentCreateSchema = Joi.object({
  pesoKg: Joi.number().positive().max(100000).required().label('Peso (kg)'),
  volumes: Joi.number().integer().min(1).max(100000).required().label('Volumes'),
  notas: notas.required(),
  dataSugerida: dataFutura('Data sugerida').required(),
  observacao: Joi.string().trim().allow('').max(500).label('Observação'),
});

const appointmentUpdateSchema = Joi.object({
  pesoKg: Joi.number().positive().max(100000).label('Peso (kg)'),
  volumes: Joi.number().integer().min(1).max(100000).label('Volumes'),
  notas,
  dataSugerida: dataFutura('Data sugerida'),
  observacao: Joi.string().trim().allow('').max(500).label('Observação'),
}).min(1);

// Decisão do admin: aprovar exige data+horário; recusar exige justificativa.
const decisionSchema = Joi.object({
  status: Joi.string().valid('aprovado', 'recusado').required().label('Decisão'),
  dataAprovada: Joi.when('status', { is: 'aprovado', then: dataFutura('Data aprovada').required(), otherwise: Joi.forbidden() }),
  horarioAprovado: Joi.when('status', { is: 'aprovado', then: horario.required(), otherwise: Joi.forbidden() }),
  observacaoAdmin: Joi.when('status', {
    is: 'recusado',
    then: Joi.string().trim().min(3).max(500).required().label('Motivo da recusa'),
    otherwise: Joi.string().trim().allow('').max(500).label('Observação'),
  }),
});

module.exports = {
  mensagens,
  registerSchema,
  loginSchema,
  supplierCreateSchema,
  supplierUpdateSchema,
  appointmentCreateSchema,
  appointmentUpdateSchema,
  decisionSchema,
};
