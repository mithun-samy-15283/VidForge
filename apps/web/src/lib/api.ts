import axios from 'axios';

const FUNCTION_BASE_URL = (
  process.env.NEXT_PUBLIC_FUNCTION_BASE_URL || '/server/vidforge_api'
).replace(/\/+$/, '');

export const api = axios.create({
  baseURL: FUNCTION_BASE_URL,
  timeout: 30000
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = window.localStorage.getItem('vidforge.auth.token');
    if (token) {
      config.headers['X-VidForge-Token'] = token;
    }
  }
  return config;
});

export async function downloadJobFile(jobId: string) {
  const response = await api.get<Blob>(`/api/jobs/${jobId}/file`, {
    responseType: 'blob'
  });
  const disposition = response.headers['content-disposition'] || '';
  const filename = disposition.match(/filename="([^"]+)"/)?.[1] || 'vidforge-mock-result.svg';
  const objectUrl = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(objectUrl);
}
