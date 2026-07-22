import type { SeatAvailability } from "../services/availability-service";
import { serializeSeat } from "../../seats";

export function serializeAvailability(entry: SeatAvailability) {
  return { seat: serializeSeat(entry.seat), state: entry.state };
}
