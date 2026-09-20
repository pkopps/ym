"use client";

import { useEffect, useRef, useState } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { ProviderClientProperty } from "@yardmatch/contracts";
import { useI18n } from "@yardmatch/i18n/react";
import { hasMapPoint } from "../lib/provider-client-map";

type Props = { properties: ProviderClientProperty[]; selectedId?: string; onSelect: (id: string) => void };

export default function ProviderClientMap({ properties, selectedId, onSelect }: Props) {
  const i18n = useI18n();
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef(new Map<string, L.Marker>());
  const [tileError, setTileError] = useState(false);
  const [mapError, setMapError] = useState(false);
  const fit = () => {
    const points = properties.filter((property) => hasMapPoint(property.address.point))
      .map((property): L.LatLngTuple => [property.address.point.latitude, property.address.point.longitude]);
    if (points.length) map.current?.fitBounds(L.latLngBounds(points), { padding: [45, 45], maxZoom: 16, animate: false });
    else map.current?.setView([39.7532, -74.2229], 12);
  };

  useEffect(() => {
    if (!host.current) return;
    let instance: L.Map | undefined;
    let observer: ResizeObserver | undefined;
    try {
      instance = L.map(host.current, { scrollWheelZoom: false, zoomControl: false }).setView([39.7532, -74.2229], 12);
      map.current = instance;
      L.control.zoom({ position: "topright", zoomInTitle: i18n.t("provider_clients.zoom_in"), zoomOutTitle: i18n.t("provider_clients.zoom_out") }).addTo(instance);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).on("tileerror", () => setTileError(true)).addTo(instance);
      observer = new ResizeObserver(() => instance?.invalidateSize());
      observer.observe(host.current);
    } catch {
      setMapError(true);
    }
    return () => { observer?.disconnect(); instance?.remove(); map.current = null; };
  }, [i18n]);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const layer = L.layerGroup().addTo(instance);
    const markerIndex = markers.current;
    markerIndex.clear();
    // Co-located properties share a pin and expose each client in a safe DOM popup.
    const groups = new Map<string, ProviderClientProperty[]>();
    properties.forEach((property) => {
      if (!hasMapPoint(property.address.point)) return;
      const key = `${property.address.point.latitude},${property.address.point.longitude}`;
      groups.set(key, [...(groups.get(key) ?? []), property]);
    });
    groups.forEach((group) => {
      const property = group[0];
      const title = group.map((item) => `${item.customerName} · ${item.address.line1}${item.address.line2 ? `, ${item.address.line2}` : ""}`).join(" / ");
      const marker = L.marker([property.address.point.latitude, property.address.point.longitude], {
        title, alt: title, keyboard: true,
        icon: L.divIcon({ className: "client-map-pin", html: `<span><b>${group.length > 1 ? group.length : "⌂"}</b></span>`, iconSize: [38, 44], iconAnchor: [19, 43] })
      }).addTo(layer);
      if (group.length > 1) {
        const options = document.createElement("div");
        options.className = "client-map-shared";
        group.forEach((item) => {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = `${item.customerName} · ${item.address.line1}${item.address.line2 ? `, ${item.address.line2}` : ""}`;
          button.addEventListener("click", () => { onSelect(item.id); marker.closePopup(); });
          options.append(button);
        });
        marker.bindPopup(options);
      } else marker.on("click", () => onSelect(property.id));
      group.forEach((item) => markerIndex.set(item.id, marker));
    });
    const points = [...groups.values()].map((group): L.LatLngTuple => [group[0].address.point.latitude, group[0].address.point.longitude]);
    if (points.length) instance.fitBounds(L.latLngBounds(points), { padding: [45, 45], maxZoom: 16, animate: false });
    else instance.setView([39.7532, -74.2229], 12);
    return () => { layer.remove(); markerIndex.clear(); };
  }, [properties, onSelect, i18n]);

  useEffect(() => {
    markers.current.forEach((marker) => marker.getElement()?.classList.remove("client-map-pin--selected"));
    const marker = selectedId ? markers.current.get(selectedId) : undefined;
    marker?.getElement()?.classList.add("client-map-pin--selected");
    if (marker) map.current?.panTo(marker.getLatLng(), { animate: false });
  }, [selectedId, properties, i18n]);

  return <div className="client-map-shell">
    <div className="client-map-canvas" ref={host} role="region" aria-label={i18n.t("provider_clients.map_label")} />
    <button className="client-map-fit" type="button" onClick={fit}>{i18n.t("provider_clients.fit")}</button>
    {tileError || mapError ? <p className="client-map-warning" role="status">{i18n.t(mapError ? "provider_clients.map_error" : "provider_clients.tile_error")}</p> : null}
    <div className="client-map-legend"><span><i />{i18n.t("provider_clients.legend")}</span><span><i className="selected" />{i18n.t("provider_clients.selected")}</span></div>
  </div>;
}
