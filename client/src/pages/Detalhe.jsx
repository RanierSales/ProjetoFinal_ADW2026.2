import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import http, { errorMessage } from '../api/http';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { HORARIOS, addDays, formatCnpj, formatDate, formatKg, horaAgora, todayISO } from '../utils/format';
import Alert from '../components/Alert';
import Spinner from '../components/Spinner';
import StatusBadge from '../components/StatusBadge';

// Detalhe da solicitação. O admin decide por aqui; o fornecedor responde às contrapropostas.
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

  const aberta = ['pendente', 'contraproposta'].includes(ap.status);

  return (
    <>
      <header className="page-head">
        <h1>Solicitação de {ap.fornecedor.razaoSocial}</h1>
        <StatusBadge status={ap.status} />
      </header>

      {ap.status === 'aprovado' && (
        <div className="callout callout-ok">
          <strong>Recebimento confirmado para {formatDate(ap.dataAprovada)} às {ap.horarioAprovado}.</strong>
          {ap.dataAprovadaAnterior && <p>Reagendado pelo CD (antes: {formatDate(ap.dataAprovadaAnterior)} às {ap.horarioAprovadoAnterior}).</p>}
          {ap.observacaoAdmin && <p>Observação do CD: {ap.observacaoAdmin}</p>}
          {ap.respostaFornecedor && <p>Comentário do fornecedor: {ap.respostaFornecedor}</p>}
        </div>
      )}
      {ap.status === 'contraproposta' && (
        <div className="callout callout-info">
          <strong>O CD propôs outra data: {formatDate(ap.dataProposta)} às {ap.horarioProposto}.</strong>
          {ap.observacaoAdmin && <p>Observação do CD: {ap.observacaoAdmin}</p>}
          {isAdmin && <p>Aguardando a resposta do fornecedor. Você também pode rever a decisão abaixo.</p>}
        </div>
      )}
      {ap.status === 'recebido' && (
        <div className="callout callout-ok">
          <strong>Carga recebida em {formatDate(ap.dataRecebimento)} às {ap.horarioRecebimento}.</strong>
          <p>Agendado para {formatDate(ap.dataAprovada)} às {ap.horarioAprovado}.</p>
          {ap.observacaoEntrega && <p>Observação: {ap.observacaoEntrega}</p>}
        </div>
      )}
      {ap.status === 'recusado_entrega' && (
        <div className="callout callout-no">
          <strong>Carga recusada no ato da entrega ({formatDate(ap.dataRecebimento)} às {ap.horarioRecebimento}).</strong>
          <p>Motivo: {ap.observacaoEntrega}</p>
        </div>
      )}
      {ap.status === 'recusado' && (
        <div className="callout callout-no">
          {ap.recusadoPor === 'fornecedor' ? (
            <>
              <strong>{isAdmin ? 'O fornecedor recusou a contraproposta.' : 'Você recusou a contraproposta.'}</strong>
              {ap.respostaFornecedor && <p>Comentário: {ap.respostaFornecedor}</p>}
            </>
          ) : (
            <>
              <strong>Solicitação recusada.</strong>
              <p>Motivo: {ap.observacaoAdmin}</p>
            </>
          )}
        </div>
      )}

      {!isAdmin && ap.status === 'contraproposta' && <RespostaProposta ap={ap} onDone={setAp} />}

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

      {isAdmin && aberta && <PainelDecisao ap={ap} onDone={setAp} />}
      {isAdmin && ap.status === 'aprovado' && <PainelAgendamento ap={ap} onDone={setAp} />}
      {isAdmin && ['aprovado', 'recebido', 'recusado_entrega'].includes(ap.status) && <PainelEntrega ap={ap} onDone={setAp} />}

      <p><Link to={isAdmin ? '/admin/solicitacoes' : '/portal'}>Voltar para a lista</Link></p>
    </>
  );
}

// Fornecedor: aceita ou recusa a data proposta pelo CD.
function RespostaProposta({ ap, onDone }) {
  const toast = useToast();
  const [obs, setObs] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState('');

  async function responder(acao) {
    if (acao === 'recusar' && !window.confirm('Recusar a contraproposta encerra esta solicitação. Continuar?')) return;
    setErro('');
    setEnviando(acao);
    try {
      const r = await http.patch(`/agendamentos/${ap.id}/resposta`, { acao, observacao: obs });
      toast(acao === 'aceitar' ? 'Nova data aceita. Recebimento confirmado!' : 'Contraproposta recusada.', acao === 'aceitar' ? 'success' : 'info');
      onDone(r.data);
    } catch (err) {
      setErro(errorMessage(err));
    } finally {
      setEnviando('');
    }
  }

  return (
    <section className="card form">
      <h2>Você aceita a nova data?</h2>
      <p>O CD propõe receber em <strong>{formatDate(ap.dataProposta)} às {ap.horarioProposto}</strong> no lugar de {formatDate(ap.dataSugerida)}.</p>
      <Alert>{erro}</Alert>
      <label>Comentário para o CD (opcional)
        <textarea rows="2" maxLength="500" value={obs} onChange={(e) => setObs(e.target.value)} />
      </label>
      <div className="form-actions">
        <button className="btn btn-danger" disabled={!!enviando} onClick={() => responder('recusar')}>
          {enviando === 'recusar' ? <Spinner label="Enviando…" /> : 'Recusar proposta'}
        </button>
        <button className="btn btn-primary" disabled={!!enviando} onClick={() => responder('aceitar')}>
          {enviando === 'aceitar' ? <Spinner label="Enviando…" /> : 'Aceitar nova data'}
        </button>
      </div>
    </section>
  );
}

const OPCOES = [
  ['aprovado', 'Aprovar', 'ok'],
  ['contraproposta', 'Contraproposta', 'info'],
  ['recusado', 'Recusar', 'no'],
];

// Admin: aprovar, propor outra data ou recusar.
function PainelDecisao({ ap, onDone }) {
  const toast = useToast();
  const [decisao, setDecisao] = useState('aprovado');
  const [data, setData] = useState(ap.dataSugerida < todayISO() ? todayISO() : ap.dataSugerida);
  const [hora, setHora] = useState('08:00');
  const [obs, setObs] = useState('');
  const [ocup, setOcup] = useState(null);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const usaData = decisao !== 'recusado';

  // Mostra quantas docas já estão ocupadas em cada horário da data escolhida.
  useEffect(() => {
    if (!data || !usaData) return;
    http.get('/agendamentos/ocupacao', { params: { data } }).then((r) => setOcup(r.data)).catch(() => setOcup(null));
  }, [data, usaData]);

  const lotado = (h) => ocup && (ocup.horarios[h] || 0) >= ocup.docas;

  function escolher(valor) {
    setDecisao(valor);
    setErro('');
    // Na contraproposta, sugere o dia seguinte ao pedido (a data original provavelmente não serve).
    if (valor === 'contraproposta' && data === ap.dataSugerida) setData(addDays(ap.dataSugerida, 1) < todayISO() ? todayISO() : addDays(ap.dataSugerida, 1));
    if (valor === 'aprovado' && data !== ap.dataSugerida && ap.dataSugerida >= todayISO()) setData(ap.dataSugerida);
  }

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      let body;
      if (decisao === 'aprovado') body = { status: 'aprovado', dataAprovada: data, horarioAprovado: hora, observacaoAdmin: obs };
      else if (decisao === 'contraproposta') body = { status: 'contraproposta', dataProposta: data, horarioProposto: hora, observacaoAdmin: obs };
      else body = { status: 'recusado', observacaoAdmin: obs };
      const r = await http.patch(`/agendamentos/${ap.id}/decisao`, body);
      toast(
        decisao === 'aprovado' ? 'Agendamento aprovado. O fornecedor foi avisado por e-mail.'
          : decisao === 'contraproposta' ? 'Contraproposta enviada. O fornecedor foi avisado por e-mail.'
            : 'Solicitação recusada. O fornecedor foi avisado por e-mail.',
        'success'
      );
      onDone(r.data);
    } catch (err) {
      setErro(errorMessage(err));
    } finally {
      setEnviando(false);
    }
  }

  const rotuloObs = decisao === 'recusado' ? 'Motivo da recusa (o fornecedor verá)' : decisao === 'contraproposta' ? 'Por que outra data? (opcional)' : 'Observação para o fornecedor (opcional)';
  const botao = decisao === 'aprovado' ? 'Aprovar agendamento' : decisao === 'contraproposta' ? 'Enviar contraproposta' : 'Recusar solicitação';

  return (
    <form className="card form" onSubmit={enviar} noValidate>
      <h2>{ap.status === 'contraproposta' ? 'Rever decisão' : 'Decisão'}</h2>
      <Alert>{erro}</Alert>
      <div className="segmented" role="radiogroup" aria-label="Decisão">
        {OPCOES.map(([v, l, cor]) => (
          <button key={v} type="button" role="radio" aria-checked={decisao === v} className={decisao === v ? `on ${cor}` : ''} onClick={() => escolher(v)}>{l}</button>
        ))}
      </div>

      {usaData && (
        <>
          {decisao === 'contraproposta' && <p className="muted small">O fornecedor pediu {formatDate(ap.dataSugerida)}. Escolha a data e o horário que o CD consegue receber; ele poderá aceitar ou recusar.</p>}
          <div className="grid-2">
            <label>{decisao === 'contraproposta' ? 'Data proposta' : 'Data do recebimento'}
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
        </>
      )}

      <label>{rotuloObs}
        <textarea rows="3" maxLength="500" value={obs} onChange={(e) => setObs(e.target.value)} required={decisao === 'recusado'} />
      </label>

      <button className={`btn ${decisao === 'recusado' ? 'btn-danger' : 'btn-primary'}`} disabled={enviando}>
        {enviando ? <Spinner label="Enviando…" /> : botao}
      </button>
    </form>
  );
}

// Admin: muda data/horário de um recebimento aprovado (dados da nota ficam intactos).
function PainelAgendamento({ ap, onDone }) {
  const toast = useToast();
  const [data, setData] = useState(ap.dataAprovada);
  const [hora, setHora] = useState(ap.horarioAprovado);
  const [obs, setObs] = useState('');
  const [ocup, setOcup] = useState(null);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!data) return;
    http.get('/agendamentos/ocupacao', { params: { data } }).then((r) => setOcup(r.data)).catch(() => setOcup(null));
  }, [data]);

  // O próprio horário atual desta carga não conta como ocupado.
  const ocupados = (h) => (ocup?.horarios[h] || 0) - (data === ap.dataAprovada && h === ap.horarioAprovado ? 1 : 0);
  const lotado = (h) => ocup && ocupados(h) >= ocup.docas;
  const igual = data === ap.dataAprovada && hora === ap.horarioAprovado;

  async function salvar(e) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      const r = await http.patch(`/agendamentos/${ap.id}/agendamento`, { dataAprovada: data, horarioAprovado: hora, observacaoAdmin: obs });
      toast('Data e horário alterados. O fornecedor foi avisado por e-mail.', 'success');
      setObs('');
      onDone(r.data);
    } catch (err) {
      setErro(errorMessage(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="card form" onSubmit={salvar} noValidate>
      <h2>Alterar data e horário do recebimento</h2>
      <p className="muted small">Só muda quando a carga será recebida. Peso, volumes e notas não são alterados.</p>
      <Alert>{erro}</Alert>
      <div className="grid-2">
        <label>Nova data
          <input type="date" min={todayISO()} value={data} onChange={(e) => setData(e.target.value)} required />
        </label>
        <label>Horário
          <select value={hora} onChange={(e) => setHora(e.target.value)}>
            {HORARIOS.map((h) => (
              <option key={h} value={h} disabled={lotado(h)}>
                {h}{ocup && ocupados(h) > 0 ? ` — ${ocupados(h)}/${ocup.docas} docas` : ''}{lotado(h) ? ' (lotado)' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>Observação para o fornecedor (opcional)
        <textarea rows="2" maxLength="500" value={obs} onChange={(e) => setObs(e.target.value)} />
      </label>
      <button className="btn btn-primary" disabled={enviando || igual}>
        {enviando ? <Spinner label="Salvando…" /> : 'Salvar novo horário'}
      </button>
    </form>
  );
}

// Admin: baixa no ato da entrega (recebido ou recusado), com data e hora reais. Também corrige ou desfaz a baixa.
function PainelEntrega({ ap, onDone }) {
  const toast = useToast();
  const baixada = ap.status !== 'aprovado';
  const [resultado, setResultado] = useState(ap.status === 'recusado_entrega' ? 'recusado_entrega' : 'recebido');
  const [data, setData] = useState(ap.dataRecebimento || todayISO());
  const [hora, setHora] = useState(ap.horarioRecebimento || horaAgora());
  const [obs, setObs] = useState(ap.observacaoEntrega || '');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(corpo, mensagem) {
    setErro('');
    setEnviando(true);
    try {
      const r = await http.patch(`/agendamentos/${ap.id}/entrega`, corpo);
      toast(mensagem, 'success');
      onDone(r.data);
    } catch (err) {
      setErro(errorMessage(err));
    } finally {
      setEnviando(false);
    }
  }

  function salvar(e) {
    e.preventDefault();
    enviar(
      { resultado, dataRecebimento: data, horarioRecebimento: hora, observacaoEntrega: obs },
      baixada ? 'Dados da entrega corrigidos.' : resultado === 'recebido' ? 'Recebimento registrado. O fornecedor foi avisado por e-mail.' : 'Recusa na entrega registrada. O fornecedor foi avisado por e-mail.'
    );
  }

  function desfazer() {
    if (!window.confirm('Desfazer a baixa e voltar esta carga para "Aprovado"?')) return;
    enviar({ resultado: 'aprovado' }, 'Baixa desfeita. A carga voltou para agendada.');
  }

  const botao = baixada ? 'Salvar correção' : resultado === 'recebido' ? 'Confirmar recebimento' : 'Registrar recusa na entrega';

  return (
    <form className="card form" onSubmit={salvar} noValidate>
      <h2>{baixada ? 'Dados da entrega' : 'Dar baixa na entrega'}</h2>
      <p className="muted small">Informe a data e o horário reais em que a carga chegou ao Centro de Distribuição.</p>
      <Alert>{erro}</Alert>
      <div className="segmented" role="radiogroup" aria-label="Resultado da entrega">
        <button type="button" role="radio" aria-checked={resultado === 'recebido'} className={resultado === 'recebido' ? 'on ok' : ''} onClick={() => setResultado('recebido')}>Recebido</button>
        <button type="button" role="radio" aria-checked={resultado === 'recusado_entrega'} className={resultado === 'recusado_entrega' ? 'on no' : ''} onClick={() => setResultado('recusado_entrega')}>Recusado na entrega</button>
      </div>
      <div className="grid-2">
        <label>Data do recebimento
          <input type="date" max={todayISO()} value={data} onChange={(e) => setData(e.target.value)} required />
        </label>
        <label>Horário do recebimento
          <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} required />
        </label>
      </div>
      <label>{resultado === 'recusado_entrega' ? 'Motivo da recusa na entrega (o fornecedor verá)' : 'Observação (opcional)'}
        <textarea rows="2" maxLength="500" value={obs} onChange={(e) => setObs(e.target.value)} required={resultado === 'recusado_entrega'} />
      </label>
      <div className="form-actions">
        {baixada && <button type="button" className="btn btn-ghost" disabled={enviando} onClick={desfazer}>Desfazer baixa</button>}
        <button className={`btn ${resultado === 'recusado_entrega' ? 'btn-danger' : 'btn-primary'}`} disabled={enviando}>
          {enviando ? <Spinner label="Salvando…" /> : botao}
        </button>
      </div>
    </form>
  );
}
