import {S2Cell, S2LatLng, S2RegionCoverer, Utils} from 'nodes2ts';

export const geoCell = (latitude: number, longitude: number, level = 6): bigint => {
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new RangeError('Coordinates are outside valid latitude/longitude bounds.');
  }
  return S2Cell.fromLatLng(S2LatLng.fromDegrees(latitude, longitude)).id.parentL(level).id;
};

export const coveringCells=(latitude:number,longitude:number,radiusKm:number,level=6):bigint[]=>{
  const region=Utils.calcRegionFromCenterRadius(S2LatLng.fromDegrees(latitude,longitude),radiusKm);
  return new S2RegionCoverer().setMinLevel(level).setMaxLevel(level).setMaxCells(256).getCoveringCells(region).map((cell)=>cell.id);
};
