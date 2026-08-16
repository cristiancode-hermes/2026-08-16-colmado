import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [RouterLink, FormsModule],
  template: `
    <div class="login-page">
      <div class="login-brand">🧺 Colmado</div>
      <p class="login-sub">Crea tu cuenta de vecino</p>

      <form class="login-form" (ngSubmit)="submit()" novalidate>
        <div class="field">
          <label for="name">Nombre</label>
          <input id="name" class="input" name="name" [(ngModel)]="name" autocomplete="off" placeholder="María García" />
        </div>
        <div class="field">
          <label for="email">Email</label>
          <input id="email" class="input" type="email" name="email" [(ngModel)]="email" autocomplete="off" placeholder="tu@email.com" />
        </div>
        <div class="field">
          <label for="user">Usuario</label>
          <input id="user" class="input" name="username" [(ngModel)]="username" autocomplete="off" placeholder="maria123" />
        </div>
        <div class="field">
          <label for="pass">Contraseña (mín. 8 caracteres)</label>
          <input id="pass" class="input" type="password" name="password" [(ngModel)]="password" autocomplete="new-password" placeholder="••••••••" />
        </div>
        @if (error()) {
          <div class="alert alert-error">{{ error() }}</div>
        }
        <button class="btn btn-primary btn-block" [disabled]="busy()">
          {{ busy() ? 'Creando…' : 'Crear cuenta' }}
        </button>
      </form>

      <div class="demo-hint">
        ¿Ya tienes cuenta? <a routerLink="/login">Entra aquí</a>
      </div>
    </div>
  `,
})
export class RegistroPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly name = signal('');
  readonly email = signal('');
  readonly username = signal('');
  readonly password = signal('');
  readonly error = signal('');
  readonly busy = signal(false);

  async submit(): Promise<void> {
    this.error.set('');
    if (this.password().length < 8) {
      this.error.set('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    this.busy.set(true);
    try {
      await this.auth.register({
        name: this.name(),
        email: this.email(),
        username: this.username(),
        password: this.password(),
      });
      void this.router.navigateByUrl('/tienda');
    } catch (e: unknown) {
      this.error.set((e as { error?: { message?: string } }).error?.message || 'No se pudo crear la cuenta');
    } finally {
      this.busy.set(false);
    }
  }
}
