const { appointmentCreateSchema, decisionSchema, registerSchema, mensagens } = require('../src/validators/schemas');
const { cnpjValido } = require('../src/utils/cnpj');
const { hoje } = require('../src/utils/date');

const opts = { abortEarly: false, stripUnknown: true, convert: true, messages: mensagens };
const amanha = () => new Date(Date.parse(`${hoje()}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);

describe('validação de agendamento (entrada nunca é confiável)', () => {
  const ok = { pesoKg: '1250.5', volumes: '12', notas: ['1234', '1235'], dataSugerida: amanha() };

  test('aceita payload válido e converte tipos', () => {
    const { error, value } = appointmentCreateSchema.validate(ok, opts);
    expect(error).toBeUndefined();
    expect(value.pesoKg).toBe(1250.5);
    expect(value.volumes).toBe(12);
  });

  test('rejeita data no passado', () => {
    const { error } = appointmentCreateSchema.validate({ ...ok, dataSugerida: '2020-01-01' }, opts);
    expect(error.details[0].message).toMatch(/passado/);
  });

  test('rejeita peso negativo, notas repetidas e lista vazia', () => {
    expect(appointmentCreateSchema.validate({ ...ok, pesoKg: -3 }, opts).error).toBeDefined();
    expect(appointmentCreateSchema.validate({ ...ok, notas: ['1', '1'] }, opts).error).toBeDefined();
    expect(appointmentCreateSchema.validate({ ...ok, notas: [] }, opts).error).toBeDefined();
  });

  test('descarta campos que o cliente não pode definir (ex.: status)', () => {
    const { value } = appointmentCreateSchema.validate({ ...ok, status: 'aprovado' }, opts);
    expect(value.status).toBeUndefined();
  });
});

describe('decisão do admin', () => {
  test('aprovar exige data e horário', () => {
    expect(decisionSchema.validate({ status: 'aprovado' }, opts).error).toBeDefined();
    expect(decisionSchema.validate({ status: 'aprovado', dataAprovada: amanha(), horarioAprovado: '08:30' }, opts).error).toBeUndefined();
  });
  test('recusar exige motivo', () => {
    expect(decisionSchema.validate({ status: 'recusado' }, opts).error).toBeDefined();
    expect(decisionSchema.validate({ status: 'recusado', observacaoAdmin: 'Sem doca disponível' }, opts).error).toBeUndefined();
  });
});

describe('CNPJ', () => {
  test('valida dígitos verificadores', () => {
    expect(cnpjValido('11.222.333/0001-81')).toBe(true);
    expect(cnpjValido('11.222.333/0001-82')).toBe(false);
    expect(cnpjValido('00000000000000')).toBe(false);
  });
  test('registro normaliza CNPJ para só dígitos', () => {
    const { value } = registerSchema.validate({ nome: 'Maria', email: 'A@B.com', cnpj: '11.222.333/0001-81', senha: '123456' }, opts);
    expect(value.cnpj).toBe('11222333000181');
    expect(value.email).toBe('a@b.com');
  });
});
