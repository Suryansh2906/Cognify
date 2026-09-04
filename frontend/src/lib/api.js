import axios from 'axios';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND}/api`;

const api = axios.create({
  baseURL: API,
  withCredentials: true, // keep this too — harmless, and helps if cookies DO work
});

// Attach the session token as a header on every request, so auth doesn't
// depend on the browser accepting a cross-origin cookie (which Incognito /
// third-party-cookie-blocking browsers will silently refuse).
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('session_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// If a request comes back unauthorized, the stored token is stale — clear it
// so the UI doesn't keep sending a dead token.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('session_token');
    }
    return Promise.reject(err);
  }
);

export default api;
