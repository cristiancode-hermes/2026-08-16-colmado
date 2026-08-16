import { ORDER_FLOW, ORDER_STATUS_LABELS, ORDER_TRANSITIONS, OrderStatus } from '../entities/entities';

describe('Máquina de estados del pedido (reglas CineNova/Colmado)', () => {
  const STATUSES: OrderStatus[] = ['pending', 'paid', 'preparing', 'shipped', 'delivered', 'cancelled'];

  it('cada estado tiene etiqueta ES derivada', () => {
    for (const s of STATUSES) {
      expect(ORDER_STATUS_LABELS[s]).toBeTruthy();
    }
    expect(ORDER_STATUS_LABELS.pending).toBe('Reservado');
    expect(ORDER_STATUS_LABELS.paid).toBe('Pagado');
  });

  it('pending solo transiciona a paid o cancelled', () => {
    expect(ORDER_TRANSITIONS.pending).toEqual(['paid', 'cancelled']);
    expect(ORDER_TRANSITIONS.pending).not.toContain('preparing');
    expect(ORDER_TRANSITIONS.pending).not.toContain('delivered');
  });

  it('paid solo transiciona a preparing o cancelled', () => {
    expect(ORDER_TRANSITIONS.paid).toEqual(['preparing', 'cancelled']);
    expect(ORDER_TRANSITIONS.paid).not.toContain('delivered');
  });

  it('preparing → shipped y shipped → delivered (sin saltos)', () => {
    expect(ORDER_TRANSITIONS.preparing).toEqual(['shipped']);
    expect(ORDER_TRANSITIONS.shipped).toEqual(['delivered']);
    expect(ORDER_TRANSITIONS.preparing).not.toContain('delivered');
  });

  it('delivered y cancelled son estados finales', () => {
    expect(ORDER_TRANSITIONS.delivered).toEqual([]);
    expect(ORDER_TRANSITIONS.cancelled).toEqual([]);
  });

  it('todos los destinos de transición tienen etiqueta', () => {
    for (const from of STATUSES) {
      for (const to of ORDER_TRANSITIONS[from]) {
        expect(ORDER_STATUS_LABELS[to]).toBeTruthy();
      }
    }
  });

  it('ORDER_FLOW cubre la cadena feliz completa', () => {
    expect(ORDER_FLOW).toEqual(['pending', 'paid', 'preparing', 'shipped', 'delivered']);
  });

  it('ningún estado se transiciona a sí mismo', () => {
    for (const from of STATUSES) {
      expect(ORDER_TRANSITIONS[from]).not.toContain(from);
    }
  });
});
