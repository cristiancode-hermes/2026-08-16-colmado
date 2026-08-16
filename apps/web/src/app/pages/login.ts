import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService, DEMO_CREDENTIALS } from '../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterLink, FormsModule],
  template: `
    <div class="login-page">
      <div class="login-brand">🧺 Colmado</div>
      <p class="login-sub">Bienvenido de vuelta al barrio</p>

      <form class="login-form" (ngSubmit)="submit()" novalidate>
        <div class="field">
          <label for="id">Email o usuario</label>
          <input id="id" class="input" name="identifier" [(ngModel)]="identifier" autocomplete="off" placeholder="demo@colmado.dev" />
        </div>
        <div class="field">
          <label for="pass">Contraseña</label>
          <input id="pass" class="input" type="password" name="password" [(ngModel)]="password" autocomplete="new-password" placeholder="••••••••" />
        </div>
        @if (error()) {
          <div class="alert alert-error">{{ error() }}</div>
        }
        <button class="btn btn-primary btn-block" [disabled]="busy()">
          {{ busy() ? 'Entrando…' : 'Entrar' }}
        </button>
      </form>

      <div class="demo-hint">
        <strong>Cuenta demo:</strong> <code>{{ demo.email }}</code> / <code>{{ demo.password }}</code><br />
        <span style="font-size:0.75rem">También puedes <a routerLink="/registro">crear tu cuenta</a> en un minuto.</span>
      </div>
    </div>
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly demo = DEMO_CREDENTIALS;
  readonly identifier = signal('');
  readonly password = signal('');
  readonly error = signal('');
  readonly busy = signal(false);

  async submit(): Promise<void> {
    this.error.set('');
    this.busy.set(true);
    try {
      await this.auth.login(this.identifier(), this.password());
      const next = new URLSearchParams(window.location.search).get('next');
      void this.router.navigateByUrl(next || '/tienda');
    } catch {
      this.error.set('Credenciales inválidas. Prueba con la cuenta demo.');
    } finally {
      this.busy.set(false);
    }
  }
}
