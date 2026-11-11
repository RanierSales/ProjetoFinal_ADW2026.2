import { useEffect } from 'react';

// As páginas de lista chamam isto para recarregar quando chega um evento em tempo real.
export default function useRealtimeRefresh(callback) {
  useEffect(() => {
    window.addEventListener('agendamentos:changed', callback);
    return () => window.removeEventListener('agendamentos:changed', callback);
  }, [callback]);
}
