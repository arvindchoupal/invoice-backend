export interface InvoiceItemInput {
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discountRate: number;
}

export function calculateInvoice(items: InvoiceItemInput[]) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const discountTotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice * (item.discountRate / 100),
    0,
  );
  const taxableAmount = subtotal - discountTotal;
  const taxTotal = items.reduce((sum, item) => {
    const discounted = item.quantity * item.unitPrice * (1 - item.discountRate / 100);
    return sum + discounted * (item.taxRate / 100);
  }, 0);
  const total = taxableAmount + taxTotal;

  return {
    subtotal: roundMoney(subtotal),
    discountTotal: roundMoney(discountTotal),
    taxTotal: roundMoney(taxTotal),
    total: roundMoney(total),
  };
}

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function makeInvoiceNumber(prefix: string, nextValue: number) {
  return `${prefix}-${String(nextValue).padStart(5, "0")}`;
}
