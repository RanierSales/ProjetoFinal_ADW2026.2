import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import http, { errorMessage } from '../../api/http';
import useRealtimeRefresh from '../../hooks/useRealtimeRefresh';
import { formatDate, formatKg } from '../../utils/format';
import Alert from '../../components/Alert';
import Spinner from '../../components/Spinner';
import WeekCalendar from '../../components/WeekCalendar';

export default function Dashboard() {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState('');

  const carregar = useCallback(() => {
    http.get('/dashboard').then((r) => setD(r.data)).catch((e) => setErro(errorMessage(e)));
  }, []);
  useEffect(carregar, [carregar]);
  useRealtimeRefresh(carregar);

  if (erro) return <Alert>{erro}</Alert>;
  if (!d) return <Spinner block />;

  return (
    <>
      <header className="page-head"><h1>Painel</h1></header>

      <div className="stats">
        <Link to="/admin/solicitacoes" className="stat stat-key">
          <strong>{d.totais.pendente}</strong>
          <span>aguardando análise</span>
        </Link>
        <div className="stat"><strong>{d.totais.contraproposta}</strong><span>contrapropostas aguardando resposta</span></div>
        <div className="stat"><strong>{d.agenda.recebimentos}</strong><span>recebimentos agendados</span></div>
        {d.atrasados > 0 && (
          <Link to="/admin/solicitacoes" className="stat stat-warn">
            <strong>{d.atrasados}</strong><span>com data vencida, falta dar baixa</span>
          </Link>
        )}
        <div className="stat"><strong>{formatKg(d.agenda.pesoKg)}</strong><span>previstos nos próximos dias</span></div>
        <div className="stat"><strong>{d.agenda.volumes}</strong><span>volumes previstos</span></div>
        <div className="stat"><strong>{d.fornecedoresAtivos}</strong><span>fornecedores ativos</span></div>
      </div>

      <WeekCalendar />

      <div className="gap">
        <section className="card">
          <h2>Pendentes mais urgentes</h2>
          {d.pendentesAntigos.length === 0 ? <p className="muted">Tudo em dia. Nenhuma solicitação aguardando.</p> : (
            <ul className="agenda">
              {d.pendentesAntigos.map((a) => (
                <li key={a.id}>
                  <time>Sugerida: {formatDate(a.dataSugerida)}</time>
                  <Link to={`/solicitacoes/${a.id}`}>{a.fornecedor.razaoSocial}</Link>
                  <span className="muted">{formatKg(a.pesoKg)} · {a.quantidadeNotas} NF</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
