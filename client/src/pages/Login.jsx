import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { errorMessage } from '../api/http';
import Alert from '../components/Alert';
import Spinner from '../components/Spinner';

export function AuthShell({ title, subtitle, children }) {
  return (
    <div className="auth">
      <section className="auth-hero">
        <div className="hazard hazard-lg" aria-hidden="true" />
        <h1>Agende sua entrega no Centro de Distribuição</h1>
        <p>Envie peso, volumes e notas da carga e acompanhe a resposta com dia e horário confirmados.</p>
      </section>
      <section className="auth-card">
        <h2>{title}</h2>
        <p className="muted">{subtitle}</p>
        {children}
      </section>
    </div>
  );
}

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', senha: '' });
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function onSubmit(e) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      await login(form.email, form.senha);
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setErro(errorMessage(err)); // ex.: "E-mail ou senha incorretos"
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AuthShell title="Entrar" subtitle="Use o e-mail cadastrado no Centro de Distribuição.">
      <form onSubmit={onSubmit} className="form" noValidate>
        <Alert>{erro}</Alert>
        <label>E-mail
          <input type="email" value={form.email} onChange={set('email')} autoComplete="username" required />
        </label>
        <label>Senha
          <input type="password" value={form.senha} onChange={set('senha')} autoComplete="current-password" required />
        </label>
        <button className="btn btn-primary" disabled={enviando}>
          {enviando ? <Spinner label="Entrando…" /> : 'Entrar'}
        </button>
      </form>
      <p className="muted small">Primeira vez? <Link to="/primeiro-acesso">Crie seu acesso de fornecedor</Link></p>
    </AuthShell>
  );
}
