import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { catStyle, shortDate, hora12 } from '../lib/format';

export const ABANCAY = [-13.6339, -72.8814];

const pin = (color = '#2f4fe0') =>
  L.divIcon({
    className: '',
    iconSize: [34, 44],
    iconAnchor: [17, 42],
    popupAnchor: [0, -38],
    html: `<svg width="34" height="44" viewBox="0 0 34 44" xmlns="http://www.w3.org/2000/svg"><path d="M17 43s15-14.6 15-26A15 15 0 0 0 2 17c0 11.4 15 26 15 26z" fill="${color}" stroke="#fff" stroke-width="2.5"/><circle cx="17" cy="17" r="6" fill="#fff"/></svg>`,
  });

const Tiles = () => (
  <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
);

export function MapView({ lat, lng, label, color, className = 'map-box' }) {
  if (lat == null || lng == null) return null;
  return (
    <div className={className}>
      <MapContainer center={[lat, lng]} zoom={16} scrollWheelZoom={false} style={{ height: '100%' }}>
        <Tiles />
        <Marker position={[lat, lng]} icon={pin(color)}>{label && <Popup>{label}</Popup>}</Marker>
      </MapContainer>
    </div>
  );
}

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) map.fitBounds(points, { padding: [40, 40], maxZoom: 15 });
    else if (points.length === 1) map.setView(points[0], 15);
  }, [map, points]);
  return null;
}

export function EventsMap({ eventos, height = 560 }) {
  const withPos = eventos.filter((e) => e.latitud != null);
  const pts = withPos.map((e) => [e.latitud, e.longitud]);
  return (
    <div className="map-box" style={{ height }}>
      <MapContainer center={ABANCAY} zoom={14} style={{ height: '100%' }}>
        <Tiles />
        <FitBounds points={pts} />
        {withPos.map((e) => (
          <Marker key={e.id} position={[e.latitud, e.longitud]} icon={pin(catStyle(e.categoria).color)}>
            <Popup>
              <div style={{ minWidth: 180 }}>
                {e.imagen && <img src={e.imagen} alt="" style={{ borderRadius: 8, marginBottom: 8, aspectRatio: '16/9', objectFit: 'cover' }} />}
                <b style={{ display: 'block', fontSize: 14 }}>{e.nombre}</b>
                <span style={{ color: '#6b7890', fontSize: 12 }}>{shortDate(e.fecha)} · {hora12(e.hora)} · {e.lugar}</span>
                <div style={{ marginTop: 6 }}><Link to={`/evento/${e.id}`} style={{ color: '#2f4fe0', fontWeight: 700 }}>Ver evento →</Link></div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

function ClickHandler({ onPick }) {
  useMapEvents({ click: (e) => onPick(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6))) });
  return null;
}
function Recenter({ center }) {
  const map = useMap();
  useEffect(() => { if (center) map.setView(center, map.getZoom()); }, [center, map]);
  return null;
}

// Selector de ubicación para el formulario de eventos
export function MapPicker({ lat, lng, onPick, center }) {
  const pos = lat != null && lng != null ? [lat, lng] : null;
  return (
    <div className="map-box sm" style={{ cursor: 'crosshair' }}>
      <MapContainer center={pos || center || ABANCAY} zoom={15} style={{ height: '100%' }}>
        <Tiles />
        <ClickHandler onPick={onPick} />
        <Recenter center={center} />
        {pos && (
          <Marker position={pos} icon={pin()} draggable
            eventHandlers={{ dragend: (e) => { const p = e.target.getLatLng(); onPick(Number(p.lat.toFixed(6)), Number(p.lng.toFixed(6))); } }} />
        )}
      </MapContainer>
    </div>
  );
}
