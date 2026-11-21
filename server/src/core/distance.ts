import {createHash} from 'node:crypto';

export const distanceLabel = (distanceMetres: number, viewerId: string, subjectId: string): string => {
  const pair = [viewerId, subjectId].sort().join(':');
  const digest = createHash('sha256').update(pair).digest();
  const jitterKm = digest.readUInt16BE(0) / 65_535 - 0.5;
  const distanceKm = Math.max(0, distanceMetres / 1000 + jitterKm);
  return distanceKm < 1 ? 'less than 1 km away' : `${Math.ceil(distanceKm)} km away`;
};
