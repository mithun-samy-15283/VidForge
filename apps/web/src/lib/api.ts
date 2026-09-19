import axios from 'axios';

export const api = axios.create({
  baseURL: '',   // Use same origin — Next.js rewrites /api/* to the Express backend
  timeout: 30000
});
