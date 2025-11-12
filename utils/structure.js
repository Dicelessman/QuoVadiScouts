export function normalizeStructureCoordinates(struttura) {
  const s = { ...struttura };
  if (s.coordinate && s.coordinate.lat && s.coordinate.lng) {
    s.coordinate_lat = s.coordinate_lat ?? s.coordinate.lat;
    s.coordinate_lng = s.coordinate_lng ?? s.coordinate.lng;
  } else if (s.coordinate_lat != null && s.coordinate_lng != null) {
    s.coordinate = s.coordinate ?? { lat: s.coordinate_lat, lng: s.coordinate_lng };
  }
  return s;
}

