import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Spinner from './components/Spinner';
import Login from './pages/Login';
import Register from './pages/Register';
import Portal from './pages/Portal';
import SolicitacaoForm from './pages/SolicitacaoForm';
import Detalhe from './pages/Detalhe';
import Dashboard from './pages/admin/Dashboard';
import Solicitacoes from './pages/admin/Solicitacoes';
import Fornecedores from './pages/admin/Fornecedores';

// "/" manda cada perfil para a sua área.
function Home() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner block />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'admin' ? '/admin' : '/portal'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/primeiro-acesso" element={<Register />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/solicitacoes/:id" element={<Detalhe />} />

          <Route element={<ProtectedRoute roles={['fornecedor']} />}>
            <Route path="/portal" element={<Portal />} />
            <Route path="/portal/nova" element={<SolicitacaoForm />} />
            <Route path="/portal/:id/editar" element={<SolicitacaoForm />} />
          </Route>

          <Route element={<ProtectedRoute roles={['admin']} />}>
            <Route path="/admin" element={<Dashboard />} />
            <Route path="/admin/solicitacoes" element={<Solicitacoes />} />
            <Route path="/admin/fornecedores" element={<Fornecedores />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
