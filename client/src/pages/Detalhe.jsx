import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import http, { errorMessage } from '../api/http';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { HORARIOS, formatCnpj, formatDate, formatKg, todayISO } from '../utils/format';
import Alert from '../components/Alert';
import Spinner from '../components/Spinner';
import StatusBadge from '../components/StatusBadge';

// Detalhe da solicitação. O admin também decide (aprovar/recusar) por aqui.
export default function Detalhe() {
  const { id } = useParams();
  const { isAdmin } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [ap, setAp] = useState(null);
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    http.get(`/agendamentos/${id}`).then((r) => setAp(r.data)).catch((e) => setErro(errorMessage(e))).finally(() => setLoading(false));
  }, [id]);

  async function baixar(arq) {
    try {
      const r = await http.get(`/agendamentos/${id}/arquivos/${arq.arquivo}`, { responseType: 'blob' });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = arq.nomeOriginal;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast('Não foi possível baixar o arquivo.', 'error');
    }
  }

  if (loading) return <Spinner block />;
  if (!ap) return <><Alert>{erro || 'Solicitação não encontrada.'}</Alert><button className="btn btn-ghost" onClick={() => navigate(-1)}>Voltar</button></>;

  return (
    <>
      <header className="page-head">
        <h1>Solicitação de {ap.fornecedor.razaoSocial}</h1>
        <StatusBadge status={ap.status} />
      </header>

      {ap.status === 'aprovado' && (
        <div className="callout callout-ok">
          <strong>Recebimento confirmado para {formatDate(ap.dataAprovada)} às {ap.horarioAprovado}.</strong>
          {ap.observacaoAdmin && <p>{ap.observacaoAdmin}</p>}
        </div>
      )}
      {ap.status === 'recusado' && (
        <div className="callout callout-no">
          <strong>Solicitação recusada.</strong>
          <p>Motivo: {ap.observacaoAdmin}</p>
        </div>
      )}

      <section className="card">
        <dl className="facts">
          <div><dt>Fornecedor</dt><dd>{ap.fornecedor.razaoSocial} · {formatCnpj(ap.fornecedor.cnpj)}</dd></div>
          <div><dt>Data sugerida</dt><dd>{formatDate(ap.dataSugerida)}</dd></div>
          <div><dt>Peso</dt><dd>{formatKg(ap.pesoKg)}</dd></div>
          <div><dt>Volumes</dt><dd>{ap.volumes}</dd></div>
          <div><dt>Enviada em</dt><dd>{new Date(ap.createdAt).toLocaleString('pt-BR')}</dd></div>
        </dl>
        <h3>Notas fiscais ({ap.quantidadeNotas})</h3>
        <ul className="chips">{ap.notas.map((n) => <li key={n}>{n}</li>)}</ul>
        {ap.observacao && <><h3>Observações</h3><p>{ap.observacao}</p></>}
        <h3>Arquivos</h3>
        {ap.arquivos.length === 0 ? <p className="muted">Nenhum arquivo anexado.</p> : (
          <ul className="files">
            {ap.arquivos.map((a) => (
              <li key={a.arquivo}>
                <span>{a.nomeOriginal} <em>({Math.ceil(a.tamanho / 1024)} KB)</em></span>
                <button className="btn btn-ghost" onClick={() => baixar(a)}>Baixar</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isAdmin && ap.status === 'pendente' && <PainelDecisao ap={ap} onDone={setAp} />}

      <p><Link to={isAdmin ? '/admin/solicitacoes' : '/portal'}>Voltar para a lista</Link></p>
    </>
  );
}

function PainelDecisao({ ap, onDone }) {
  const toast = useToast();
  const [decisao, setDecisao] = useState('aprovado');
  const [data, setData] = useState(ap.dataSugerida < todayISO() ? todayISO() : ap.dataSugerida);
  const [hora, setHora] = useState('08:00');
  const [obs, setObs] = useState('');
  const [ocup, setOcup] = useState(null);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Mostra quantas docas já estão ocupadas em cada horário da data escolhida.
  useEffect(() => {
    if (!data) return;
    http.get('/agendamentos/ocupacao', { params: { data } }).then((r) => setOcup(r.data)).catch(() => setOcup(null));
  }, [data]);

  const lotado = (h) => ocup && (ocup.horarios[h] || 0) >= ocup.docas;

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      const body = decisao === 'aprovado'
        ? { status: 'aprovado', dataAprovada: data, horarioAprovado: hora, observacaoAdmin: obs }
        : { status: 'recusado', observacaoAdmin: obs };
      const r = await http.patch(`/agendamentos/${ap.id}/decisao`, body);
      toast(decisao === 'aprovado' ? 'Agendamento aprovado. O fornecedor foi avisado por e-mail.' : 'Solicitação recusada. O fornecedor foi avisado por e-mail.', 'success');
      onDone(r.data);
    } catch (err) {
      setErro(errorMessage(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="card form" onSubmit={enviar} noValidate>
      <h2>Decisão</h2>
      <Alert>{erro}</Alert>
      <div className="segmented" role="radiogroup" aria-label="Decisão">
        <button type="button" role="radio" aria-checked={decisao === 'aprovado'} className={decisao === 'aprovado' ? 'on ok' : ''} onClick={() => setDecisao('aprovado')}>Aprovar</button>
        <button type="button" role="radio" aria-checked={decisao === 'recusado'} className={decisao === 'recusado' ? 'on no' : ''} onClick={() => setDecisao('recusado')}>Recusar</button>
      </div>

      {decisao === 'aprovado' && (
        <div className="grid-2">
          <label>Data do recebimento
            <input type="date" min={todayISO()} value={data} onChange={(e) => setData(e.target.value)} required />
          </label>
          <label>Horário
            <select value={hora} onChange={(e) => setHora(e.target.value)}>
              {HORARIOS.map((h) => (
                <option key={h} value={h} disabled={lotado(h)}>
                  {h}{ocup && ocup.horarios[h] ? ` — ${ocup.horarios[h]}/${ocup.docas} docas` : ''}{lotado(h) ? ' (lotado)' : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <label>{decisao === 'recusado' ? 'Motivo da recusa (o fornecedor verá)' : 'Observação para o fornecedor (opcional)'}
        <textarea rows="3" maxLength="500" value={obs} onChange={(e) => setObs(e.target.value)} required={decisao === 'recusado'} />
      </label>

      <button className={`btn ${decisao === 'aprovado' ? 'btn-primary' : 'btn-danger'}`} disabled={enviando}>
        {enviando ? <Spinner label="Enviando…" /> : decisao === 'aprovado' ? 'Aprovar agendamento' : 'Recusar solicitação'}
      </button>
    </form>
  );
}
