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

const FILTROS = [
  ['', 'Todas'], ['pendente', 'Aguardando'], ['contraproposta', 'Contrapropostas'], ['aprovado', 'A entregar'],
  ['recebido', 'Entregues'], ['recusado_entrega', 'Recusadas na entrega'], ['recusado', 'Recusadas'],
];

// Portal do fornecedor: o que já foi entregue, o que falta entregar e a situação de cada solicitação.
export default function Portal() {
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [res, setRes] = useState(null);
  const [resumo, setResumo] = useState(null);
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

  const carregarResumo = useCallback(() => {
    http.get('/dashboard/fornecedor').then((r) => setResumo(r.data)).catch((err) => setErro(errorMessage(err)));
  }, []);

  const atualizar = useCallback(() => { carregar(); carregarResumo(); }, [carregar, carregarResumo]);

  useEffect(() => { setLoading(true); carregar(); }, [carregar]);
  useEffect(carregarResumo, [carregarResumo]);
  useRealtimeRefresh(atualizar);

  async function cancelar(ap) {
    if (!window.confirm('Cancelar esta solicitação?')) return;
    try {
      await http.delete(`/agendamentos/${ap.id}`);
      toast('Solicitação cancelada.', 'success');
      atualizar();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  }

  const t = resumo?.totais;

  return (
    <>
      <header className="page-head">
        <h1>Minhas cargas</h1>
        <Link className="btn btn-primary" to="/portal/nova">Nova solicitação</Link>
      </header>

      <Alert>{erro}</Alert>

      {t?.contraproposta > 0 && (
        <div className="callout callout-info">
          <strong>{t.contraproposta} solicitação(ões) com contraproposta de data do CD aguardando sua resposta.</strong>
          <p><button className="btn btn-ghost" onClick={() => { setStatus('contraproposta'); setPage(1); }}>Ver contrapropostas</button></p>
        </div>
      )}

      {!resumo ? <Spinner block /> : (
        <>
          <div className="stats">
            <div className="stat stat-key"><strong>{t.aprovado}</strong><span>pendentes de entrega</span></div>
            <div className="stat"><strong>{t.recebido}</strong><span>já entregues ({formatKg(resumo.entregue.pesoKg)} · {resumo.entregue.volumes} vol.)</span></div>
            <div className="stat"><strong>{t.pendente + t.contraproposta}</strong><span>em análise pelo CD</span></div>
            {t.recusado_entrega > 0 && <div className="stat stat-warn"><strong>{t.recusado_entrega}</strong><span>recusadas na entrega</span></div>}
          </div>

          <div className="cols-2 gap">
            <section className="card">
              <h2>Pendentes de entrega</h2>
              {resumo.pendentesEntrega.length === 0 ? <p className="muted">Nenhuma carga aguardando entrega.</p> : (
                <ul className="entregas">
                  {resumo.pendentesEntrega.map((a) => (
                    <li key={a.id}>
                      <time>
                        {formatDate(a.dataAprovada)} às {a.horarioAprovado}
                        {a.atrasada && <span className="late">Data vencida</span>}
                      </time>
                      <span className="muted">{formatKg(a.pesoKg)} · {a.volumes} vol. · {a.quantidadeNotas} NF ({a.notas.slice(0, 3).join(', ')}{a.notas.length > 3 ? '…' : ''})</span>
                      <Link to={`/solicitacoes/${a.id}`}>Ver detalhes</Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card">
              <h2>Já entregues</h2>
              {resumo.ultimasEntregas.length === 0 ? <p className="muted">Nenhuma carga entregue ainda.</p> : (
                <ul className="entregas">
                  {resumo.ultimasEntregas.map((a) => (
                    <li key={a.id}>
                      <time>Recebida em {formatDate(a.dataRecebimento)} às {a.horarioRecebimento}</time>
                      <span className="muted">{formatKg(a.pesoKg)} · {a.volumes} vol. · {a.quantidadeNotas} NF ({a.notas.slice(0, 3).join(', ')}{a.notas.length > 3 ? '…' : ''})</span>
                      <Link to={`/solicitacoes/${a.id}`}>Ver detalhes</Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {resumo.recusadasNaEntrega.length > 0 && (
            <section className="card">
              <h2>Recusadas na entrega</h2>
              <ul className="entregas">
                {resumo.recusadasNaEntrega.map((a) => (
                  <li key={a.id}>
                    <time>{formatDate(a.dataRecebimento)} às {a.horarioRecebimento} · {formatKg(a.pesoKg)} · {a.quantidadeNotas} NF</time>
                    <span className="muted">Motivo: {a.observacaoEntrega}</span>
                    <Link to={`/solicitacoes/${a.id}`}>Ver detalhes</Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <h2 className="section-title">Todas as solicitações</h2>
      <div className="tabs" role="tablist">
        {FILTROS.map(([v, l]) => (
          <button key={v} role="tab" aria-selected={status === v} className={status === v ? 'tab active' : 'tab'} onClick={() => { setStatus(v); setPage(1); }}>{l}</button>
        ))}
      </div>

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
                <tr><th>Enviada em</th><th>Data sugerida</th><th>Carga</th><th>Situação</th><th>Recebimento</th><th /></tr>
              </thead>
              <tbody>
                {res.data.map((ap) => (
                  <tr key={ap.id}>
                    <td>{new Date(ap.createdAt).toLocaleDateString('pt-BR')}</td>
                    <td>{formatDate(ap.dataSugerida)}</td>
                    <td>{formatKg(ap.pesoKg)} · {ap.volumes} vol. · {ap.quantidadeNotas} NF</td>
                    <td><StatusBadge status={ap.status} /></td>
                    <td>
                      {ap.status === 'aprovado' && <strong>Previsto {formatDate(ap.dataAprovada)} às {ap.horarioAprovado}</strong>}
                      {ap.status === 'recebido' && <strong>Recebido {formatDate(ap.dataRecebimento)} às {ap.horarioRecebimento}</strong>}
                      {ap.status === 'recusado_entrega' && <span>Recusado na entrega {formatDate(ap.dataRecebimento)} às {ap.horarioRecebimento}</span>}
                      {ap.status === 'contraproposta' && <span>CD propõe <strong>{formatDate(ap.dataProposta)} às {ap.horarioProposto}</strong></span>}
                      {ap.status === 'recusado' && 'Não aprovado'}
                      {ap.status === 'pendente' && '—'}
                    </td>
                    <td className="row-actions">
                      {ap.status === 'contraproposta'
                        ? <Link className="btn btn-primary" to={`/solicitacoes/${ap.id}`}>Responder</Link>
                        : <Link className="btn btn-ghost" to={`/solicitacoes/${ap.id}`}>Detalhes</Link>}
                      {ap.status === 'pendente' && <Link className="btn btn-ghost" to={`/portal/${ap.id}/editar`}>Editar</Link>}
                      {['pendente', 'contraproposta'].includes(ap.status) && <button className="btn btn-ghost danger" onClick={() => cancelar(ap)}>Cancelar</button>}
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
