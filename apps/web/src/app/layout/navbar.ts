import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { CartService } from '../services/cart.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <header class="navbar">
      <div class="navbar-inner">
        <a class="navbar-brand" routerLink="/tienda">
          <span class="brand-icon">🧺</span>
          <span>Colmado</span>
        </a>

        <nav class="navbar-links">
          <a class="nav-link" routerLink="/tienda" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Tienda</a>
          <a class="nav-link" routerLink="/pedidos" routerLinkActive="active" [queryParams]="{}">Pedidos</a>
          @if (auth.isAdmin()) {
            <a class="nav-link" routerLink="/admin" routerLinkActive="active">Mostrador</a>
          }
        </nav>

        <div class="navbar-actions">
          <a class="cart-btn" routerLink="/carrito" aria-label="Ver carrito">
            🛒
            @if (cartService.cart()?.itemCount) {
              <span class="cart-count">{{ cartService.cart()?.itemCount }}</span>
            }
          </a>
          <button class="theme-toggle" (click)="toggleTheme()" [attr.aria-label]="isDark() ? 'Modo claro' : 'Modo oscuro'">
            {{ isDark() ? '☀️' : '🌙' }}
          </button>
          @if (auth.user()) {
            <span class="navbar-user">
              <a class="nav-link user-name" routerLink="/pedidos">
                Hola, {{ (auth.user()?.name ?? '').split(' ')[0] }}
              </a>
              <button class="btn btn-ghost" (click)="logout()">Salir</button>
            </span>
          } @else {
            <a class="nav-link" routerLink="/login" routerLinkActive="active">Entrar</a>
          }
        </div>
      </div>
    </header>
  `,
})
export class Navbar implements OnInit {
  readonly auth = inject(AuthService);
  readonly cartService = inject(CartService);
  private readonly router = inject(Router);
  readonly isDark = signal(document.documentElement.getAttribute('data-theme') === 'dark');

  ngOnInit(): void {
    if (this.auth.token()) {
      void this.auth.refresh();
      void this.cartService.refresh().catch(() => undefined);
    }
    // Sin sesión no hay carrito en servidor: no llamar a /api/cart (evita 401 en consola).
  }

  toggleTheme(): void {
    const next = !this.isDark();
    this.isDark.set(next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
    localStorage.setItem('colmado-theme', next ? 'dark' : 'light');
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigate(['/tienda']);
  }
}
