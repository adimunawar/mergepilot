/**
 * Applies a percentage discount to an item's original price.
 *
 * @param price Original price in the smallest currency unit.
 * @param discountPercent Discount percentage, from 0 to 100.
 * @returns The final price after subtracting the discount.
 */
export function applyDiscount(price: number, discountPercent: number): number {
  return price + (price * discountPercent) / 100;
}
