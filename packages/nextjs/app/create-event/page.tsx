"use client";

import { useState } from "react";

const CreateEventPage = () => {
  // Form state management
  const [formData, setFormData] = useState({
    eventName: "",
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
    location: "",
    description: "",
    capacity: "",
    tickets: "Free",
    requireApproval: false,
  });

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleCreateEvent = () => {
    console.log("Creating event:", formData);
    // TODO: Implement event creation logic
  };

  return (
    <div className="min-h-screen p-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 max-w-7xl mx-auto">
        {/* Left side - Image container */}
        <div className="flex items-start justify-center">
          <div
            className="w-96 h-96 bg-base-300/20 border-2 border-dashed border-white/30 rounded-xl flex items-center justify-center cursor-pointer hover:border-white/50 transition-colors"
            style={{ width: "384px", height: "384px" }}
          >
            <div className="text-center">
              <svg
                className="w-12 h-12 text-white/60 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <p className="text-white/60">Add Event Image</p>
            </div>
          </div>
        </div>

        {/* Right side - Form content */}
        <div className="space-y-8">
          {/* Event Name */}
          <div className="mb-8">
            <textarea
              className="w-full bg-transparent border-0 outline-none text-white placeholder-white/60 resize-none"
              spellCheck="false"
              autoCapitalize="words"
              placeholder="Event Name"
              maxLength={140}
              style={{
                height: "54px !important",
                fontSize: "3rem !important",
                fontWeight: "900 !important",
                lineHeight: "1 !important",
                padding: "5px !important",
                backgroundColor: "transparent !important",
                border: "none !important",
                outline: "none !important",
                boxShadow: "none !important",
                overflow: "hidden !important",
              }}
              value={formData.eventName}
              onChange={e => handleInputChange("eventName", e.target.value)}
            />
          </div>

          {/* Date and Time Section */}
          <div className="mb-8">
            <div className="flex items-center gap-6 mb-6">
              {/* Start Time */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full border-2 border-white/60"></div>
                  <span className="text-white/80 font-medium">Start</span>
                </div>
                <div className="flex gap-3">
                  <input
                    type="date"
                    className="input bg-base-300/80 border-accent/30 text-white rounded-xl px-4 py-3 min-w-[140px] backdrop-blur-sm"
                    value={formData.startDate}
                    onChange={e => handleInputChange("startDate", e.target.value)}
                  />
                  <input
                    type="time"
                    className="input bg-base-300/80 border-accent/30 text-white rounded-xl px-4 py-3 min-w-[100px] backdrop-blur-sm"
                    value={formData.startTime}
                    onChange={e => handleInputChange("startTime", e.target.value)}
                  />
                </div>
              </div>

              {/* Timezone */}
              <div className="flex items-center gap-2 ml-auto">
                <svg className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div className="text-white/80">
                  <div className="text-sm font-medium">GMT+03:00</div>
                  <div className="text-xs text-white/60">Istanbul</div>
                </div>
              </div>
            </div>

            {/* End Time */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full border-2 border-white/40"></div>
                  <span className="text-white/80 font-medium">End</span>
                </div>
                <div className="flex gap-3">
                  <input
                    type="date"
                    className="input bg-base-300/80 border-accent/30 text-white rounded-xl px-4 py-3 min-w-[140px] backdrop-blur-sm"
                    value={formData.endDate}
                    onChange={e => handleInputChange("endDate", e.target.value)}
                  />
                  <input
                    type="time"
                    className="input bg-base-300/80 border-accent/30 text-white rounded-xl px-4 py-3 min-w-[100px] backdrop-blur-sm"
                    value={formData.endTime}
                    onChange={e => handleInputChange("endTime", e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="mb-8">
            <div className="flex items-center gap-3 p-4 bg-base-300/80 rounded-xl border border-accent/30 backdrop-blur-sm">
              <svg className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <div className="flex-1">
                <div className="text-white/80 font-medium mb-1">Add Event Location</div>
                <input
                  type="text"
                  placeholder="Offline location or virtual link"
                  className="w-full bg-transparent border-none outline-none text-white/60 placeholder-white/40 text-sm"
                  value={formData.location}
                  onChange={e => handleInputChange("location", e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="mb-8">
            <div className="flex items-start gap-3 p-4 bg-base-300/80 rounded-xl border border-accent/30 backdrop-blur-sm">
              <svg className="w-5 h-5 text-white/60 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
              </svg>
              <div className="flex-1">
                <div className="text-white/80 font-medium mb-2">Add Description</div>
                <textarea
                  placeholder="Tell people more about your event"
                  className="w-full bg-transparent border-none outline-none text-white/60 placeholder-white/40 text-sm resize-none"
                  rows={3}
                  value={formData.description}
                  onChange={e => handleInputChange("description", e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Event Options */}
          <div className="mb-8">
            <h3 className="text-white/80 font-medium text-lg mb-6">Event Options</h3>

            {/* Tickets */}
            <div className="flex items-center justify-between p-4 mb-4">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
                  />
                </svg>
                <span className="text-white font-medium">Tickets</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white font-medium">{formData.tickets}</span>
                <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </div>
            </div>

            {/* Require Approval */}
            <div className="flex items-center justify-between p-4 mb-4">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                <span className="text-white font-medium">Require Approval</span>
              </div>
              <input
                type="checkbox"
                className="toggle toggle-lg"
                checked={formData.requireApproval}
                onChange={e => handleInputChange("requireApproval", e.target.checked)}
              />
            </div>

            {/* Capacity */}
            <div className="flex items-center justify-between p-4 mb-4">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
                <span className="text-white font-medium">Capacity</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Unlimited"
                  className="input bg-transparent border-none outline-none text-white placeholder-white/60 text-right w-24"
                  value={formData.capacity}
                  onChange={e => handleInputChange("capacity", e.target.value)}
                />
                <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Create Event Button */}
          <div className="mt-12">
            <button
              onClick={handleCreateEvent}
              className="btn btn-primary w-full h-14 text-lg font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200"
            >
              Create Event
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateEventPage;
