import { useAuthStore } from '@/stores/auth.store';

const API_URL = import.meta.env.VITE_API_URL || '/api';

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

  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    const data = await response.json();

    if (!response.ok) {
      // Si es 401, logout automático
      if (response.status === 401) {
        useAuthStore.getState().logout();
      }
      throw new Error(data.message || 'Error en la solicitud');
    }

    return data;
  }

  async get<T>(endpoint: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          url.searchParams.append(key, value);
        }
      });
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: this.getHeaders(),
    });

    return this.handleResponse<T>(response);
  }

  async post<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });

    return this.handleResponse<T>(response);
  }

  async put<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });

    return this.handleResponse<T>(response);
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    return this.handleResponse<T>(response);
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
