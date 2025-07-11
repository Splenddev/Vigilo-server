export function validateGeoProximity(userLocation, targetLocation) {
  if (
    !userLocation?.latitude ||
    !userLocation?.longitude ||
    !targetLocation?.latitude ||
    !targetLocation?.longitude ||
    !targetLocation?.radiusMeters
  ) {
    throw new Error('Invalid location or radius for geo proximity check.');
  }

  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371000; // Earth radius in meters

  const dLat = toRad(targetLocation.latitude - userLocation.latitude);
  const dLon = toRad(targetLocation.longitude - userLocation.longitude);

  const lat1 = toRad(userLocation.latitude);
  const lat2 = toRad(targetLocation.latitude);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceMeters = R * c;

  return {
    distanceMeters: Math.round(distanceMeters),
    isWithinRange: distanceMeters <= targetLocation.radiusMeters,
  };
}
