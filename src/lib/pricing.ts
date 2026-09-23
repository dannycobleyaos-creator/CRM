import { VAT_RATE, type BillingType } from './constants';
import { roundMoney } from './utils';

/**
 * How a parts order is priced. One function, used by the order form while the
 * agent types, by the server when the order is saved, and by the seed — so the
 * total a customer is quoted is always the total they are invoiced.
 *
 * Lines are priced ex VAT at list price whatever the billing, so every order
 * records what the parts were worth. Warranty and goodwill orders then take the
 * whole subtotal off as a discount: the confirmation shows the customer what
 * they would have paid, and management can see what warranty is costing.
 */
export type PricedLine = { qty: number; unitPrice: number };

export type OrderTotals = {
  listValue: number;
  subtotal: number;
  discount: number;
  deliveryCharge: number;
  vatRate: number;
  vat: number;
  total: number;
};

export function priceOrder({
  lines,
  billing,
  deliveryCharge = 0,
  discount = 0,
  vatRate = VAT_RATE,
}: {
  lines: PricedLine[];
  billing: BillingType;
  deliveryCharge?: number;
  discount?: number;
  vatRate?: number;
}): OrderTotals {
  const listValue = roundMoney(
    lines.reduce((sum, l) => sum + Math.max(0, l.qty) * Math.max(0, l.unitPrice), 0),
  );
  const chargeable = billing === 'CHARGEABLE';

  const subtotal = listValue;
  const appliedDiscount = chargeable
    ? roundMoney(Math.min(Math.max(0, discount || 0), subtotal))
    : subtotal;
  const delivery = chargeable ? roundMoney(Math.max(0, deliveryCharge || 0)) : 0;

  const net = roundMoney(subtotal - appliedDiscount + delivery);
  const vat = roundMoney(net * vatRate);

  return {
    listValue,
    subtotal,
    discount: appliedDiscount,
    deliveryCharge: delivery,
    vatRate,
    vat,
    total: roundMoney(net + vat),
  };
}

/** Line total for display and for the stored snapshot. */
export const lineTotal = (line: PricedLine) => roundMoney(line.qty * line.unitPrice);
