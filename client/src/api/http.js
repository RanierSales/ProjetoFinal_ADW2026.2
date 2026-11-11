import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || '/api';

// Em produção (API em outro domínio) o socket usa a origem da API; em dev, a mesma origem (proxy).
export const SOCKET_URL = API_URL.startsWith('http') ? new URL(API_URL).origin : undefined;

const http = axios.create({ baseURL: API_URL });

http.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// Sessão expirada: limpa o token e avisa o AuthContext.
http.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && localStorage.getItem('token')) {
      localStorage.removeItem('token');
      window.dispatchEvent(new Event('auth:expired'));
    }
    return Promise.reject(err);
  }
);

// Converte qualquer erro do axios em texto amigável para mostrar na tela.
export function errorMessage(err) {
  const d = err.response?.data;
  if (d?.details?.length) return d.details.join(' • ');
  if (d?.message) return d.message;
  if (err.request) return 'Não foi possível conectar ao servidor. Verifique sua conexão.';
  return 'Ocorreu um erro inesperado.';
}

export default http;
