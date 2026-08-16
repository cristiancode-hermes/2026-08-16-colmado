import { Component } from '@angular/core';

@Component({
  selector: 'app-footer',
  standalone: true,
  template: `
    <footer class="footer">
      <div class="footer-inner">
        <div>
          <h4>🧺 Colmado</h4>
          <p>La tienda de barrio de toda la vida, ahora online. Producto fresco, trato cercano y reparto a tu puerta en menos de 15 minutos.</p>
        </div>
        <div>
          <h4>Horario</h4>
          <ul>
            <li>Lun – Sáb: 8:00 – 21:30</li>
            <li>Domingo: 9:00 – 14:00</li>
          </ul>
        </div>
        <div>
          <h4>Contacto</h4>
          <ul>
            <li>Calle del Sol 12, Madrid</li>
            <li>hola@colmado.dev</li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">Colmado — demo del Daily Builder · 2026</div>
    </footer>
  `,
})
export class Footer {}
