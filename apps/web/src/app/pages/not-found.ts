import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="container" style="padding:96px 24px;text-align:center">
      <div style="font-size:4rem;margin-bottom:16px">🫙</div>
      <h1>Esto no está en el catálogo</h1>
      <p style="color:var(--muted);margin:16px auto 24px;max-width:40ch">La página que buscas no existe o se llevaron el producto del estante.</p>
      <a class="btn btn-primary" routerLink="/tienda">Volver a la tienda</a>
    </div>
  `,
})
export class NotFoundPage {}
