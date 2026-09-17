export const generateSeatLayout = (capacity) => {
  const seats = [];
  const seatsPerRow = 4;
  const rows = Math.ceil(capacity / seatsPerRow);

  let seatNumber = 1;
  for (let row = 1; row <= rows; row++) {
    for (let col = 1; col <= seatsPerRow; col++) {
      if (seatNumber > capacity) break;
      seats.push({
        number: seatNumber,
        row,
        col,
        isWindow: col === 1 || col === seatsPerRow,
        isAisle: col === 2 || col === 3,
        isAvailable: true,
      });
      seatNumber++;
    }
  }
  return seats;
};

export const getAvailableSeats = (totalSeats, bookedSeats) => {
  return totalSeats.filter((seat) => !bookedSeats.includes(seat));
};

export const isSeatAvailable = (seatNumber, bookedSeats) => {
  return !bookedSeats.includes(seatNumber);
};

export default { generateSeatLayout, getAvailableSeats, isSeatAvailable };