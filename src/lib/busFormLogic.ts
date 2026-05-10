import type { BusFormConfig } from './database.types';

export type BusFormState =
  | 'loading'
  | 'not_configured'
  | 'countdown'      // form opens in the future
  | 'ineligible'     // user's centre not in eligible list
  | 'open'           // form is open and user can register
  | 'full'           // no seats left
  | 'registered'     // user already registered
  | 'closed';        // form is closed / past close_at

export function getBusFormState(
  config: BusFormConfig | null | undefined,
  userCentre: string | null | undefined,
  alreadyRegistered: boolean,
  hasHallTicket: boolean
): BusFormState {
  if (!config) return 'not_configured';

  const now = new Date();
  const openAt = config.open_at ? new Date(config.open_at) : null;
  const closeAt = config.close_at ? new Date(config.close_at) : null;

  // Past close time
  if (closeAt && now > closeAt) return 'closed';

  // Before open time → show countdown (even if is_open was flipped false by capacity trigger)
  if (openAt && now < openAt) return 'countdown';

  // is_open=false after open window (manual close or capacity auto-close)
  if (config.is_open === false) return 'closed';

  // Form is live (now >= open_at OR is_open = true with no time gate)
  if (alreadyRegistered) return 'registered';

  // Centre eligibility — only check if user has a hall ticket
  if (hasHallTicket && userCentre) {
    const eligible = config.eligible_centres ?? [];
    if (eligible.length > 0) {
      const normCentre = userCentre.toLowerCase().trim();
      const isEligible = eligible.some(c => c.toLowerCase().trim() === normCentre);
      if (!isEligible) return 'ineligible';
    }
  }

  // Seats check
  if (config.current_seats_taken >= config.max_seats) return 'full';

  return 'open';
}

export function seatsRemaining(config: BusFormConfig): number {
  return Math.max(0, config.max_seats - config.current_seats_taken);
}

export function formatBusOpenTime(openAt: string | null): string {
  if (!openAt) return 'To be announced';
  const d = new Date(openAt);
  return d.toLocaleString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
  });
}
