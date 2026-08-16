import { Injectable, inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const adminGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.token()) return router.createUrlTree(['/tienda']);
  await auth.ready; // restaura la sesión antes de decidir (evita rechazar tokens válidos en recarga)
  if (auth.isAdmin()) return true;
  return router.createUrlTree(['/tienda']);
};
