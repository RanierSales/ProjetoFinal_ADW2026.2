import { useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { SOCKET_URL } from '../api/http';

// Conecta no Socket.io e transforma eventos do servidor em avisos na tela.
function RealtimeBridge() {
  const { user } = useAuth();
  const toast = useToast();

  useEffect(() => {
    const socket = io(SOCKET_URL, { auth: { token: localStorage.getItem('token') } });
    const mudou = () => window.dispatchEvent(new Event('agendamentos:changed'));

    socket.on('agendamento:novo', (p) => {
      toast(`Nova solicitação de ${p.fornecedor}`, 'info');
      mudou();
    });
    socket.on('agendamento:decidido', (p) => {
      toast(p.status === 'aprovado' ? 'Seu agendamento foi aprovado!' : 'Sua solicitação foi analisada: recusada.', p.status === 'aprovado' ? 'success' : 'error');
      mudou();
    });
    return () => socket.disconnect();
  }, [user?.id, toast]);

  return null;
}

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();

  const links = isAdmin
    ? [
        ['/admin', 'Painel', true],
        ['/admin/solicitacoes', 'Solicitações'],
        ['/admin/fornecedores', 'Fornecedores'],
      ]
    : [
        ['/portal', 'Minhas solicitações', true],
        ['/portal/nova', 'Nova solicitação'],
      ];

  return (
    <div className="shell">
      <RealtimeBridge />
      <aside className="sidebar">
        <div className="brand">
          <div className="hazard" aria-hidden="true" />
          <strong>Recebimento CD</strong>
          <span>{isAdmin ? 'Painel do Centro de Distribuição' : user.fornecedor?.razaoSocial}</span>
        </div>
        <nav>
          {links.map(([to, label, end]) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}>{label}</NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span>{user.nome}</span>
          <button className="btn btn-ghost-light" onClick={logout}>Sair</button>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
