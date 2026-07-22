-- Database-level guarantee against double-booking a seat.
--
-- Concurrency reasoning: the reservations service already checks for overlaps
-- before inserting (see ReservationService.confirm), but two concurrent
-- requests can both pass that check before either commits. Rather than relying
-- on row locking alone, an EXCLUDE constraint makes PostgreSQL itself reject
-- the second overlapping insert/update at commit time, independent of
-- application logic or how many API instances are running. Only reservations
-- in an "active" state (HELD, CONFIRMED, CHECKED_IN) participate — completed,
-- cancelled, expired and no-show reservations must not block new bookings.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE reservations
  ADD CONSTRAINT reservations_no_overlap
  EXCLUDE USING gist (
    seat_id WITH =,
    tstzrange(start_at, end_at, '[)') WITH &&
  )
  WHERE (status IN ('HELD', 'CONFIRMED', 'CHECKED_IN'));
