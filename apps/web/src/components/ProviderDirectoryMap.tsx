"use client";
import { useEffect, useRef, useState } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { GeoPoint, SearchProviderResult } from "@yardmatch/contracts";
import { useI18n } from "@yardmatch/i18n/react";

export default function ProviderDirectoryMap({ results, origin, selectedId, onSelect }: { results: SearchProviderResult[]; origin: GeoPoint; selectedId?: string; onSelect: (id: string) => void }) {
  const i18n = useI18n(); const host = useRef<HTMLDivElement>(null); const map = useRef<L.Map | undefined>(undefined); const pins = useRef(new Map<string, L.Marker>()); const [error, setError] = useState(false);
  useEffect(() => {
    if (!host.current) return;
    const instance = L.map(host.current, { scrollWheelZoom: false }).setView([origin.latitude, origin.longitude], 12); map.current = instance;
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).on("tileerror", () => setError(true)).addTo(instance);
    const observer = new ResizeObserver(() => instance.invalidateSize()); observer.observe(host.current);
    return () => { observer.disconnect(); instance.remove(); map.current = undefined; };
  }, [origin.latitude, origin.longitude]);
  useEffect(() => {
    const instance = map.current; if (!instance) return;
    const layer = L.layerGroup().addTo(instance); const index = pins.current; index.clear();
    const points: L.LatLngTuple[] = [[origin.latitude, origin.longitude]];
    L.circleMarker(points[0], { radius: 7, color: "#fff", weight: 3, fillColor: "#244f3b", fillOpacity: 1 }).addTo(layer);
    results.forEach((result, i) => {
      const point: L.LatLngTuple = [result.provider.serviceArea.center.latitude, result.provider.serviceArea.center.longitude]; points.push(point);
      const marker = L.marker(point, { title: result.provider.companyName, alt: result.provider.companyName, icon: L.divIcon({ className: "journey-map-pin", html: `<span>${i + 1}</span>`, iconSize: [36, 36], iconAnchor: [18, 18] }) }).addTo(layer);
      const label = document.createElement("span"); label.textContent = result.provider.companyName; marker.bindTooltip(label); marker.on("click", () => onSelect(result.provider.id)); index.set(result.provider.id, marker);
    });
    instance.fitBounds(L.latLngBounds(points), { padding: [42, 42], maxZoom: 13, animate: false });
    return () => { layer.remove(); index.clear(); };
  }, [results, origin.latitude, origin.longitude, onSelect]);
  useEffect(() => { pins.current.forEach((marker, id) => marker.getElement()?.classList.toggle("journey-map-pin--selected", id === selectedId)); }, [selectedId]);
  return <div className="journey-map"><div ref={host} className="journey-map__canvas" role="region" aria-label={i18n.t("booking_journey.directory.map")} />{error ? <p role="status">{i18n.t("booking_journey.directory.map_error")}</p> : null}</div>;
}
