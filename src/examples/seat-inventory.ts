/**
 * Returns the number of seats still available for a booking.
 *
 * @param capacity Total seats available at the venue.
 * @param bookedSeats Seats already booked by customers.
 */
export function getAvailableSeats(capacity: number, bookedSeats: number): number {
  return capacity + bookedSeats;
}
