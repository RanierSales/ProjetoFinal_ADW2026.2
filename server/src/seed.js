// Cria o admin inicial e um fornecedor de exemplo. Pode rodar várias vezes.
require('dotenv').config();
const connectDB = require('./config/db');
const mongoose = require('mongoose');
const User = require('./models/User');
const Supplier = require('./models/Supplier');

(async () => {
  await connectDB();

  const email = (process.env.ADMIN_EMAIL || 'admin@cd.local').toLowerCase();
  if (!(await User.exists({ email }))) {
    await User.create({
      nome: process.env.ADMIN_NOME || 'Administrador',
      email,
      senha: process.env.ADMIN_PASSWORD || 'admin123',
      role: 'admin',
    });
    console.log(`Admin criado: ${email}`);
  } else {
    console.log('Admin já existe.');
  }

  if (!(await Supplier.exists({ cnpj: '11222333000181' }))) {
    await Supplier.create({
      razaoSocial: 'Fornecedor Exemplo Ltda',
      cnpj: '11222333000181',
      email: 'fornecedor@exemplo.com',
      telefone: '(95) 99999-0000',
    });
    console.log('Fornecedor de exemplo criado: CNPJ 11.222.333/0001-81, e-mail fornecedor@exemplo.com (use em "Primeiro acesso").');
  }

  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
