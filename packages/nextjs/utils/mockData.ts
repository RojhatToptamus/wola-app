// Mock data for venues and organizers used across the app

export const mockVenues = [
  "Terminal Kadıköy",
  "Zorlu Center",
  "Galataport",
  "İTÜ Ayazağa Kampüsü",
  "Boğaziçi Üniversitesi",
  "Nişantaşı",
  "Beyoğlu Kültür Merkezi",
  "Kadıköy Sahil",
];

export const mockOrganizers = [
  "MetaMask Ambassadors",
  "Consensys",
  "Paribu",
  "Hyperter",
  "Linea",
  "Coinbase",
  "BuidlGuidl Istanbul",
  "Web3 Türkiye",
];

// Helper functions to get consistent mock data
export const getVenueForEvent = (eventId: string): string => {
  const index = parseInt(eventId) % mockVenues.length;
  return mockVenues[index];
};

export const getOrganizerForEvent = (eventId: string): string => {
  const index = parseInt(eventId) % mockOrganizers.length;
  return mockOrganizers[index];
};

// Get random venue/organizer (for events list)
export const getRandomVenue = (): string => mockVenues[Math.floor(Math.random() * mockVenues.length)];
export const getRandomOrganizer = (): string => mockOrganizers[Math.floor(Math.random() * mockOrganizers.length)];
