import axios from 'axios';
import type { ApiResponse, Work, WorkInput, Episode, Illustration, IllustrationInput, EpisodeInput } from '@tokyo86/shared';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://tokyo86-api.belong2jazz.workers.dev';

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

export const worksApi = {
  list: (type?: string) =>
    client.get<ApiResponse<Work[]>>('/api/works', { params: { type } }),
  get: (id: string) =>
    client.get<ApiResponse<Work>>(`/api/works/${id}`),
  create: (data: WorkInput) =>
    client.post<ApiResponse<Work>>('/api/works', data),
  update: (id: string, data: Partial<WorkInput>) =>
    client.put<ApiResponse<Work>>(`/api/works/${id}`, data),
  delete: (id: string) =>
    client.delete<ApiResponse<void>>(`/api/works/${id}`),
};

export const illustrationsApi = {
  list: () =>
    client.get<ApiResponse<Illustration[]>>('/api/illustrations'),
  get: (id: string) =>
    client.get<ApiResponse<Illustration>>(`/api/illustrations/${id}`),
  create: (data: IllustrationInput) =>
    client.post<ApiResponse<Illustration>>('/api/illustrations', data),
  update: (id: string, data: Partial<IllustrationInput>) =>
    client.put<ApiResponse<Illustration>>(`/api/illustrations/${id}`, data),
  delete: (id: string) =>
    client.delete<ApiResponse<void>>(`/api/illustrations/${id}`),
};

export const episodesApi = {
  list: (workId?: string) =>
    client.get<ApiResponse<Episode[]>>('/api/episodes', { params: { workId } }),
  get: (id: string) =>
    client.get<ApiResponse<Episode>>(`/api/episodes/${id}`),
  create: (data: EpisodeInput) =>
    client.post<ApiResponse<Episode>>('/api/episodes', data),
  update: (id: string, data: Partial<EpisodeInput>) =>
    client.put<ApiResponse<Episode>>(`/api/episodes/${id}`, data),
  delete: (id: string) =>
    client.delete<ApiResponse<void>>(`/api/episodes/${id}`),
};

export const imageApi = {
  upload: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return client.post<ApiResponse<{ id: string; filename: string; variants: string[] }>>('/api/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  list: () =>
    client.get<ApiResponse<any[]>>('/api/images'),
  delete: (id: string) =>
    client.delete<ApiResponse<void>>(`/api/images/${id}`),
  bulkDelete: (ids: string[]) =>
    client.post<ApiResponse<void>>('/api/images/bulk-delete', { ids }),
};

export const batchesApi = {
  list: () =>
    client.get<ApiResponse<any[]>>('/api/batches'),
  get: (batchId: string) =>
    client.get<ApiResponse<any>>(`/api/batches/${batchId}`),
  create: (data: { name?: string; description?: string; episode_id?: string; purpose?: 'cdn' | 'toon' }) =>
    client.post<ApiResponse<any>>('/api/batches', data),
  update: (batchId: string, data: { name?: string; description?: string; purpose?: 'cdn' | 'toon' }) =>
    client.put<ApiResponse<any>>(`/api/batches/${batchId}`, data),
  upload: (batchId: string, files: File[]) => {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    return client.post<ApiResponse<any>>(`/api/batches/${batchId}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  getMarkdown: (batchId: string) =>
    client.get<ApiResponse<{ markdown: string }>>(`/api/batches/${batchId}/markdown`),
  finalize: (batchId: string) =>
    client.post<ApiResponse<any>>(`/api/batches/${batchId}/finalize`, {}),
  delete: (batchId: string) =>
    client.delete<ApiResponse<void>>(`/api/batches/${batchId}`),
};

export default client;
