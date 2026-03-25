/**
 * API Client for RedRoomDigital
 *
 * This file handles all communication with our backend API.
 * Think of it as the "messenger" between the website and the server.
 *
 * HOW IT WORKS:
 * 1. We set a base URL pointing to our API server (localhost:4000 in dev)
 * 2. Every request automatically includes the JWT token if the user is logged in
 * 3. If the token expires, we redirect to login
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
}

class ApiClient {
  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('rrd_token');
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const token = this.getToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    // If unauthorized, clear token and redirect
    if (response.status === 401) {
      localStorage.removeItem('rrd_token');
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    try {
      const data = await response.json();
      return data;
    } catch {
      return { success: false, message: `Server error (${response.status})` };
    }
  }

  // Convenience methods
  get<T>(endpoint: string) {
    return this.request<T>(endpoint);
  }

  post<T>(endpoint: string, body: unknown) {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  put<T>(endpoint: string, body: unknown) {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  delete<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  /**
   * Upload a file to the API.
   * Uses FormData instead of JSON — the browser auto-sets the
   * Content-Type to multipart/form-data with the correct boundary.
   */
  async upload<T>(endpoint: string, file: File, fieldName: string = 'image'): Promise<ApiResponse<T>> {
    const token = this.getToken();
    const formData = new FormData();
    formData.append(fieldName, file);

    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    // Do NOT set Content-Type — browser will auto-set multipart/form-data with boundary

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await response.json();

      if (response.status === 401) {
        localStorage.removeItem('rrd_token');
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }

      return data;
    } catch {
      return { success: false, message: 'Upload failed. Please try again.' };
    }
  }
}

export const api = new ApiClient();
