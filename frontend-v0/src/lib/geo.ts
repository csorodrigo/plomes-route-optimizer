export interface Coordinates {
  lat: number;
  lng: number;
}

export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  if (
    typeof lat1 !== "number" ||
    typeof lon1 !== "number" ||
    typeof lat2 !== "number" ||
    typeof lon2 !== "number"
  ) {
    return Number.POSITIVE_INFINITY;
  }

  const R = 6371; // earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const filterCustomersInRadius = <T extends { latitude?: number; longitude?: number }>(
  customers: T[],
  origin: Coordinates | null,
  radiusKm: number
): T[] => {
  if (!origin || radiusKm <= 0) {
    return [];
  }

  return customers.filter((customer) => {
    const { latitude, longitude } = customer;
    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return false;
    }

    const distance = calculateDistance(origin.lat, origin.lng, latitude, longitude);
    return distance <= radiusKm;
  });
};

export const isValidBrazilCoordinates = (lat?: number, lng?: number): boolean => {
  if (typeof lat !== "number" || typeof lng !== "number") {
    return false;
  }

  return lat !== 0 && lng !== 0 && lat >= -35 && lat <= 5 && lng >= -75 && lng <= -30;
};

export const kmToMeters = (km: number): number => km * 1000;

export const metersToKm = (meters: number): number => meters / 1000;
