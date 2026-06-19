"use client";

import { useState, useEffect } from "react";
import {
  Map,
  MapMarker,
  MarkerContent,
  MarkerPopup,
  MapControls,
} from "@/components/ui/map";
import type { MapViewport } from "@/components/ui/map";

interface MapComponentProps {
  lat: number | null;
  lng: number | null;
  locationName?: string;
}

const DEFAULT_LAT = -2.5;
const DEFAULT_LNG = 118;
const DEFAULT_ZOOM = 5;

export default function MapComponent({
  lat = null,
  lng = null,
  locationName = "",
}: MapComponentProps) {
  const [viewport, setViewport] = useState<MapViewport>({
    center:
      lat !== null && lng !== null ? [lng, lat] : [DEFAULT_LNG, DEFAULT_LAT],
    zoom: lat !== null && lng !== null ? 9 : DEFAULT_ZOOM,
    bearing: 0,
    pitch: 0,
  });

  useEffect(() => {
    if (lat !== null && lng !== null) {
      setViewport((prev) => ({
        ...prev,
        center: [lng, lat],
        zoom: 9,
      }));
    }
  }, [lat, lng]);

  return (
    <div className="h-[400px] w-full rounded-2xl overflow-hidden border border-slate-200 relative">
      <Map
        theme="light"
        viewport={viewport}
        onViewportChange={setViewport}
      >
        <MapControls showZoom showCompass />
        {lat !== null && lng !== null && (
          <MapMarker latitude={lat} longitude={lng}>
            <MarkerContent>
              <div className="w-7 h-7 rounded-full bg-[#00a991] border-[3px] border-white shadow-lg flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="white"
                >
                  <path d="M12 2L4 12h3v8h6v-6h2v6h6v-8h3L12 2z" />
                </svg>
              </div>
            </MarkerContent>
            <MarkerPopup>
              <div className="space-y-1 p-1">
                <p className="font-medium text-slate-800">{locationName}</p>
                <p className="text-xs text-slate-500">
                  🌊 Pusat prakiraan energi angin 7 hari
                </p>
              </div>
            </MarkerPopup>
          </MapMarker>
        )}
      </Map>
    </div>
  );
}