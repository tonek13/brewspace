import { customAlphabet } from "nanoid";

const generate = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 8);

export function generateReservationCode(): string {
  return generate();
}
