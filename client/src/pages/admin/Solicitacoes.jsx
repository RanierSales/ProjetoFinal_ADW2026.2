import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import http, { errorMessage } from '../../api/http';
import useRealtimeRefresh from '../../hooks/useRealtimeRefresh';
import { formatDate, formatKg } from '../../utils/format';
import Alert from '../../components/Alert';
import Spinner from '../../components/Spinner';
import StatusBadge from '../../components/StatusBadge';
import Pagination from '../../components/Pagination';

const FILTROS = [['pendente', 'Aguardando'], ['aprovado', 'Aprovadas'], ['recusado', 'Recusadas'], ['', 'Todas']];

export default function Solicitacoes() {
  const [status, setStatus] = useState('pendente');
  const [data, setData] = useState('');
  const [page, setPage] = useState(1);
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    setErro('');
    try {
      const { data: r } = await http.get('/agendamentos', { params: { status: status || undefined, dataSugerida: data || undefined, page } });
      setRes(r);
    } catch (e) {
      setErro(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [status, data, page]);

  useEffect(() => { setLoading(true); carregar(); }, [carregar]);
  useRealtimeRefresh(carregar);

  return (
    <>
      <header className="page-head"><h1>Solicitações</h1></header>

      <div className="toolbar">
        <div className="tabs" role="tablist">
          {FILTROS.map(([v, l]) => (
            <button key={l} role="tab" aria-selected={status === v} className={status === v ? 'tab active' : 'tab'} onClick={() => { setStatus(v); setPage(1); }}>{l}</button>
          ))}
        </div>
        <label className="inline-label">Data sugerida
          <input type="date" value={data} onChange={(e) => { setData(e.target.value); setPage(1); }} />
        </label>
        {data && <button className="btn btn-ghost" onClick={() => setData('')}>Limpar data</button>}
      </div>

      <Alert>{erro}</Alert>
      {loading ? <Spinner block /> : !res?.data.length ? (
        <div className="empty"><p>Nenhuma solicitação com esses filtros.</p></div>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Fornecedor</th><th>Data sugerida</th><th>Peso</th><th>Volumes</th><th>NF</th><th>Situação</th><th /></tr></thead>
              <tbody>
                {res.data.map((ap) => (
                  <tr key={ap.id}>
                    <td>{ap.fornecedor.razaoSocial}</td>
                    <td>{formatDate(ap.dataSugerida)}</td>
                    <td>{formatKg(ap.pesoKg)}</td>
                    <td>{ap.volumes}</td>
                    <td>{ap.quantidadeNotas}</td>
                    <td>
                      <StatusBadge status={ap.status} />
                      {ap.status === 'aprovado' && <div className="small muted">{formatDate(ap.dataAprovada)} {ap.horarioAprovado}</div>}
                    </td>
                    <td className="row-actions"><Link className="btn btn-ghost" to={`/solicitacoes/${ap.id}`}>{ap.status === 'pendente' ? 'Analisar' : 'Ver'}</Link></td>
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
