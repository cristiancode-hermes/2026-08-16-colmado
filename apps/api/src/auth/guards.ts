import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

@Injectable()
export class AdminGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext) {
    // PRIMERO ejecutar passport (popula req.user), luego comprobar el rol
    const ok = await super.canActivate(context);
    if (!ok) return false;
    const req = context.switchToHttp().getRequest();
    return !!(req.user && req.user.role === 'admin');
  }
}
