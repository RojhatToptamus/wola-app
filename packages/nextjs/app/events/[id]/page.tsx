/* eslint-disable @typescript-eslint/no-unused-expressions */

"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useAccount } from "wagmi";

// Mock data for venues and organizers (same as events list)
const mockVenues = [
  "Terminal Kadıköy",
  "Zorlu Center", 
  "Galataport",
  "İTÜ Ayazağa Kampüsü",
  "Boğaziçi Üniversitesi",
  "Nişantaşı",
  "Beyoğlu Kültür Merkezi",
  "Kadıköy Sahil",
];

const mockOrganizers = [
  "MetaMask Ambassadors",
  "Consensys",
  "Paribu", 
  "Hyperter",
  "Linea",
  "Coinbase",
  "BuidlGuidl Istanbul",
  "Web3 Türkiye",
];

const EventDetailPage = () => {
  const params = useParams();
  // const router = useRouter();
  const { address } = useAccount();
  const eventId = params?.id ? BigInt(params.id as string) : BigInt(0);
  
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationStatus, setRegistrationStatus] = useState<string | null>(null);

  // Contract hooks
  const { writeContractAsync: writeEventManagerAsync } = useScaffoldWriteContract({ 
    contractName: "EventManager" 
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

  // Check user registration status
  const { data: userRegistration } = useScaffoldReadContract({
    contractName: "EventManager",
    functionName: "getRegistration",
    args: [eventId, address || "0x0000000000000000000000000000000000000000"],
  });

  // Mock functions for consistent data
  const getVenueForEvent = (eventId: string) => {
    const index = parseInt(eventId) % mockVenues.length;
    return mockVenues[index];
  };

  const getOrganizerForEvent = (eventId: string) => {
    const index = parseInt(eventId) % mockOrganizers.length;
    return mockOrganizers[index];
  };

  // Format timestamp
  const formatDateTime = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) * 1000);
    return {
      date: date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric',
        year: 'numeric'
      }),
      time: date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
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
      case 0: return null; // None
      case 1: return "Registered"; // Confirmed
      case 2: return "Canceled"; // CanceledByParticipant
      case 3: return "Attended"; // Attended
      default: return null;
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white text-lg">Loading event...</div>
      </div>
    );
  }

  if (!eventData || !eventData[0] || eventData[0] === "0x0000000000000000000000000000000000000000") {
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

  // Parse the tuple data correctly
  const [
    // organizerAddress,    // address
    description,         // string
    startTimestamp,      // uint64
    endTimestamp,        // uint64
    capacity,           // uint32
    status,             // EventStatus enum
    // published,          // bool
    // bondReleased,       // bool
    // checkInClosed,      // bool
    confirmedCount,     // uint32
    // attendedCount,      // uint32
    // forfeitPool,        // uint256
    // rewardPerAttendee   // uint256
  ] = eventData;

  const venue = getVenueForEvent(params?.id as string);
  const organizerName = getOrganizerForEvent(params?.id as string);
  const { date: startDate, time: startTime } = formatDateTime(BigInt(startTimestamp));
  const { date: endDate, time: endTime } = formatDateTime(BigInt(endTimestamp));
  const isLive = isEventLive(BigInt(startTimestamp), BigInt(endTimestamp));
  const userRegStatus = getRegistrationStatusText();
  const randomImageId = parseInt(params?.id as string) * 17; // Consistent image for each event

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* Back button */}
        <div className="mb-6">
          <Link 
            href="/events" 
            className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
          >
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
              <h1 className="text-4xl font-bold text-white mb-2">
                {description || "Untitled Event"}
              </h1>
              
              {/* Featured badge */}
              <div className="flex items-center gap-2 mb-4">
                <div className="bg-orange-500/20 text-orange-400 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
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
                  <div className="text-white/70">{startTime} - {endTime}</div>
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
            <div className="bg-base-300/80 backdrop-blur-sm border border-accent/30 rounded-xl p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-white/60 text-sm">Capacity</div>
                  <div className="text-white font-medium">
                    {Number(confirmedCount)}/{Number(capacity)} registered
                  </div>
                </div>
                <div>
                  <div className="text-white/60 text-sm">Status</div>
                  <div className="text-white font-medium">
                    {0 === status ? "Created" : status === 1 ? "Published" : status === 2 ? "Canceled" : status === 3 ? "Completed" : "Unknown"}
                  </div>
                </div>
              </div>
            </div>

            {/* Stake Requirement */}
            <div className="bg-base-300/80 backdrop-blur-sm border border-accent/30 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-white font-medium text-lg">Stake Required</h3>
                  <p className="text-white/70 text-sm">Required to register for this event</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-white">
                    {depositAmount ? `${Number(depositAmount) / 1e18} USDC` : "0.01 USDC"}
                  </div>
                </div>
              </div>
              
              <div className="text-white/60 text-sm">
                💡 Your stake will be returned if you attend the event, plus a share of no-show penalties
              </div>
            </div>

            {/* Registration Section */}
            <div className="space-y-4">
              {userRegStatus && (
                <div className="bg-green-500/20 border border-green-500/30 rounded-xl p-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    <span className="text-green-400 font-medium">You're {userRegStatus}</span>
                  </div>
                </div>
              )}

              {registrationStatus && (
                <div className={` rounded-xl p-4 ${
                  registrationStatus.includes("successful") 
                    ? "bg-green-500/10 text-green-400" 
                    : "bg-red-500/10 text-red-400"
                }`}>
                  {registrationStatus}
                </div>
              )}

              {!userRegStatus && (
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
