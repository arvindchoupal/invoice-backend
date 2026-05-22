"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateInvoice = calculateInvoice;
exports.roundMoney = roundMoney;
exports.makeInvoiceNumber = makeInvoiceNumber;
function calculateInvoice(items) {
    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const discountTotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice * (item.discountRate / 100), 0);
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
function roundMoney(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}
function makeInvoiceNumber(prefix, nextValue) {
    return `${prefix}-${String(nextValue).padStart(5, "0")}`;
}
