import L from 'leaflet';
import { PIN_TYPES, SHAPE_FILL_OPACITY } from './config.js';

// Pins created before area support have no shapeType: treat them as points.
export const shapeTypeOf = (pin) => pin?.shapeType || 'point';

const round = (n) => Math.round(n * 1e6) / 1e6;
const toCoords = (latlngs) => latlngs.map((ll) => ({ lat: round(ll.lat), lng: round(ll.lng) }));

/** Geometry fields for a /pins record, from a Leaflet layer (drawn or edited). */
export function geometryFromLayer(shapeType, layer) {
  if (shapeType === 'circle') {
    const c = layer.getLatLng();
    return { lat: round(c.lat), lng: round(c.lng), radiusMeters: Math.round(layer.getRadius()) };
  }
  if (shapeType === 'polygon' || shapeType === 'rectangle') {
    return { coordinates: toCoords(layer.getLatLngs()[0]) };
  }
  const p = layer.getLatLng();
  return { lat: round(p.lat), lng: round(p.lng) };
}

/** True if the record has usable geometry for its shapeType. */
export function hasGeometry(pin) {
  const t = shapeTypeOf(pin);
  if (t === 'polygon' || t === 'rectangle') {
    return Array.isArray(pin.coordinates) && pin.coordinates.filter((c) => typeof c?.lat === 'number').length >= 3;
  }
  if (t === 'circle') return typeof pin.lat === 'number' && typeof pin.radiusMeters === 'number';
  return typeof pin.lat === 'number' && typeof pin.lng === 'number';
}

export function shapeStyle(type) {
  const color = (PIN_TYPES[type] || PIN_TYPES.other).color;
  return { color, weight: 2, fillColor: color, fillOpacity: SHAPE_FILL_OPACITY, bubblingMouseEvents: false };
}

/** Leaflet layer for an area pin (polygon / rectangle / circle). */
export function areaLayer(pin) {
  const t = shapeTypeOf(pin);
  const style = shapeStyle(pin.type);
  if (t === 'circle') return L.circle([pin.lat, pin.lng], { ...style, radius: pin.radiusMeters });
  const latlngs = pin.coordinates.filter((c) => typeof c?.lat === 'number').map((c) => [c.lat, c.lng]);
  if (t === 'rectangle') return L.rectangle(L.latLngBounds(latlngs), style);
  return L.polygon(latlngs, style);
}

/** Short human description of a pin's geometry, for popups and the form. */
export function describeShape(pin) {
  const t = shapeTypeOf(pin);
  if (t === 'circle') {
    const r = pin.radiusMeters;
    return `Circle · radius ${r >= 1000 ? `${(r / 1000).toFixed(2)} km` : `${r} m`}`;
  }
  if (t === 'rectangle') return 'Rectangle area';
  if (t === 'polygon') return `Polygon · ${(pin.coordinates || []).length} points`;
  return 'Point';
}

/** A representative point (for the form's coordinate line). */
export function centerOf(pin) {
  if (shapeTypeOf(pin) === 'polygon' || shapeTypeOf(pin) === 'rectangle') {
    return L.latLngBounds(pin.coordinates.map((c) => [c.lat, c.lng])).getCenter();
  }
  return L.latLng(pin.lat, pin.lng);
}
