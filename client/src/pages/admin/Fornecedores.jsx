import { useCallback, useEffect, useState } from 'react';
import http, { errorMessage } from '../../api/http';
import { useToast } from '../../context/ToastContext';
import { formatCnpj } from '../../utils/format';
import Alert from '../../components/Alert';
import Modal from '../../components/Modal';
import Pagination from '../../components/Pagination';
import Spinner from '../../components/Spinner';

const VAZIO = { razaoSocial: '', cnpj: '', email: '', telefone: '' };

// CRUD de fornecedores (somente admin): o fornecedor só consegue criar acesso se estiver aqui.
export default function Fornecedores() {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [busca, setBusca] = useState('');
  const [page, setPage] = useState(1);
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [modal, setModal] = useState(null); // null | {id?, ...campos}

  const carregar = useCallback(async () => {
    setErro('');
    try {
      const { data } = await http.get('/fornecedores', { params: { q: busca || undefined, page } });
      setRes(data);
    } catch (e) {
      setErro(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [busca, page]);

  useEffect(() => { setLoading(true); carregar(); }, [carregar]);

  async function alternarAtivo(f) {
    try {
      await http.put(`/fornecedores/${f.id}`, { ativo: !f.ativo });
      toast(f.ativo ? 'Fornecedor desativado. O acesso ao portal foi bloqueado.' : 'Fornecedor reativado.', 'success');
      carregar();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  }

  async function excluir(f) {
    if (!window.confirm(`Excluir ${f.razaoSocial}? Esta ação não pode ser desfeita.`)) return;
    try {
      await http.delete(`/fornecedores/${f.id}`);
      toast('Fornecedor excluído.', 'success');
      carregar();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  }

  return (
    <>
      <header className="page-head">
        <h1>Fornecedores</h1>
        <button className="btn btn-primary" onClick={() => setModal({ ...VAZIO })}>Cadastrar fornecedor</button>
      </header>

      <form className="toolbar" onSubmit={(e) => { e.preventDefault(); setPage(1); setBusca(q); }}>
        <input className="search" placeholder="Buscar por razão social ou CNPJ" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn btn-ghost">Buscar</button>
      </form>

      <Alert>{erro}</Alert>
      {loading ? <Spinner block /> : !res?.data.length ? (
        <div className="empty"><p>Nenhum fornecedor encontrado.</p></div>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Razão social</th><th>CNPJ</th><th>E-mail</th><th>Telefone</th><th>Situação</th><th /></tr></thead>
              <tbody>
                {res.data.map((f) => (
                  <tr key={f.id}>
                    <td>{f.razaoSocial}</td>
                    <td>{formatCnpj(f.cnpj)}</td>
                    <td>{f.email}</td>
                    <td>{f.telefone || '—'}</td>
                    <td><span className={`badge ${f.ativo ? 'badge-aprovado' : 'badge-recusado'}`}>{f.ativo ? 'Ativo' : 'Inativo'}</span></td>
                    <td className="row-actions">
                      <button className="btn btn-ghost" onClick={() => setModal({ ...f })}>Editar</button>
                      <button className="btn btn-ghost" onClick={() => alternarAtivo(f)}>{f.ativo ? 'Desativar' : 'Reativar'}</button>
                      <button className="btn btn-ghost danger" onClick={() => excluir(f)}>Excluir</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={res.page} pages={res.pages} onChange={setPage} />
        </>
      )}

      {modal && <FormFornecedor inicial={modal} onClose={() => setModal(null)} onSaved={() => { setModal(null); carregar(); }} />}
    </>
  );
}

function FormFornecedor({ inicial, onClose, onSaved }) {
  const toast = useToast();
  const editando = !!inicial.id;
  const [f, setF] = useState({ razaoSocial: inicial.razaoSocial, cnpj: formatCnpj(inicial.cnpj), email: inicial.email, telefone: inicial.telefone || '' });
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function onSubmit(e) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      if (editando) await http.put(`/fornecedores/${inicial.id}`, f);
      else await http.post('/fornecedores', f);
      toast(editando ? 'Fornecedor atualizado.' : 'Fornecedor cadastrado. Ele já pode criar o acesso em "Primeiro acesso".', 'success');
      onSaved();
    } catch (err) {
      setErro(errorMessage(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal title={editando ? 'Editar fornecedor' : 'Cadastrar fornecedor'} onClose={onClose}>
      <form className="form" onSubmit={onSubmit} noValidate>
        <Alert>{erro}</Alert>
        <label>Razão social<input value={f.razaoSocial} onChange={set('razaoSocial')} required /></label>
        <label>CNPJ<input value={f.cnpj} onChange={(e) => setF({ ...f, cnpj: formatCnpj(e.target.value) })} inputMode="numeric" placeholder="00.000.000/0000-00" required /></label>
        <label>E-mail (será usado no primeiro acesso e nos avisos)<input type="email" value={f.email} onChange={set('email')} required /></label>
        <label>Telefone (opcional)<input value={f.telefone} onChange={set('telefone')} /></label>
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={enviando}>{enviando ? <Spinner label="Salvando…" /> : 'Salvar'}</button>
        </div>
      </form>
    </Modal>
  );
}
