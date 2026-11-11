import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { errorMessage } from '../api/http';
import { formatCnpj } from '../utils/format';
import Alert from '../components/Alert';
import Spinner from '../components/Spinner';
import { AuthShell } from './Login';

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ nome: '', email: '', cnpj: '', senha: '', confirmar: '' });
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function onSubmit(e) {
    e.preventDefault();
    setErro('');
    if (form.senha !== form.confirmar) return setErro('As senhas não são iguais.');
    setEnviando(true);
    try {
      const { confirmar, ...dados } = form;
      await register(dados);
      navigate('/', { replace: true });
    } catch (err) {
      setErro(errorMessage(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AuthShell title="Primeiro acesso" subtitle="Seu CNPJ e e-mail precisam estar pré-cadastrados pelo Centro de Distribuição.">
      <form onSubmit={onSubmit} className="form" noValidate>
        <Alert>{erro}</Alert>
        <label>Seu nome
          <input value={form.nome} onChange={set('nome')} required />
        </label>
        <label>CNPJ da empresa
          <input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: formatCnpj(e.target.value) })} inputMode="numeric" placeholder="00.000.000/0000-00" required />
        </label>
        <label>E-mail cadastrado
          <input type="email" value={form.email} onChange={set('email')} autoComplete="username" required />
        </label>
        <label>Senha (mín. 6 caracteres)
          <input type="password" value={form.senha} onChange={set('senha')} autoComplete="new-password" required />
        </label>
        <label>Repita a senha
          <input type="password" value={form.confirmar} onChange={set('confirmar')} autoComplete="new-password" required />
        </label>
        <button className="btn btn-primary" disabled={enviando}>
          {enviando ? <Spinner label="Criando acesso…" /> : 'Criar acesso'}
        </button>
      </form>
      <p className="muted small">Já tem acesso? <Link to="/login">Entrar</Link></p>
    </AuthShell>
  );
}
