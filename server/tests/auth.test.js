const jwt = require('jsonwebtoken');
const config = require('../src/config');
const { authorize, authenticate } = require('../src/middlewares/auth');

jest.mock('../src/models/User', () => ({ findById: jest.fn() }));
const User = require('../src/models/User');

const run = (mw, req) => new Promise((resolve) => mw(req, {}, (err) => resolve(err)));

describe('controle de acesso (AuthZ)', () => {
  test('admin passa, fornecedor leva 403', async () => {
    const mw = authorize('admin');
    expect(await run(mw, { user: { role: 'admin' } })).toBeUndefined();
    const err = await run(mw, { user: { role: 'fornecedor' } });
    expect(err.status).toBe(403);
  });
});

describe('autenticação (AuthN)', () => {
  test('sem token -> 401', async () => {
    const err = await run(authenticate, { headers: {} });
    expect(err.status).toBe(401);
  });

  test('token adulterado -> 401', async () => {
    const token = jwt.sign({ sub: '1' }, 'outro-segredo');
    const err = await run(authenticate, { headers: { authorization: `Bearer ${token}` } });
    expect(err.status).toBe(401);
  });

  test('token válido carrega o usuário', async () => {
    User.findById.mockResolvedValue({ id: '1', ativo: true, role: 'admin' });
    const token = jwt.sign({ sub: '1' }, config.jwtSecret);
    const req = { headers: { authorization: `Bearer ${token}` } };
    expect(await run(authenticate, req)).toBeUndefined();
    expect(req.user.role).toBe('admin');
  });
});
