"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAccount } from "wagmi";
import { useScaffoldEventHistory, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import {
  formatDateTime,
  formatUSDC,
  getEventStatusText,
  hasEnded,
  hasStarted,
  isEventLive,
  safeParseEventData,
} from "~~/utils/eventUtils";
import { getVenueForEvent } from "~~/utils/mockData";

const EventManagePage = () => {
  const params = useParams();
  const { address } = useAccount();

  const [checkInAddress, setCheckInAddress] = useState("");

  // Parse event ID safely
  const eventId = useMemo(() => {
    try {
      const id = params?.id;
      if (!id) return BigInt(0);
      const parsed = BigInt(id as string);
      return parsed > 0 ? parsed : BigInt(0);
    } catch {
      return BigInt(0);
    }
  }, [params?.id]);

  // Contract hooks
  const { writeContractAsync: writeEventManagerAsync } = useScaffoldWriteContract({
    contractName: "EventManager",
  });

  // Fetch event data
  const { data: eventData, isLoading: eventLoading } = useScaffoldReadContract({
    contractName: "EventManager",
    functionName: "events",
    args: [eventId],
  });

  const { data: organizerBondAmount } = useScaffoldReadContract({
    contractName: "EventManager",
    functionName: "organizerBondAmount",
  });

  // Parse event data safely
  const parsedEvent = useMemo(() => {
    if (!eventData) return null;
    return safeParseEventData(eventData as readonly unknown[]);
  }, [eventData]);

  // Check if user is organizer
  const isOrganizer = useMemo(() => {
    if (!address || !parsedEvent) return false;
    return address.toLowerCase() === parsedEvent.organizer.toLowerCase();
  }, [address, parsedEvent]);

  // Get participant list from event logs
  const { data: registrationConfirmedLogs } = useScaffoldEventHistory({
    contractName: "EventManager",
    eventName: "RegistrationConfirmed",
    filters: { eventId },
    watch: true,
  });

  const { data: registrationCanceledLogs } = useScaffoldEventHistory({
    contractName: "EventManager",
    eventName: "RegistrationCanceled",
    filters: { eventId },
    watch: true,
  });

  const { data: checkedInLogs } = useScaffoldEventHistory({
    contractName: "EventManager",
    eventName: "ParticipantCheckedIn",
    filters: { eventId },
    watch: true,
  });

  // Build participant list
  const participants = useMemo(() => {
    if (!registrationConfirmedLogs) return [];

    const confirmedSet = new Set(registrationConfirmedLogs.map(log => log.args.participant as `0x${string}`));

    // Remove canceled registrations
    if (registrationCanceledLogs) {
      registrationCanceledLogs.forEach(log => {
        confirmedSet.delete(log.args.participant as `0x${string}`);
      });
    }

    return Array.from(confirmedSet);
  }, [registrationConfirmedLogs, registrationCanceledLogs]);

  const checkedInParticipants = useMemo(() => {
    if (!checkedInLogs) return new Set();
    return new Set(checkedInLogs.map(log => log.args.participant as `0x${string}`));
  }, [checkedInLogs]);

  // Action handlers - simplified, let scaffold-eth handle transaction states
  const handleCancelEvent = () => {
    writeEventManagerAsync({
      functionName: "cancelEvent",
      args: [eventId],
    });
  };

  const handleCloseCheckIn = () => {
    writeEventManagerAsync({
      functionName: "closeCheckIn",
      args: [eventId],
    });
  };

  const handleCompleteEvent = () => {
    writeEventManagerAsync({
      functionName: "completeEvent",
      args: [eventId],
    });
  };

  const handleCheckInParticipant = (participantAddress: `0x${string}`) => {
    writeEventManagerAsync({
      functionName: "checkIn",
      args: [eventId, participantAddress],
    });
  };

  const handleManualCheckIn = () => {
    if (!checkInAddress) return;

    try {
      const addr = checkInAddress as `0x${string}`;
      handleCheckInParticipant(addr);
      setCheckInAddress("");
    } catch (error) {
      console.error("Invalid address format:", error);
    }
  };

  if (eventLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white text-lg">Loading event...</div>
      </div>
    );
  }

  if (!parsedEvent) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-white text-lg mb-4">Event not found</div>
          <Link href="/events" className="btn btn-primary">
            Back to Events
          </Link>
        </div>
      </div>
    );
  }

  // Access control - only show to organizer
  if (!isOrganizer) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-white text-lg mb-4">You are not the organizer of this event</div>
          <Link href={`/events/${params?.id}`} className="btn btn-primary">
            Back to Event
          </Link>
        </div>
      </div>
    );
  }

  const venue = getVenueForEvent(params?.id as string);
  const { date: startDate, time: startTime } = formatDateTime(parsedEvent.startTime);
  const { time: endTime } = formatDateTime(parsedEvent.endTime);
  const isLive = isEventLive(parsedEvent.startTime, parsedEvent.endTime);
  const eventStarted = hasStarted(parsedEvent.startTime);
  const eventEnded = hasEnded(parsedEvent.endTime);

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header with navigation */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/events/${params?.id}`}
                className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Event
              </Link>
              <div className="text-white/40">•</div>
              <h1 className="text-2xl font-bold text-white">Event Management</h1>
            </div>

            {isLive && (
              <div className="flex items-center gap-2 bg-red-500/90 text-white px-4 py-2 rounded-full text-sm font-medium">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                LIVE EVENT
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Event Info */}
          <div className="lg:col-span-1 space-y-6">
            {/* Event Basic Info */}
            <div className="bg-base-300/80 backdrop-blur-sm border border-accent/30 rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-4">{parsedEvent.description}</h2>

              <div className="space-y-3">
                {/* Status Badge */}
                <div className="flex items-center gap-2">
                  <div
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      parsedEvent.status === BigInt(0)
                        ? "bg-green-500/20 text-green-400"
                        : parsedEvent.status === BigInt(1)
                          ? "bg-red-500/20 text-red-400"
                          : "bg-blue-500/20 text-blue-400"
                    }`}
                  >
                    {getEventStatusText(parsedEvent.status)}
                  </div>

                  {eventStarted && !eventEnded && (
                    <div className="bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-full text-sm font-medium">
                      In Progress
                    </div>
                  )}

                  {parsedEvent.checkInClosed && (
                    <div className="bg-orange-500/20 text-orange-400 px-3 py-1 rounded-full text-sm font-medium">
                      Check-in Closed
                    </div>
                  )}
                </div>

                {/* Date/Time */}
                <div>
                  <div className="text-white font-medium">{startDate}</div>
                  <div className="text-white/70">
                    {startTime} - {endTime}
                  </div>
                </div>

                {/* Location */}
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  <span className="text-white/70">{venue}</span>
                </div>
              </div>
            </div>

            {/* Event Stats */}
            <div className="bg-base-300/80 backdrop-blur-sm border border-accent/30 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Event Statistics</h3>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-white/70">Capacity:</span>
                  <span className="text-white font-medium">{Number(parsedEvent.capacity)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/70">Registered:</span>
                  <span className="text-white font-medium">{Number(parsedEvent.confirmedCount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/70">Attended:</span>
                  <span className="text-white font-medium">{Number(parsedEvent.attendedCount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/70">Forfeit Pool:</span>
                  <span className="text-white font-medium">{formatUSDC(parsedEvent.forfeitPool)}</span>
                </div>
                {parsedEvent.rewardPerAttendee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-white/70">Reward per Attendee:</span>
                    <span className="text-white font-medium">{formatUSDC(parsedEvent.rewardPerAttendee)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Bond Info */}
            <div className="bg-base-300/80 backdrop-blur-sm border border-accent/30 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Organizer Bond</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-white/70">Bond Amount:</span>
                  <span className="text-white font-medium">
                    {organizerBondAmount ? formatUSDC(organizerBondAmount) : "Loading..."}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/70">Status:</span>
                  <span className={`font-medium ${parsedEvent.bondReleased ? "text-green-400" : "text-yellow-400"}`}>
                    {parsedEvent.bondReleased ? "Released" : "Locked"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Actions and Participant Management */}
          <div className="lg:col-span-2 space-y-6">
            {/* Organizer Actions */}
            <div className="bg-base-300/80 backdrop-blur-sm border border-accent/30 rounded-xl p-6">
              <h3 className="text-xl font-semibold text-white mb-6">Organizer Actions</h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={handleCancelEvent}
                  className="btn btn-outline text-red-400 hover:bg-red-500/20 border-red-500/30"
                >
                  Cancel Event
                </button>

                <button
                  onClick={handleCloseCheckIn}
                  className="btn btn-outline text-orange-400 hover:bg-orange-500/20 border-orange-500/30"
                >
                  Close Check-In
                </button>

                <button onClick={handleCompleteEvent} className="btn btn-primary">
                  Complete Event
                </button>
              </div>
            </div>

            {/* Participant Management */}
            <div className="bg-base-300/80 backdrop-blur-sm border border-accent/30 rounded-xl p-6">
              <h3 className="text-xl font-semibold text-white mb-6">Participant Management</h3>

              {/* Manual Check-In */}
              <div className="mb-6">
                <h4 className="text-lg font-medium text-white mb-3">Manual Check-In</h4>
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="Enter participant address (0x...)"
                    value={checkInAddress}
                    onChange={e => setCheckInAddress(e.target.value)}
                    className="input input-bordered flex-1"
                  />
                  <button onClick={handleManualCheckIn} disabled={!checkInAddress} className="btn btn-primary">
                    Check In
                  </button>
                </div>
              </div>

              {/* Participant List */}
              <div>
                <h4 className="text-lg font-medium text-white mb-3">Registered Participants ({participants.length})</h4>

                {participants.length === 0 ? (
                  <div className="text-white/60 text-center py-8">
                    <div>No participants registered yet</div>
                    <div className="text-xs mt-2">
                      Confirmed: {registrationConfirmedLogs?.length || 0}, Canceled:{" "}
                      {registrationCanceledLogs?.length || 0}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {participants.map(participant => {
                      const isCheckedIn = checkedInParticipants.has(participant);

                      return (
                        <div
                          key={participant}
                          className="flex items-center justify-between p-3 bg-base-200/60 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-3 h-3 rounded-full ${isCheckedIn ? "bg-green-400" : "bg-gray-400"}`}
                            ></div>
                            <span className="text-white font-mono text-sm">
                              {participant.slice(0, 8)}...{participant.slice(-6)}
                            </span>
                            {isCheckedIn && <span className="text-green-400 text-sm">✓ Checked In</span>}
                          </div>

                          {!isCheckedIn && (
                            <button
                              onClick={() => handleCheckInParticipant(participant)}
                              className="btn btn-sm btn-outline text-green-400 hover:bg-green-500/20 border-green-500/30"
                            >
                              Check In
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventManagePage;
