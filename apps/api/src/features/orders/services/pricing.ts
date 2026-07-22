/**
 * All money math happens in integer minor units (cents). Tax uses banker's-
 * agnostic round-half-up on the integer product, so totals never touch floats.
 */
export const TAX_RATE_BASIS_POINTS = 1000; // 10.00%

export function computeTaxCents(subtotalCents: number): number {
  return Math.round((subtotalCents * TAX_RATE_BASIS_POINTS) / 10_000);
}

export function computeLineTotal(unitPriceCents: number, optionCents: number, quantity: number): number {
  return (unitPriceCents + optionCents) * quantity;
}
