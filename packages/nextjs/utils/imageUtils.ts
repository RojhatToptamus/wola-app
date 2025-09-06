/**
 * Utility functions for handling event images
 * Uses local market images with fallback to random images
 */

// Available local event cover images
const EVENT_COVER_IMAGES = [
  "/event_covers/image_1.jpeg",
  "/event_covers/image_2.jpeg",
  "/event_covers/image_3.jpeg",
  "/event_covers/image_4.jpeg",
];

export const getEventImage = (eventId: number | string, fallbackToRandom: boolean = true): string => {
  try {
    // Convert eventId to number for consistent mapping
    const id = typeof eventId === "string" ? parseInt(eventId, 10) : eventId;

    // Handle invalid IDs
    if (isNaN(id) || id < 1) {
      return fallbackToRandom ? getRandomImage() : EVENT_COVER_IMAGES[0];
    }

    // Map event ID to one of our local images using modulo
    const imageIndex = (id - 1) % EVENT_COVER_IMAGES.length;
    const localImage = EVENT_COVER_IMAGES[imageIndex];

    return localImage;
  } catch (error) {
    console.warn("Error getting event image, falling back to random:", error);
    return fallbackToRandom ? getRandomImage() : EVENT_COVER_IMAGES[0];
  }
};

export const getRandomImage = (seed?: number): string => {
  const imageId = seed || Math.floor(Math.random() * 1000) + 1;
  return `https://picsum.photos/600/400?random=${imageId}`;
};

export const isLocalEventCover = (imageUrl: string): boolean => {
  return EVENT_COVER_IMAGES.some(cover => imageUrl.includes(cover));
};
