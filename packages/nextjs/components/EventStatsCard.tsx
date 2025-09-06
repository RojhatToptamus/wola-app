"use client";

import { formatUSDC } from "~~/utils/eventUtils";
import type { ParsedEventData } from "~~/utils/eventUtils";

interface EventStatsCardProps {
  eventData: ParsedEventData;
  className?: string;
}

export const EventStatsCard: React.FC<EventStatsCardProps> = ({ eventData, className = "" }) => {
  return (
    <div className={`bg-base-300/80 backdrop-blur-sm border border-accent/30 rounded-xl p-4 ${className}`}>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-white/60 text-sm">Capacity</div>
          <div className="text-white font-medium">
            {Number(eventData.confirmedCount)}/{Number(eventData.capacity)} registered
          </div>
        </div>
        <div>
          <div className="text-white/60 text-sm">Status</div>
          <div className="text-white font-medium">
            {eventData.status === BigInt(0)
              ? "Published"
              : eventData.status === BigInt(1)
                ? "Canceled"
                : eventData.status === BigInt(2)
                  ? "Completed"
                  : "Unknown"}
          </div>
        </div>
        {Number(eventData.attendedCount) > 0 ? (
          <div>
            <div className="text-white/60 text-sm">Attended</div>
            <div className="text-white font-medium">{Number(eventData.attendedCount)}</div>
          </div>
        ) : null}
        {eventData.forfeitPool > 0 ? (
          <div>
            <div className="text-white/60 text-sm">Forfeit Pool</div>
            <div className="text-white font-medium">{formatUSDC(eventData.forfeitPool)}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default EventStatsCard;
