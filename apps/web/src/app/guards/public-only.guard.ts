import { Injectable, inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const publicOnlyGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.token()) return true;
  await auth.ready; // restaura la sesión antes de decidir
  return router.createUrlTree(['/tienda']);
};
