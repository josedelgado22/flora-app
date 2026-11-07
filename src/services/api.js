import axios from 'axios';
import { API_BASE_URL } from './config';

// Instancia central de axios. Todos los servicios (auth, plants, etc.)
// usan esto para hacer las peticiones al backend.
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 8000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Acá después se puede agregar un interceptor para mandar el token
// de autenticación en cada request, algo así:
//
// api.interceptors.request.use((config) => {
//   const token = obtenerTokenGuardado();
//   if (token) config.headers.Authorization = `Bearer ${token}`;
//   return config;
// });

export default api;
