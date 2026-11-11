import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import http, { errorMessage } from '../api/http';
import useRealtimeRefresh from '../hooks/useRealtimeRefresh';
import { DIAS_SEMANA, addDays, formatDate, formatKg, startOfWeek, todayISO } from '../utils/format';
import Alert from './Alert';
import Spinner from './Spinner';

const TIPO_LABEL = {
  aprovado: 'Confirmado',
  contraproposta: 'Contraproposta',
  pendente: 'Data sugerida',
  recebido: 'Recebido',
  recusado_entrega: 'Recusado na entrega',
};

function Cards({ lista }) {
  return (
    <ul>
      {lista.map((e) => (
        <li key={`${e.tipo}-${e.id}`}>
          <Link to={`/solicitacoes/${e.id}`} className={`ev ev-${e.tipo}`}>
            <strong>{e.horario || 'Sem horário'}</strong>
            <span>{e.fornecedor}</span>
            <small>{formatKg(e.pesoKg)} · {e.volumes} vol. · {e.quantidadeNotas} NF</small>
            <em>{TIPO_LABEL[e.tipo]}</em>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Periodo({ titulo, lista }) {
  return (
    <div className="period">
      <h4>{titulo}</h4>
      {lista.length === 0 ? <p className="day-empty">Livre</p> : <Cards lista={lista} />}
    </div>
  );
}

// Calendário da semana em cards: confirmados, contrapropostas (aguardando fornecedor) e pedidos pendentes.
export default function WeekCalendar() {
  const hoje = todayISO();
  const [inicio, setInicio] = useState(startOfWeek(hoje));
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [mostrarPendentes, setMostrarPendentes] = useState(true);

  const carregar = useCallback(async () => {
    setErro('');
    try {
      const { data } = await http.get('/agendamentos/semana', { params: { inicio } });
      setDados(data);
    } catch (e) {
      setErro(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [inicio]);

  useEffect(() => { setLoading(true); carregar(); }, [carregar]);
  useRealtimeRefresh(carregar);

  const dias = Array.from({ length: 7 }, (_, i) => addDays(inicio, i));
  const eventos = (dados?.eventos || []).filter((e) => mostrarPendentes || e.tipo !== 'pendente');
  const semanaAtual = inicio === startOfWeek(hoje);

  return (
    <section className="card week">
      <div className="week-head">
        <div>
          <h2>Agenda da semana</h2>
          <p className="muted small">{formatDate(inicio)} a {formatDate(addDays(inicio, 6))}</p>
        </div>
        <div className="week-nav">
          <button className="btn btn-ghost" onClick={() => setInicio(addDays(inicio, -7))} aria-label="Semana anterior">‹ Anterior</button>
          <button className="btn btn-ghost" disabled={semanaAtual} onClick={() => setInicio(startOfWeek(hoje))}>Hoje</button>
          <button className="btn btn-ghost" onClick={() => setInicio(addDays(inicio, 7))} aria-label="Próxima semana">Próxima ›</button>
        </div>
      </div>

      <div className="week-legend">
        <span className="dot dot-aprovado" /> Confirmado
        <span className="dot dot-contraproposta" /> Contraproposta
        <span className="dot dot-recebido" /> Recebido
        <span className="dot dot-recusado_entrega" /> Recusado na entrega
        <label className="inline-label">
          <input type="checkbox" checked={mostrarPendentes} onChange={(e) => setMostrarPendentes(e.target.checked)} />
          <span className="dot dot-pendente" /> Pedidos aguardando (data sugerida)
        </label>
      </div>

      <Alert>{erro}</Alert>
      {loading ? <Spinner block /> : (
        <div className="week-grid">
          {dias.map((dia, i) => {
            const doDia = eventos.filter((e) => e.data === dia);
            return (
              <div key={dia} className={`day ${dia === hoje ? 'day-today' : ''}`}>
                <div className="day-head">
                  <strong>{DIAS_SEMANA[i]}</strong>
                  <span>{formatDate(dia).slice(0, 5)}</span>
                </div>
                <Periodo titulo="Manhã" lista={doDia.filter((e) => e.horario && e.horario < '12:00')} />
                <Periodo titulo="Tarde" lista={doDia.filter((e) => e.horario && e.horario >= '12:00')} />
                {doDia.some((e) => !e.horario) && (
                  <div className="period">
                    <h4>Sem horário</h4>
                    <Cards lista={doDia.filter((e) => !e.horario)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
