"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { getRandomOrganizer, getRandomVenue } from "~~/utils/mockData";

const EventsListPage = () => {
  const [eventCount, setEventCount] = useState(0);

  // Get the next event ID to know how many events exist
  const { data: nextEventId } = useScaffoldReadContract({
    contractName: "EventManager",
    functionName: "nextEventId",
  });

  // Get deposit amount for displaying stake requirements
  const { data: depositAmount } = useScaffoldReadContract({
    contractName: "EventManager",
    functionName: "attendeeDepositAmount",
  });

  useEffect(() => {
    if (nextEventId) {
      const count = Number(nextEventId) - 1;
      setEventCount(count);
    }
  }, [nextEventId]);

  // Format timestamp to readable date/time
  const formatDateTime = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) * 1000);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();

    if (isToday) {
      return {
        date: "Today",
        time: date.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }),
      };
    }

    return {
      date: date.toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
      }),
      time: date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
    };
  };

  // Check if event is live (started but not ended)
  const isEventLive = (startTime: bigint, endTime: bigint) => {
    const now = Date.now() / 1000;
    const start = Number(startTime);
    const end = Number(endTime);
    return now >= start && now <= end;
  };

  // Event card component
  const EventCard = ({ eventId, eventData, isLoading }: { eventId: number; eventData: any; isLoading: boolean }) => {
    if (isLoading) {
      return (
        <div className="card bg-base-300/80 backdrop-blur-sm border border-accent/30">
          <div className="card-body p-0">
            <div className="w-full h-48 bg-base-300/60 rounded-t-xl animate-pulse"></div>
            <div className="p-6">
              <div className="h-6 bg-base-300/60 rounded mb-3 animate-pulse"></div>
              <div className="h-4 bg-base-300/60 rounded mb-3 animate-pulse w-3/4"></div>
              <div className="h-4 bg-base-300/60 rounded mb-4 animate-pulse w-1/2"></div>
              <div className="flex justify-between">
                <div className="h-4 bg-base-300/60 rounded animate-pulse w-1/4"></div>
                <div className="h-4 bg-base-300/60 rounded animate-pulse w-1/4"></div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (!eventData || !eventData[0] || eventData[0] === "0x0000000000000000000000000000000000000000") {
      return null;
    }

    // Parse the tuple data correctly
    const [
      ,
      // organizerAddress
      description, // string
      startTimestamp, // uint64
      endTimestamp, // uint64
      capacity, // uint32
      ,
      ,
      ,
      ,
      // status
      // published
      // bondReleased
      // checkInClosed
      confirmedCount, // uint32
      // attendedCount
      // forfeitPool
      // rewardPerAttendee
      ,
      ,
      ,
    ] = eventData;

    const { date, time } = formatDateTime(startTimestamp);
    const isLive = isEventLive(startTimestamp, endTimestamp);
    const venue = getRandomVenue();
    const organizerName = getRandomOrganizer();
    const randomImageId = Math.floor(Math.random() * 1000) + 1;

    return (
      <Link href={`/events/${eventId}`} className="block">
        <div className="card bg-base-300/80 backdrop-blur-sm border border-accent/30 hover:border-white/50 transition-all duration-200 hover:shadow-xl cursor-pointer">
          <div className="card-body p-0">
            {/* Event Image */}
            <div className="relative">
              <Image
                src={`https://picsum.photos/500/300?random=${randomImageId}`}
                alt="Event image"
                width={500}
                height={300}
                className="w-full h-48 object-cover rounded-t-xl"
              />

              {/* Live indicator */}
              {isLive && (
                <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-500/90 text-white px-3 py-1 rounded-full text-sm font-medium backdrop-blur-sm">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  LIVE
                </div>
              )}

              {/* Date/Time badge */}
              <div className="absolute top-4 right-4 bg-black/60 text-white px-3 py-2 rounded-xl text-sm font-medium backdrop-blur-sm">
                <div className="text-xs opacity-80">{date}</div>
                <div className="font-semibold">{time}</div>
              </div>
            </div>

            {/* Event Content */}
            <div className="p-6">
              {/* Event Title/Description */}
              <h3 className="text-xl font-bold text-white mb-3 line-clamp-2">{description || "Untitled Event"}</h3>

              {/* Organizer */}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                  {organizerName.charAt(0)}
                </div>
                <div>
                  <div className="text-white/80 text-sm">By {organizerName}</div>
                </div>
              </div>

              {/* Location */}
              <div className="flex items-center gap-2 mb-4">
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
                <span className="text-white/70 text-sm">{venue}</span>
              </div>

              {/* Event Stats */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Capacity */}
                  <div className="flex items-center gap-1">
                    <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                    <span className="text-white/70 text-sm">
                      {Number(confirmedCount)}/{Number(capacity)}
                    </span>
                  </div>

                  {/* Going indicator */}
                  <div className="bg-green-500/20 text-green-400 px-2 py-1 rounded-full text-xs font-medium">Going</div>
                </div>

                {/* Stake requirement */}
                <div className="text-right">
                  <div className="text-white/60 text-xs">Stake Required</div>
                  <div className="text-white font-medium text-sm">
                    {depositAmount ? `${Number(depositAmount) / 1e18} USD` : "0.01 USD"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Link>
    );
  };

  // Fetch individual event data
  const EventWithData = ({ eventId }: { eventId: number }) => {
    const { data: eventData, isLoading } = useScaffoldReadContract({
      contractName: "EventManager",
      functionName: "events",
      args: [BigInt(eventId)],
    });

    return <EventCard eventId={eventId} eventData={eventData} isLoading={isLoading} />;
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Events</h1>
          <p className="text-white/70 text-lg">Discover and join upcoming events in Istanbul</p>
        </div>

        {/* Events Grid */}
        {eventCount > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: eventCount }, (_, index) => (
              <EventWithData key={index + 1} eventId={index + 1} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-white/60 text-lg mb-4">No events found</div>
            <Link href="/create-event" className="btn btn-primary">
              Create First Event
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default EventsListPage;
