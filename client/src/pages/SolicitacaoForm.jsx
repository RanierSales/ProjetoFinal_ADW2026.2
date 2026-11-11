import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import http, { errorMessage } from '../api/http';
import { useToast } from '../context/ToastContext';
import { todayISO } from '../utils/format';
import Alert from '../components/Alert';
import Spinner from '../components/Spinner';

const MAX_ARQUIVOS = 5;

// Serve para criar (/portal/nova) e editar (/portal/:id/editar) uma solicitação pendente.
export default function SolicitacaoForm() {
  const { id } = useParams();
  const editando = !!id;
  const navigate = useNavigate();
  const toast = useToast();

  const [form, setForm] = useState({ pesoKg: '', volumes: '', dataSugerida: '', observacao: '' });
  const [notas, setNotas] = useState([]);
  const [notaTexto, setNotaTexto] = useState('');
  const [arquivos, setArquivos] = useState([]); // novos
  const [existentes, setExistentes] = useState([]); // já salvos (edição)
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(editando);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!editando) return;
    http
      .get(`/agendamentos/${id}`)
      .then(({ data }) => {
        if (data.status !== 'pendente') return navigate(`/solicitacoes/${id}`, { replace: true });
        setForm({ pesoKg: data.pesoKg, volumes: data.volumes, dataSugerida: data.dataSugerida, observacao: data.observacao || '' });
        setNotas(data.notas);
        setExistentes(data.arquivos);
      })
      .catch((err) => setErro(errorMessage(err)))
      .finally(() => setCarregando(false));
  }, [id, editando, navigate]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  function addNotas() {
    // aceita várias de uma vez (separadas por vírgula, espaço ou linha)
    const novas = notaTexto.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
    if (!novas.length) return;
    setNotas((atual) => [...new Set([...atual, ...novas])]);
    setNotaTexto('');
  }

  function onNotaKey(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addNotas();
    }
  }

  function onFiles(e) {
    const escolhidos = Array.from(e.target.files);
    e.target.value = '';
    const invalido = escolhidos.find((f) => !/\.(pdf|xml)$/i.test(f.name) || f.size > 5 * 1024 * 1024);
    if (invalido) return setErro(`"${invalido.name}" não é PDF/XML ou passa de 5 MB.`);
    if (existentes.length + arquivos.length + escolhidos.length > MAX_ARQUIVOS) return setErro(`Máximo de ${MAX_ARQUIVOS} arquivos.`);
    setErro('');
    setArquivos((a) => [...a, ...escolhidos]);
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErro('');
    const pendente = notaTexto.trim() ? notaTexto.split(/[\s,;]+/).filter(Boolean) : [];
    const todasNotas = [...new Set([...notas, ...pendente])];
    if (!todasNotas.length) return setErro('Informe o número de pelo menos uma nota fiscal.');

    const fd = new FormData();
    fd.append('pesoKg', form.pesoKg);
    fd.append('volumes', form.volumes);
    fd.append('dataSugerida', form.dataSugerida);
    fd.append('observacao', form.observacao);
    fd.append('notas', JSON.stringify(todasNotas));
    arquivos.forEach((f) => fd.append('arquivos', f));

    setEnviando(true);
    try {
      if (editando) await http.put(`/agendamentos/${id}`, fd);
      else await http.post('/agendamentos', fd);
      toast(editando ? 'Solicitação atualizada.' : 'Solicitação enviada! O Centro de Distribuição foi avisado por e-mail.', 'success');
      navigate('/portal');
    } catch (err) {
      setErro(errorMessage(err));
    } finally {
      setEnviando(false);
    }
  }

  if (carregando) return <Spinner block />;

  return (
    <>
      <header className="page-head"><h1>{editando ? 'Editar solicitação' : 'Nova solicitação de agendamento'}</h1></header>
      <form className="form card form-wide" onSubmit={onSubmit} noValidate>
        <Alert>{erro}</Alert>

        <div className="grid-3">
          <label>Peso total da carga (kg)
            <input type="number" min="0.01" step="0.01" inputMode="decimal" value={form.pesoKg} onChange={set('pesoKg')} required />
          </label>
          <label>Quantidade de volumes
            <input type="number" min="1" step="1" inputMode="numeric" value={form.volumes} onChange={set('volumes')} required />
          </label>
          <label>Data sugerida
            <input type="date" min={todayISO()} value={form.dataSugerida} onChange={set('dataSugerida')} required />
          </label>
        </div>

        <div className="field">
          <label htmlFor="nota">Números das notas fiscais</label>
          <div className="inline-add">
            <input id="nota" value={notaTexto} onChange={(e) => setNotaTexto(e.target.value)} onKeyDown={onNotaKey} placeholder="Digite o número e tecle Enter (aceita vários separados por vírgula)" />
            <button type="button" className="btn btn-ghost" onClick={addNotas}>Adicionar</button>
          </div>
          <p className="muted small">{notas.length} nota(s) informada(s)</p>
          {notas.length > 0 && (
            <ul className="chips">
              {notas.map((n) => (
                <li key={n}>{n}<button type="button" aria-label={`Remover nota ${n}`} onClick={() => setNotas(notas.filter((x) => x !== n))}>✕</button></li>
              ))}
            </ul>
          )}
        </div>

        <div className="field">
          <label htmlFor="arq">XML ou PDF das notas (opcional)</label>
          <input id="arq" type="file" accept=".pdf,.xml,application/pdf,text/xml,application/xml" multiple onChange={onFiles} />
          <p className="muted small">Até {MAX_ARQUIVOS} arquivos de 5 MB cada.</p>
          {(existentes.length > 0 || arquivos.length > 0) && (
            <ul className="chips">
              {existentes.map((a) => <li key={a.arquivo}>{a.nomeOriginal} <em>(enviado)</em></li>)}
              {arquivos.map((f, i) => (
                <li key={f.name + i}>{f.name}<button type="button" aria-label={`Remover ${f.name}`} onClick={() => setArquivos(arquivos.filter((_, j) => j !== i))}>✕</button></li>
              ))}
            </ul>
          )}
        </div>

        <label>Observações para o recebimento (opcional)
          <textarea rows="3" maxLength="500" value={form.observacao} onChange={set('observacao')} />
        </label>

        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/portal')}>Voltar</button>
          <button className="btn btn-primary" disabled={enviando}>
            {enviando ? <Spinner label="Enviando…" /> : editando ? 'Salvar alterações' : 'Enviar solicitação'}
          </button>
        </div>
      </form>
    </>
  );
}
