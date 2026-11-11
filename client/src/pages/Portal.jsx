import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import http, { errorMessage } from '../api/http';
import useRealtimeRefresh from '../hooks/useRealtimeRefresh';
import { useToast } from '../context/ToastContext';
import { formatDate, formatKg } from '../utils/format';
import Alert from '../components/Alert';
import Spinner from '../components/Spinner';
import StatusBadge from '../components/StatusBadge';
import Pagination from '../components/Pagination';

const FILTROS = [['', 'Todas'], ['pendente', 'Aguardando'], ['aprovado', 'Aprovadas'], ['recusado', 'Recusadas']];

// Portal do fornecedor: mostra se cada solicitação foi aceita e para qual dia/horário.
export default function Portal() {
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    setErro('');
    try {
      const { data } = await http.get('/agendamentos', { params: { status: status || undefined, page } });
      setRes(data);
    } catch (err) {
      setErro(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => { setLoading(true); carregar(); }, [carregar]);
  useRealtimeRefresh(carregar);

  async function cancelar(ap) {
    if (!window.confirm('Cancelar esta solicitação?')) return;
    try {
      await http.delete(`/agendamentos/${ap.id}`);
      toast('Solicitação cancelada.', 'success');
      carregar();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  }

  return (
    <>
      <header className="page-head">
        <h1>Minhas solicitações</h1>
        <Link className="btn btn-primary" to="/portal/nova">Nova solicitação</Link>
      </header>

      <div className="tabs" role="tablist">
        {FILTROS.map(([v, l]) => (
          <button key={v} role="tab" aria-selected={status === v} className={status === v ? 'tab active' : 'tab'} onClick={() => { setStatus(v); setPage(1); }}>{l}</button>
        ))}
      </div>

      <Alert>{erro}</Alert>
      {loading ? (
        <Spinner block />
      ) : !res?.data.length ? (
        <div className="empty">
          <p>Nenhuma solicitação por aqui.</p>
          <Link className="btn btn-primary" to="/portal/nova">Solicitar um agendamento</Link>
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Enviada em</th><th>Data sugerida</th><th>Carga</th><th>Situação</th><th>Recebimento confirmado</th><th /></tr>
              </thead>
              <tbody>
                {res.data.map((ap) => (
                  <tr key={ap.id}>
                    <td>{new Date(ap.createdAt).toLocaleDateString('pt-BR')}</td>
                    <td>{formatDate(ap.dataSugerida)}</td>
                    <td>{formatKg(ap.pesoKg)} · {ap.volumes} vol. · {ap.quantidadeNotas} NF</td>
                    <td><StatusBadge status={ap.status} /></td>
                    <td>
                      {ap.status === 'aprovado' ? <strong>{formatDate(ap.dataAprovada)} às {ap.horarioAprovado}</strong> : ap.status === 'recusado' ? 'Não aprovado' : '—'}
                    </td>
                    <td className="row-actions">
                      <Link className="btn btn-ghost" to={`/solicitacoes/${ap.id}`}>Detalhes</Link>
                      {ap.status === 'pendente' && (
                        <>
                          <Link className="btn btn-ghost" to={`/portal/${ap.id}/editar`}>Editar</Link>
                          <button className="btn btn-ghost danger" onClick={() => cancelar(ap)}>Cancelar</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={res.page} pages={res.pages} onChange={setPage} />
        </>
      )}
    </>
  );
}
