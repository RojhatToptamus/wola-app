"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAccount } from "wagmi";
import { Cog6ToothIcon } from "@heroicons/react/24/outline";
import EventStatsCard from "~~/components/EventStatsCard";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import {
  RegistrationStatus,
  formatUSDC,
  getAvailableActions,
  isOrganizer,
  safeParseEventData,
} from "~~/utils/eventUtils";
import { getOrganizerForEvent, getVenueForEvent } from "~~/utils/mockData";

// Types for policy data
interface PolicyConfig {
  fullRefundHours: bigint;
  partialRefundHours: bigint;
  partialRefundPercent: bigint;
  attendeeSharePercent: bigint;
}

interface RefundInfo {
  amount: bigint;
  percentage: number;
  status: "full" | "partial" | "none";
  timeRemaining: number; // hours until event
}

const EventDetailPage = () => {
  const params = useParams();
  const { address } = useAccount();

  // Validate and parse event ID safely
  const eventId = (() => {
    try {
      const id = params?.id;
      if (!id) return BigInt(0);
      const parsed = BigInt(id as string);
      return parsed > 0 ? parsed : BigInt(0);
    } catch {
      return BigInt(0);
    }
  })();

  const [isRegistering, setIsRegistering] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [registrationStatus, setRegistrationStatus] = useState<string | null>(null);

  // Contract hooks
  const { writeContractAsync: writeEventManagerAsync } = useScaffoldWriteContract({
    contractName: "EventManager",
  });

  // Fetch event data
  const { data: eventData, isLoading } = useScaffoldReadContract({
    contractName: "EventManager",
    functionName: "events",
    args: [eventId],
  });

  // Get deposit amount
  const { data: depositAmount } = useScaffoldReadContract({
    contractName: "EventManager",
    functionName: "attendeeDepositAmount",
  });

  // Get claimable payout
  const { data: claimablePayout } = useScaffoldReadContract({
    contractName: "EventManager",
    functionName: "getClaimablePayout",
    args: [eventId, address || "0x0000000000000000000000000000000000000000"],
  });

  // Get user balance for withdraw
  const { data: userBalance } = useScaffoldReadContract({
    contractName: "EventManager",
    functionName: "balances",
    args: [address || "0x0000000000000000000000000000000000000000"],
  });

  // Check user registration status
  const { data: userRegistration } = useScaffoldReadContract({
    contractName: "EventManager",
    functionName: "getRegistration",
    args: [eventId, address || "0x0000000000000000000000000000000000000000"],
  });

  // Get policy configuration
  const { data: policyData } = useScaffoldReadContract({
    contractName: "EventManager",
    functionName: "policy",
  });

  // Parse event data safely
  const parsedEvent = useMemo(() => {
    if (!eventData) return null;
    return safeParseEventData(eventData as readonly unknown[]);
  }, [eventData]);

  // Check if user is organizer
  const isUserOrganizer = useMemo(() => {
    if (!address || !parsedEvent) return false;
    return isOrganizer(address, parsedEvent.organizer);
  }, [address, parsedEvent]);

  // Get available actions
  const actions = useMemo(() => {
    if (!parsedEvent) return null;
    const userRegStatus = userRegistration ? BigInt(userRegistration[0] as number) : BigInt(RegistrationStatus.None);
    return getAvailableActions(parsedEvent, address, userRegStatus);
  }, [parsedEvent, address, userRegistration]);

  // Calculate refund information based on timing and policy
  const calculateRefundInfo = (startTimestamp: bigint, policy: PolicyConfig | undefined): RefundInfo => {
    if (!policy) {
      return { amount: BigInt(0), percentage: 0, status: "none", timeRemaining: 0 };
    }

    const now = Math.floor(Date.now() / 1000);
    const eventStart = Number(startTimestamp);
    const hoursUntilEvent = eventStart > 0 ? (eventStart - now) / 3600 : 0;

    const fullRefundHours = Number(policy.fullRefundHours);
    const partialRefundHours = Number(policy.partialRefundHours);
    const partialPercent = Number(policy.partialRefundPercent);

    if (hoursUntilEvent >= fullRefundHours) {
      return {
        amount: depositAmount || BigInt(0),
        percentage: 100,
        status: "full",
        timeRemaining: hoursUntilEvent,
      };
    } else if (hoursUntilEvent >= partialRefundHours) {
      const refundAmount = depositAmount ? (depositAmount * BigInt(partialPercent)) / BigInt(100) : BigInt(0);
      return {
        amount: refundAmount,
        percentage: partialPercent,
        status: "partial",
        timeRemaining: hoursUntilEvent,
      };
    } else {
      return {
        amount: BigInt(0),
        percentage: 0,
        status: "none",
        timeRemaining: hoursUntilEvent,
      };
    }
  };

  // Format timestamp
  const formatDateTime = (timestamp: bigint) => {
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
  };

  // Check if event is live
  const isEventLive = (startTime: bigint, endTime: bigint) => {
    const now = Date.now() / 1000;
    const start = Number(startTime);
    const end = Number(endTime);
    return now >= start && now <= end;
  };

  // Get registration status text
  const getRegistrationStatusText = () => {
    if (!userRegistration || !address) return null;

    const status = userRegistration[0]; // RegStatus enum
    switch (status) {
      case 0:
        return null; // None
      case 1:
        return "Registered"; // Confirmed
      case 2:
        return "Canceled"; // CanceledByParticipant
      case 3:
        return "Attended"; // Attended
      default:
        return null;
    }
  };

  // Handle registration
  const handleRegister = async () => {
    if (!address) {
      alert("Please connect your wallet first");
      return;
    }

    setIsRegistering(true);
    try {
      await writeEventManagerAsync({
        functionName: "registerForEvent",
        args: [eventId],
      });
      setRegistrationStatus("Registration successful!");
    } catch (error) {
      console.error("Registration failed:", error);
      setRegistrationStatus("Registration failed. Please try again.");
    } finally {
      setIsRegistering(false);
    }
  };

  // Handle cancellation
  const handleCancel = async () => {
    if (!address) {
      alert("Please connect your wallet first");
      return;
    }

    setIsCanceling(true);
    try {
      await writeEventManagerAsync({
        functionName: "cancelRegistration",
        args: [eventId],
      });
      setRegistrationStatus("Registration canceled successfully!");
    } catch (error) {
      console.error("Cancellation failed:", error);
      setRegistrationStatus("Cancellation failed. Please try again.");
    } finally {
      setIsCanceling(false);
    }
  };

  // Handle claim payout
  const handleClaimPayout = async () => {
    if (!address) {
      alert("Please connect your wallet first");
      return;
    }

    setIsClaiming(true);
    try {
      await writeEventManagerAsync({
        functionName: "claimPayout",
        args: [eventId],
      });
      setRegistrationStatus("Payout claimed successfully!");
    } catch (error) {
      console.error("Claim payout failed:", error);
      setRegistrationStatus("Failed to claim payout. Please try again.");
    } finally {
      setIsClaiming(false);
    }
  };

  // Handle withdraw
  const handleWithdraw = async () => {
    if (!address) {
      alert("Please connect your wallet first");
      return;
    }

    try {
      await writeEventManagerAsync({
        functionName: "withdraw",
        args: undefined,
      });
      setRegistrationStatus("Withdrawal successful!");
    } catch (error) {
      console.error("Withdrawal failed:", error);
      setRegistrationStatus("Failed to withdraw. Please try again.");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white text-lg">Loading event...</div>
      </div>
    );
  }

  // Check if event exists
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

  const venue = getVenueForEvent(params?.id as string);
  const organizerName = getOrganizerForEvent(params?.id as string);

  const { date: startDate, time: startTime } = formatDateTime(parsedEvent.startTime);
  const { time: endTime } = formatDateTime(parsedEvent.endTime);
  const isLive = isEventLive(parsedEvent.startTime, parsedEvent.endTime);
  const userRegStatus = userRegistration ? getRegistrationStatusText() : "Not Registered";
  const randomImageId = parseInt(params?.id as string) * 17; // Consistent image for each event

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* Back button */}
        <div className="mb-6">
          <Link href="/events" className="flex items-center gap-2 text-white/70 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Events
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left side - Event Image */}
          <div className="flex items-start justify-center">
            <div className="relative w-full max-w-[600px]">
              <Image
                src={`https://picsum.photos/600/400?random=${randomImageId}`}
                alt="Event image"
                width={600}
                height={400}
                className="w-full h-full object-cover rounded-xl"
              />

              {/* Live indicator */}
              {isLive && (
                <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-500/90 text-white px-4 py-2 rounded-full text-sm font-medium backdrop-blur-sm">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  LIVE
                </div>
              )}
            </div>
          </div>

          {/* Right side - Event Information */}
          <div className="space-y-6">
            {/* Event Title */}
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">{parsedEvent.description || "Untitled Event"}</h1>

              {/* Featured badge */}
              <div className="flex items-center gap-2 mb-4">
                <div className="bg-orange-500/20 text-orange-400 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                  Featured in Istanbul
                </div>
              </div>
            </div>

            {/* Date and Time */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-white"></div>
                </div>
                <div>
                  <div className="text-white font-medium text-lg">{startDate}</div>
                  <div className="text-white/70">
                    {startTime} - {endTime}
                  </div>
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <div>
                <div className="text-white font-medium">{venue}</div>
                <div className="text-white/70 text-sm">Kadıköy, Istanbul</div>
              </div>
            </div>

            {/* Organizer */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white text-lg font-bold">
                {organizerName.charAt(0)}
              </div>
              <div>
                <div className="text-white/70 text-sm">Hosted By</div>
                <div className="text-white font-medium">{organizerName}</div>
              </div>
            </div>

            {/* Event Stats */}
            <EventStatsCard eventData={parsedEvent} />

            {/* Stake Requirement */}
            <div className="bg-base-300/80 backdrop-blur-sm border border-accent/30 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-white font-medium text-lg">Stake Required</h3>
                  <p className="text-white/70 text-sm">Required to register for this event</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-white">
                    {depositAmount ? `${Number(depositAmount) / 1e18} USDC` : "Loading..."}
                  </div>
                </div>
              </div>

              <div className="text-white/60 text-sm">
                💡 Your stake will be returned if you attend the event, plus a share of no-show penalties
              </div>
            </div>

            {/* Comprehensive Registration Status Section */}
            {userRegStatus && userRegStatus === "Registered" && (
              <div className="bg-base-300/80 backdrop-blur-sm border border-accent/30 rounded-xl p-6 relative">
                {/* LIVE indicator if event is active */}
                {isLive && (
                  <div className="absolute top-4 right-4 flex items-center gap-2 bg-red-500/90 text-white px-3 py-2 rounded-full text-sm font-medium">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    LIVE
                  </div>
                )}

                {/* User Avatar and Status */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-teal-400 to-green-400 rounded-full flex items-center justify-center text-white text-lg font-bold">
                      {address?.slice(2, 4).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-white text-xl font-bold">You&apos;re In</h3>
                      <div className="text-white/70 text-sm">Registration confirmed</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button className="btn btn-primary flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
                        />
                      </svg>
                      My Ticket
                    </button>
                    <button className="btn btn-ghost border border-white/20">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
                        />
                      </svg>
                      Invite a Friend
                    </button>
                  </div>
                </div>

                {/* Cancellation Section */}
                {!isLive && policyData && (
                  <div className="bg-base-200/60 rounded-xl p-4 mb-4">
                    <h4 className="text-white font-medium mb-3">Cancellation Policy</h4>

                    {/* Time-based refund info */}
                    {(() => {
                      if (!policyData || !Array.isArray(policyData)) return null;

                      const policy: PolicyConfig = {
                        fullRefundHours: policyData[0],
                        partialRefundHours: policyData[1],
                        partialRefundPercent: policyData[2],
                        attendeeSharePercent: policyData[3],
                      };
                      const refundInfo = calculateRefundInfo(parsedEvent.startTime, policy);

                      return (
                        <div className="space-y-3">
                          {/* Current refund status */}
                          <div
                            className={`p-3 rounded-lg ${
                              refundInfo.status === "full"
                                ? "bg-green-500/10"
                                : refundInfo.status === "partial"
                                  ? "bg-yellow-500/10"
                                  : "bg-red-500/20"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                {refundInfo.status === "full" && (
                                  <>
                                    <div className="text-green-500 font-medium">Full refund available</div>
                                    <div className="text-green-300/80 text-sm">
                                      Cancel now to get your full stake back
                                    </div>
                                  </>
                                )}
                                {refundInfo.status === "partial" && (
                                  <>
                                    <div className="text-yellow-400 font-medium">
                                      Partial refund available - {refundInfo.percentage}% of stake
                                    </div>
                                    <div className="text-yellow-300/80 text-sm">Late cancellation penalty applies</div>
                                  </>
                                )}
                                {refundInfo.status === "none" && (
                                  <>
                                    <div className="text-red-400 font-medium">No refund available</div>
                                    <div className="text-red-300/80 text-sm">
                                      Too close to event start - full penalty
                                    </div>
                                  </>
                                )}
                              </div>
                              <div className="text-right">
                                <div className="text-white font-bold">
                                  {refundInfo.amount ? `${Number(refundInfo.amount) / 1e18} USDC` : "0 USDC"}
                                </div>
                                <div className="text-white/60 text-sm">
                                  {Math.floor(refundInfo.timeRemaining)}h{" "}
                                  {Math.floor((refundInfo.timeRemaining % 1) * 60)}m remaining
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Cancel button */}
                          <button
                            onClick={handleCancel}
                            disabled={isCanceling}
                            className="btn btn-outline text-red-400 hover:bg-red-500/20 w-full"
                          >
                            {isCanceling ? (
                              <div className="flex items-center gap-2">
                                <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full"></div>
                                Cancelling...
                              </div>
                            ) : (
                              "Cancel Registration"
                            )}
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Educational Content */}
                <div className="bg-base-200/40 rounded-xl p-4">
                  <h4 className="text-white font-medium mb-3">How Our Accountability System Works</h4>
                  <div className="space-y-2 text-white/70 text-sm">
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-white/60 rounded-full mt-2 flex-shrink-0"></div>
                      <span>Our protocol uses time-based penalties to ensure commitment</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-white/60 rounded-full mt-2 flex-shrink-0"></div>
                      <span>Cancel early for full refund, late cancellations incur penalties</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-white/60 rounded-full mt-2 flex-shrink-0"></div>
                      <span>To get your stake back plus rewards, show up and check in</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-white/60 rounded-full mt-2 flex-shrink-0"></div>
                      <span>Don&apos;t forget to claim your stake after checking in</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-white/60 rounded-full mt-2 flex-shrink-0"></div>
                      <span>No-show penalties are distributed among attendees who show up</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Registration Section */}
            <div className="space-y-4">
              {/* Organizer Management Link */}
              {isUserOrganizer && (
                <Link
                  href={`/events/${params?.id}/manage`}
                  className="btn bg-white text-gray-800 hover:bg-gray-100 border-white w-full mb-4"
                >
                  <Cog6ToothIcon className="w-4 h-4 mr-2" />
                  Manage Event
                </Link>
              )}

              {userRegStatus && userRegStatus !== "Not Registered" && userRegStatus !== "Registered" && (
                <div className="bg-green-500/20 border border-green-500/30 rounded-xl p-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    <span className="text-green-400 font-medium">You&apos;re {userRegStatus}</span>
                  </div>
                </div>
              )}

              {/* Claim Payout */}
              {!!(actions?.canClaimPayout && claimablePayout && claimablePayout > 0) && (
                <div className="bg-base-300/80 backdrop-blur-sm border border-white/30 rounded-xl p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-white font-medium mb-1">Payout Available</h4>
                      <p className="text-white/70 text-sm">
                        You can claim {formatUSDC(claimablePayout)} from this event
                      </p>
                    </div>
                    <button
                      onClick={handleClaimPayout}
                      disabled={isClaiming}
                      className="btn bg-white text-gray-800 hover:bg-gray-100 border-white w-full"
                    >
                      {isClaiming ? (
                        <div className="flex items-center gap-2">
                          <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full"></div>
                          Claiming...
                        </div>
                      ) : (
                        "Claim Payout"
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Withdraw Balance */}
              {!!(userBalance && userBalance > 0) && (
                <div className="bg-base-300/80 backdrop-blur-sm border border-white/30 rounded-xl p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-white font-medium mb-1">Balance Available</h4>
                      <p className="text-white/70 text-sm">You have {formatUSDC(userBalance)} available to withdraw</p>
                    </div>
                    <button
                      onClick={handleWithdraw}
                      className="btn bg-white text-gray-800 hover:bg-gray-100 border-white"
                    >
                      Withdraw
                    </button>
                  </div>
                </div>
              )}

              {registrationStatus && (
                <div
                  className={` rounded-xl p-4 ${
                    registrationStatus.includes("successful")
                      ? "bg-green-500/10 text-green-400"
                      : "bg-red-500/10 text-red-400"
                  }`}
                >
                  {registrationStatus}
                </div>
              )}

              {!!actions?.canRegister && (
                <button
                  onClick={handleRegister}
                  disabled={isRegistering || !address}
                  className="btn btn-primary w-full h-14 text-lg font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50"
                >
                  {isRegistering ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin w-5 h-5 border-2 border-current border-t-transparent rounded-full"></div>
                      Registering...
                    </div>
                  ) : !address ? (
                    "Connect Wallet to Register"
                  ) : (
                    "Register for Event"
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventDetailPage;
