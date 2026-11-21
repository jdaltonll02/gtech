ALTER TABLE passport_locations ADD COLUMN geo_cell bigint;
UPDATE passport_locations SET geo_cell=0 WHERE geo_cell IS NULL;
ALTER TABLE passport_locations ALTER COLUMN geo_cell SET NOT NULL;
CREATE INDEX passport_locations_geo_cell_idx ON passport_locations(geo_cell);
