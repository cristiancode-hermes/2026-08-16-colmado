import { Injectable, signal, computed } from '@angular/core';
import { ApiService } from './api.service';
import { AuthUser } from '../models';

export const DEMO_CREDENTIALS = { email: 'demo@colmado.dev', password: 'colmado2026' };

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly user = signal<AuthUser | null>(null);
  readonly isAdmin = computed(() => this.user()?.role === 'admin');
  readonly token = signal<string | null>(localStorage.getItem('colmado_token'));

  private resolveReady!: () => void;
  /** Resuelve cuando termina el primer intento de restaurar la sesión (token válido → /auth/me; sin token o usuario cacheado → inmediato). */
  readonly ready: Promise<void> = new Promise((r) => (this.resolveReady = r));

  constructor(private readonly api: ApiService) {
    const cached = localStorage.getItem('colmado_user');
    if (cached) {
      try {
        this.user.set(JSON.parse(cached));
      } catch {
        localStorage.removeItem('colmado_user');
      }
    }
    if (this.token() && !this.user()) {
      // token sin usuario cacheado: restaurar antes de que los guards decidan
      void this.refresh().finally(() => this.resolveReady());
    } else {
      this.resolveReady();
    }
  }

  async login(identifier: string, password: string): Promise<AuthUser> {
    const res = await this.api.post<{ token: string; user: AuthUser }>('/auth/login', {
      identifier,
      password,
    });
    this.persist(res);
    return res.user;
  }

  async register(dto: { name: string; email: string; username: string; password: string }): Promise<AuthUser> {
    const res = await this.api.post<{ token: string; user: AuthUser }>('/auth/register', dto);
    this.persist(res);
    return res.user;
  }

  async refresh(): Promise<void> {
    if (!this.token()) return;
    try {
      const user = await this.api.get<AuthUser>('/auth/me');
      this.user.set(user);
      localStorage.setItem('colmado_user', JSON.stringify(user));
    } catch {
      this.logout();
    }
  }

  logout(): void {
    this.user.set(null);
    this.token.set(null);
    localStorage.removeItem('colmado_token');
    localStorage.removeItem('colmado_user');
  }

  private persist(res: { token: string; user: AuthUser }): void {
    this.token.set(res.token);
    this.user.set(res.user);
    localStorage.setItem('colmado_token', res.token);
    localStorage.setItem('colmado_user', JSON.stringify(res.user));
  }
}
