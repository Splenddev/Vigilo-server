import { validateGeoProximity } from '../../../utils/geoUtils.js';

export const calculateGeoDistance = (method, location, attendance) => {
  let wasWithinRange = true;
  let distanceFromClassMeters = null;

  if (method === 'geo' && attendance.location?.latitude && location.latitude) {
    const { distanceMeters, isWithinRange } = validateGeoProximity(
      location,
      attendance.location
    );
    wasWithinRange = isWithinRange;
    distanceFromClassMeters = distanceMeters;
  }

  return { wasWithinRange, distanceFromClassMeters };
};
