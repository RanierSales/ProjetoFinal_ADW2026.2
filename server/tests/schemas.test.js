const { appointmentCreateSchema, decisionSchema, respostaSchema, reagendarSchema, entregaSchema, registerSchema, mensagens } = require('../src/validators/schemas');
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

describe('e-mail', () => {
  test('aceita domínios internos como admin@cd.local', () => {
    const { loginSchema } = require('../src/validators/schemas');
    expect(loginSchema.validate({ email: 'admin@cd.local', senha: 'x' }, opts).error).toBeUndefined();
    expect(loginSchema.validate({ email: 'sem-arroba', senha: 'x' }, opts).error).toBeDefined();
  });
});

describe('contraproposta', () => {
  test('exige data e horário propostos e não aceita campos de aprovação', () => {
    expect(decisionSchema.validate({ status: 'contraproposta' }, opts).error).toBeDefined();
    expect(decisionSchema.validate({ status: 'contraproposta', dataProposta: amanha(), horarioProposto: '14:00' }, opts).error).toBeUndefined();
    expect(decisionSchema.validate({ status: 'contraproposta', dataProposta: amanha(), horarioProposto: '14:00', dataAprovada: amanha() }, opts).error).toBeDefined();
  });
  test('data proposta no passado é rejeitada', () => {
    expect(decisionSchema.validate({ status: 'contraproposta', dataProposta: '2020-01-01', horarioProposto: '14:00' }, opts).error).toBeDefined();
  });
  test('resposta do fornecedor só aceita aceitar/recusar', () => {
    expect(respostaSchema.validate({ acao: 'aceitar' }, opts).error).toBeUndefined();
    expect(respostaSchema.validate({ acao: 'talvez' }, opts).error).toBeDefined();
  });
});

describe('reagendamento e baixa da entrega', () => {
  test('reagendar exige nova data futura e horário', () => {
    expect(reagendarSchema.validate({ dataAprovada: amanha(), horarioAprovado: '09:30' }, opts).error).toBeUndefined();
    expect(reagendarSchema.validate({ dataAprovada: '2020-01-01', horarioAprovado: '09:30' }, opts).error).toBeDefined();
    expect(reagendarSchema.validate({ dataAprovada: amanha() }, opts).error).toBeDefined();
  });
  test('não permite alterar dados da nota ao reagendar (campos extras são descartados)', () => {
    const { value } = reagendarSchema.validate({ dataAprovada: amanha(), horarioAprovado: '09:30', pesoKg: 1, notas: ['9'] }, opts);
    expect(value.pesoKg).toBeUndefined();
    expect(value.notas).toBeUndefined();
  });
  test('recebido exige data (não futura) e horário reais', () => {
    expect(entregaSchema.validate({ resultado: 'recebido', dataRecebimento: hoje(), horarioRecebimento: '10:15' }, opts).error).toBeUndefined();
    expect(entregaSchema.validate({ resultado: 'recebido', dataRecebimento: hoje() }, opts).error).toBeDefined();
    expect(entregaSchema.validate({ resultado: 'recebido', dataRecebimento: amanha(), horarioRecebimento: '10:15' }, opts).error).toBeDefined();
  });
  test('recusado na entrega exige motivo', () => {
    const base = { resultado: 'recusado_entrega', dataRecebimento: hoje(), horarioRecebimento: '10:15' };
    expect(entregaSchema.validate(base, opts).error).toBeDefined();
    expect(entregaSchema.validate({ ...base, observacaoEntrega: 'Carga avariada' }, opts).error).toBeUndefined();
  });
  test('desfazer baixa não aceita data/hora', () => {
    expect(entregaSchema.validate({ resultado: 'aprovado' }, opts).error).toBeUndefined();
    expect(entregaSchema.validate({ resultado: 'aprovado', dataRecebimento: hoje(), horarioRecebimento: '10:00' }, opts).error).toBeDefined();
  });
});
