// Event utilities and safe parsing functions

export interface ParsedEventData {
  organizer: `0x${string}`;
  description: string;
  startTime: bigint;
  endTime: bigint;
  capacity: bigint;
  status: bigint;
  published: boolean;
  bondReleased: boolean;
  checkInClosed: boolean;
  confirmedCount: bigint;
  attendedCount: bigint;
  forfeitPool: bigint;
  rewardPerAttendee: bigint;
}

export function safeParseEventData(eventData: readonly unknown[]): ParsedEventData | null {
  if (!eventData || !Array.isArray(eventData) || eventData.length < 13) {
    return null;
  }

  try {
    return {
      organizer: eventData[0] as `0x${string}`,
      description: eventData[1] as string,
      startTime: toBigInt(eventData[2]),
      endTime: toBigInt(eventData[3]),
      capacity: toBigInt(eventData[4]),
      status: toBigInt(eventData[5]),
      published: toBoolean(eventData[6]),
      bondReleased: toBoolean(eventData[7]),
      checkInClosed: toBoolean(eventData[8]),
      confirmedCount: toBigInt(eventData[9]),
      attendedCount: toBigInt(eventData[10]),
      forfeitPool: toBigInt(eventData[11]),
      rewardPerAttendee: toBigInt(eventData[12]),
    };
  } catch (error) {
    console.error("Failed to parse event data:", error);
    return null;
  }
}

export function toBigInt(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "string") return BigInt(value);
  return BigInt(0);
}

export function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return false;
}

export function toNumber(value: bigint): number {
  try {
    return Number(value);
  } catch {
    return 0;
  }
}

export function toAddress(value: unknown): `0x${string}` {
  if (typeof value === "string" && value.startsWith("0x")) {
    return value as `0x${string}`;
  }
  return "0x0000000000000000000000000000000000000000";
}

// Event status enum mapping
export enum EventStatus {
  Published = 0,
  Canceled = 1,
  Completed = 2,
}

export enum RegistrationStatus {
  None = 0,
  Confirmed = 1,
  CanceledByParticipant = 2,
  Attended = 3,
}

// Helper functions for event state
export function getEventStatusText(status: bigint): string {
  switch (Number(status)) {
    case EventStatus.Published:
      return "Published";
    case EventStatus.Canceled:
      return "Canceled";
    case EventStatus.Completed:
      return "Completed";
    default:
      return "Unknown";
  }
}

export function getRegistrationStatusText(status: bigint): string {
  switch (Number(status)) {
    case RegistrationStatus.None:
      return "Not Registered";
    case RegistrationStatus.Confirmed:
      return "Registered";
    case RegistrationStatus.CanceledByParticipant:
      return "Canceled";
    case RegistrationStatus.Attended:
      return "Attended";
    default:
      return "Unknown";
  }
}

// Time-based helpers
export function hasStarted(startTime: bigint): boolean {
  return Date.now() / 1000 >= Number(startTime);
}

export function hasEnded(endTime: bigint): boolean {
  return Date.now() / 1000 >= Number(endTime);
}

export function isEventLive(startTime: bigint, endTime: bigint): boolean {
  const now = Date.now() / 1000;
  return now >= Number(startTime) && now <= Number(endTime);
}

// Role detection
export function isOrganizer(userAddress: string | undefined, organizerAddress: string): boolean {
  if (!userAddress) return false;
  return userAddress.toLowerCase() === organizerAddress.toLowerCase();
}

// Event action gating
export interface EventActions {
  canRegister: boolean;
  canCancelRegistration: boolean;
  canClaimPayout: boolean;
  canCancelEvent: boolean;
  canCheckIn: boolean;
  canCloseCheckIn: boolean;
  canCompleteEvent: boolean;
}

export function getAvailableActions(
  eventData: ParsedEventData,
  userAddress: string | undefined,
  userRegistrationStatus: bigint,
): EventActions {
  const isUserOrganizer = isOrganizer(userAddress, eventData.organizer);
  const eventStarted = hasStarted(eventData.startTime);
  const eventEnded = hasEnded(eventData.endTime);
  const isPublished = eventData.status === BigInt(EventStatus.Published);
  const isCanceled = eventData.status === BigInt(EventStatus.Canceled);
  const isCompleted = eventData.status === BigInt(EventStatus.Completed);
  const isUserRegistered = userRegistrationStatus === BigInt(RegistrationStatus.Confirmed);

  return {
    // Participant actions
    canRegister:
      !isUserOrganizer &&
      isPublished &&
      !eventStarted &&
      !isUserRegistered &&
      eventData.confirmedCount < eventData.capacity,
    canCancelRegistration: isUserRegistered && isPublished && !eventStarted,
    canClaimPayout: isUserRegistered && (isCompleted || isCanceled),

    // Organizer actions
    canCancelEvent: isUserOrganizer && isPublished,
    canCheckIn: isUserOrganizer && isPublished && eventStarted && !eventData.checkInClosed,
    canCloseCheckIn: isUserOrganizer && isPublished && eventEnded && !eventData.checkInClosed,
    canCompleteEvent: isUserOrganizer && isPublished,
  };
}

// Format helpers
export function formatDateTime(timestamp: bigint): { date: string; time: string } {
  const date = new Date(Number(timestamp) * 1000);
  return {
    date: date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
    time: date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }),
  };
}

export function formatUSDC(amount: bigint): string {
  return `${Number(amount) / 1e18} USDC`;
}
