import { Injectable, inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.token()) {
    void auth.refresh();
    if (auth.isAdmin()) return true;
  }
  return router.createUrlTree(['/tienda']);
};
