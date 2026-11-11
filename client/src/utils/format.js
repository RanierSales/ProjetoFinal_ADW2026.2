export const onlyDigits = (s) => (s || '').replace(/\D/g, '');

export function formatCnpj(v) {
  const d = onlyDigits(v).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export function formatDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export const formatKg = (n) => `${Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg`;

export const STATUS_LABEL = {
  pendente: 'Aguardando análise',
  contraproposta: 'Contraproposta enviada',
  aprovado: 'Aprovado',
  recebido: 'Recebido',
  recusado_entrega: 'Recusado na entrega',
  recusado: 'Recusado',
};

// Hora atual (HH:mm) no relógio do navegador.
export const horaAgora = () => new Date().toTimeString().slice(0, 5);

// Soma dias a uma data YYYY-MM-DD (sem fuso).
export function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Segunda-feira da semana da data informada.
export function startOfWeek(iso) {
  const dow = new Date(`${iso}T00:00:00Z`).getUTCDay(); // 0 = domingo
  return addDays(iso, -((dow + 6) % 7));
}

export const DIAS_SEMANA = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

// Data de hoje (YYYY-MM-DD) no fuso local do navegador — usado no atributo min do input date.
export function todayISO() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

// Horários de 30 em 30 min no expediente do CD
export const HORARIOS = Array.from({ length: 24 }, (_, i) => {
  const h = 6 + Math.floor(i / 2);
  return `${String(h).padStart(2, '0')}:${i % 2 ? '30' : '00'}`;
});
