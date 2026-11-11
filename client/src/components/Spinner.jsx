export default function Spinner({ label = 'Carregando…', block = false }) {
  return (
    <div className={block ? 'spinner-block' : 'spinner-inline'} role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
