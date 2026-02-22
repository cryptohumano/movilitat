import { useAuthStore } from '@/stores/auth.store';

// Si la app se sirve en :3000 y no hay proxy, el backend suele estar en :3001
const defaultApiUrl =
  typeof window !== 'undefined' && window.location.port === '3000'
    ? 'http://localhost:3001/api'
    : '/api';
const API_URL = import.meta.env.VITE_API_URL || defaultApiUrl;

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Array<{ message: string; path?: string[] }>;
  pagination?: {
    total: number;
    limit: number;
    offset: number;
  };
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    const token = useAuthStore.getState().token;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  private async handleResponse<T>(response: Response, requestUrl: string): Promise<ApiResponse<T>> {
    let data: ApiResponse<T>;
    try {
      const text = await response.text();
      data = text ? (JSON.parse(text) as ApiResponse<T>) : { success: false, message: 'Respuesta vacía del servidor' };
    } catch {
      data = { success: false, message: 'El servidor no respondió con JSON válido' };
    }

    if (!response.ok) {
      if (response.status === 401) {
        const isLoginRequest = requestUrl.includes('/auth/login');
        if (!isLoginRequest) {
          useAuthStore.getState().logout();
        }
      }
      throw new Error(data.message || 'Error en la solicitud');
    }

    return data;
  }

  private buildUrl(endpoint: string, params?: Record<string, string>): string {
    const path = `${this.baseUrl.replace(/\/$/, '')}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const url = this.baseUrl.startsWith('http')
      ? new URL(path)
      : new URL(path, window.location.origin);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          url.searchParams.append(key, value);
        }
      });
    }
    return url.toString();
  }

  private fetchOptions(method: string, body?: string): RequestInit {
    const opts: RequestInit = {
      method,
      headers: this.getHeaders(),
      credentials: this.baseUrl.startsWith('http') ? 'include' : 'same-origin',
    };
    if (body) opts.body = body;
    return opts;
  }

  async get<T>(endpoint: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
    const url = this.buildUrl(endpoint, params);
    const response = await fetch(url, this.fetchOptions('GET'));

    return this.handleResponse<T>(response, url);
  }

  async post<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    const url = this.buildUrl(endpoint);
    const response = await fetch(url, this.fetchOptions('POST', body ? JSON.stringify(body) : undefined));

    return this.handleResponse<T>(response, url);
  }

  async put<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    const url = this.buildUrl(endpoint);
    const response = await fetch(url, this.fetchOptions('PUT', body ? JSON.stringify(body) : undefined));

    return this.handleResponse<T>(response, url);
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    const url = this.buildUrl(endpoint);
    const response = await fetch(url, this.fetchOptions('DELETE'));

    return this.handleResponse<T>(response, url);
  }
}

export const api = new ApiClient(API_URL);

// Tipos de respuesta comunes
export interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string | null;
    telefono: string;
    nombre: string;
    apellido?: string;
    role: string;
    empresa?: {
      id: string;
      nombre: string;
      nombreCorto: string;
    };
    choferId?: string;
    checadorId?: string;
  };
}

export interface DashboardData {
  tipo: string;
  resumen?: Record<string, number>;
  actividad?: Record<string, number>;
  empresa?: Record<string, unknown>;
  checador?: Record<string, unknown>;
  chofer?: Record<string, unknown>;
  ultimosCheckIns?: Array<{
    id: string;
    fechaHora: string;
    vehiculo: { placa: string; tipo: string };
    puntoControl?: { nombre: string };
    tiempoTranscurrido?: number;
    estado: string;
    monto: number;
  }>;
}

/** Parada cercana (API /paradas-cercanas) */
export interface ParadaCercanaItem {
  id: string;
  nombre: string;
  latitud: number;
  longitud: number;
  distanciaKm?: number;
  derrotero?: { numero: number; nombre: string; empresa?: { nombreCorto?: string; codigo?: string } };
}
