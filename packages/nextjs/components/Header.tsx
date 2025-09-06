"use client";

import React from "react";
import Link from "next/link";
import { BellIcon, CalendarIcon, MapIcon, TicketIcon } from "@heroicons/react/24/outline";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";

const Header = () => {
  return (
    <header className="bg-base-200/80 backdrop-blur-sm border-b border-accent/30">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Left side navigation */}
          <nav className="flex items-center space-x-8">
            <Link
              href="/events"
              className="flex items-center space-x-3 transition-colors text-white/50 hover:text-white"
            >
              <TicketIcon className="w-6 h-6" strokeWidth={2} />
              <span className="text-lg font-semibold">Events</span>
            </Link>

            <Link
              href="/calendars"
              className="flex items-center space-x-3 transition-colors text-white/50 hover:text-white"
            >
              <CalendarIcon className="w-6 h-6" strokeWidth={2} />
              <span className="text-lg font-semibold">Calendars</span>
            </Link>

            <Link
              href="/discover"
              className="flex items-center space-x-3 transition-colors text-white/50 hover:text-white"
            >
              <MapIcon className="w-6 h-6" strokeWidth={2} />
              <span className="text-lg font-semibold">Discover</span>
            </Link>
            {/* Create Event button */}
            <Link href="/create-event">
              <button className="btn btn-primary px-4 py-2 text-base font-semibold rounded-lg">Create Event</button>
            </Link>
          </nav>

          {/* Right side items */}
          <div className="flex items-center space-x-1">
            {/* Connect Button */}
            <RainbowKitCustomConnectButton />
            <button className="transition-colors relative text-white/50 hover:text-white">
              <BellIcon className="w-6 h-6" strokeWidth={2} />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></div>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
