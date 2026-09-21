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
  const selectedRef = useRef(selectedId);
  useEffect(() => { selectedRef.current = selectedId; }, [selectedId]);
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
    const draw = () => {
      layer.clearLayers(); markerIndex.clear();
      const groups = new Map<string, ProviderClientProperty[]>();
      const large = properties.length > 200;
      const size = instance.getSize();
      const cell = Math.max(64, Math.sqrt(size.x * size.y / 120));
      const bounds = instance.getBounds().pad(0.1);
      for (const property of properties) {
        if (!hasMapPoint(property.address.point)) continue;
        const point = L.latLng(property.address.point.latitude, property.address.point.longitude);
        if (large && !bounds.contains(point)) continue;
        const pixel = instance.latLngToContainerPoint(point);
        const key = large ? `${Math.floor(pixel.x / cell)},${Math.floor(pixel.y / cell)}` : `${point.lat},${point.lng}`;
        const group = groups.get(key) ?? []; group.push(property); groups.set(key, group);
      }
      for (const group of groups.values()) {
        const property = group[0];
        const title = group.length > 10 ? i18n.t("provider_clients.cluster", { count: group.length })
          : group.map(item => `${item.customerName} · ${item.address.line1}${item.address.line2 ? `, ${item.address.line2}` : ""}`).join(" / ");
        const center: L.LatLngTuple = [group.reduce((sum, item) => sum + item.address.point.latitude, 0) / group.length,
          group.reduce((sum, item) => sum + item.address.point.longitude, 0) / group.length];
        const count = group.length >= 1000 ? `${Math.round(group.length / 100) / 10}k` : group.length;
        const marker = L.marker(center, {
          title, alt: title, keyboard: true,
          icon: L.divIcon({ className: `client-map-pin${group.length > 1 ? " client-map-pin--cluster" : ""}`, html: `<span><b>${group.length > 1 ? count : "⌂"}</b></span>`, iconSize: [38, 44], iconAnchor: [19, 43] })
        }).addTo(layer);
        if (group.length > 1) {
          const spread = group.some(item => item.address.point.latitude !== property.address.point.latitude || item.address.point.longitude !== property.address.point.longitude);
          if (large && spread && instance.getZoom() < 19) {
            marker.on("click", () => instance.fitBounds(L.latLngBounds(group.map(item => L.latLng(item.address.point.latitude, item.address.point.longitude))), { padding: [30, 30], maxZoom: 19, animate: false }));
          } else {
            const options = document.createElement("div"); options.className = "client-map-shared";
            const renderPage = (page: number) => {
              options.replaceChildren();
              for (const item of group.slice(page * 50, (page + 1) * 50)) {
                const button = document.createElement("button"); button.type = "button";
                button.textContent = `${item.customerName} · ${item.address.line1}${item.address.line2 ? `, ${item.address.line2}` : ""}`;
                button.addEventListener("click", () => { onSelect(item.id); marker.closePopup(); }); options.append(button);
              }
              for (const [delta, label] of [[-1, "previous_page"], [1, "next_page"]] as const) {
                if (page + delta < 0 || (page + delta) * 50 >= group.length) continue;
                const button = document.createElement("button"); button.type = "button"; button.textContent = i18n.t(`provider_clients.${label}`);
                button.addEventListener("click", () => renderPage(page + delta)); options.append(button);
              }
            };
            renderPage(0); marker.bindPopup(options);
          }
        } else marker.on("click", () => onSelect(property.id));
        for (const item of group) markerIndex.set(item.id, marker);
        if (group.some(item => item.id === selectedRef.current)) marker.getElement()?.classList.add("client-map-pin--selected");
      }
    };
    const points = properties.filter(property => hasMapPoint(property.address.point)).map((property): L.LatLngTuple => [property.address.point.latitude, property.address.point.longitude]);
    if (points.length) instance.fitBounds(L.latLngBounds(points), { padding: [45, 45], maxZoom: 16, animate: false });
    else instance.setView([39.7532, -74.2229], 12);
    draw();
    instance.on("moveend zoomend resize", draw);
    return () => { instance.off("moveend zoomend resize", draw); layer.remove(); markerIndex.clear(); };
  }, [properties, onSelect, i18n]);

  useEffect(() => {
    markers.current.forEach((marker) => marker.getElement()?.classList.remove("client-map-pin--selected"));
    const marker = selectedId ? markers.current.get(selectedId) : undefined;
    marker?.getElement()?.classList.add("client-map-pin--selected");
    const property = properties.find(item => item.id === selectedId);
    if (property && hasMapPoint(property.address.point)) map.current?.panTo([property.address.point.latitude, property.address.point.longitude], { animate: false });
  }, [selectedId, properties, i18n]);

  return <div className="client-map-shell">
    <div className="client-map-canvas" ref={host} role="region" aria-label={i18n.t("provider_clients.map_label")} />
    <button className="client-map-fit" type="button" onClick={fit}>{i18n.t("provider_clients.fit")}</button>
    {tileError || mapError ? <p className="client-map-warning" role="status">{i18n.t(mapError ? "provider_clients.map_error" : "provider_clients.tile_error")}</p> : null}
    <div className="client-map-legend"><span><i />{i18n.t("provider_clients.legend")}</span><span><i className="selected" />{i18n.t("provider_clients.selected")}</span></div>
  </div>;
}
