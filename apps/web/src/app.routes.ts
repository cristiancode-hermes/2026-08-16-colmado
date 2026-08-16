import { Routes } from '@angular/router';
import { authGuard } from './app/guards/auth.guard';
import { adminGuard } from './app/guards/admin.guard';
import { publicOnlyGuard } from './app/guards/public-only.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'tienda' },
  {
    path: 'tienda',
    loadComponent: () => import('./app/pages/tienda').then((m) => m.TiendaPage),
  },
  {
    path: 'producto/:id',
    loadComponent: () => import('./app/pages/producto-detalle').then((m) => m.ProductoDetallePage),
  },
  {
    path: 'carrito',
    loadComponent: () => import('./app/pages/carrito').then((m) => m.CarritoPage),
  },
  {
    path: 'checkout',
    canActivate: [authGuard],
    loadComponent: () => import('./app/pages/checkout').then((m) => m.CheckoutPage),
  },
  {
    path: 'pedidos',
    canActivate: [authGuard],
    loadComponent: () => import('./app/pages/pedidos').then((m) => m.PedidosPage),
  },
  {
    path: 'pedidos/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./app/pages/pedido-detalle').then((m) => m.PedidoDetallePage),
  },
  {
    path: 'favoritos',
    canActivate: [authGuard],
    loadComponent: () => import('./app/pages/favoritos').then((m) => m.FavoritosPage),
  },
  {
    path: 'login',
    canActivate: [publicOnlyGuard],
    loadComponent: () => import('./app/pages/login').then((m) => m.LoginPage),
  },
  {
    path: 'registro',
    canActivate: [publicOnlyGuard],
    loadComponent: () => import('./app/pages/registro').then((m) => m.RegistroPage),
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () => import('./app/pages/admin').then((m) => m.AdminPage),
  },
  {
    path: '**',
    loadComponent: () => import('./app/pages/not-found').then((m) => m.NotFoundPage),
  },
];
