"use client";

import { Fragment, useEffect, useMemo } from "react";
import L from "leaflet";
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { Candidate } from "@/lib/engine/types";

function colorFor(confidence: number): string {
  return confidence >= 0.8 ? "#34d399" : confidence >= 0.5 ? "#fbbf24" : "#f87171";
}

function FitBounds({ points, mapKey }: { points: [number, number][]; mapKey: string }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) map.setView(points[0], 12);
    else map.fitBounds(L.latLngBounds(points), { padding: [32, 32] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, mapKey]);
  return null;
}

export default function MapView({ candidates }: { candidates: Candidate[] }) {
  const points = useMemo(() => candidates.map((c) => [c.latitude, c.longitude] as [number, number]), [candidates]);
  const mapKey = useMemo(() => JSON.stringify(points), [points]);

  if (candidates.length === 0) return null;

  return (
    <div className="card overflow-hidden p-0">
      <MapContainer center={[20, 0]} zoom={2} scrollWheelZoom worldCopyJump className="h-[340px] w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={points} mapKey={mapKey} />
        {candidates.map((c, i) => (
          <Fragment key={c.id}>
            <Marker
              position={[c.latitude, c.longitude]}
              icon={L.divIcon({
                className: "locus-marker",
                html: `<span class="marker-dot" style="--c:${colorFor(c.confidence)}">${i + 1}</span>`,
                iconSize: [22, 22],
                iconAnchor: [11, 11],
              })}
            >
              <Popup>
                <strong>{c.label}</strong>
                <br />
                confidence {Math.round(c.confidence * 100)}% &middot; &plusmn; {c.radiusKm} km
              </Popup>
            </Marker>
            <Circle
              center={[c.latitude, c.longitude]}
              radius={Math.max(c.radiusKm, 0.5) * 1000}
              pathOptions={{ color: colorFor(c.confidence), weight: 1, fillOpacity: 0.12 }}
            />
          </Fragment>
        ))}
      </MapContainer>
    </div>
  );
}
