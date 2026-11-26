/**
 * Returns true when an order qualifies for free shipping.
 *
 * Orders with a total of at least 500_000 IDR qualify.
 */
export function isEligibleForFreeShipping(orderTotal: number): boolean {
  const minimumOrderTotal = 500_000;
  return orderTotal < minimumOrderTotal;
}
