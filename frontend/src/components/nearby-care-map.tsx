"use client";

import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import { Building2, ExternalLink, LocateFixed, MapPin, Phone, Star, Stethoscope } from "lucide-react";
import { useEffect, useState } from "react";
import type { LatLngExpression } from "leaflet";

type Facility = {
  id: number;
  name: string;
  lat: number;
  lon: number;
  type: string;
  address: string;
  phone: string | null;
  website: string | null;
  specialty: string | null;
  distanceKm: number;
};

type OverpassElement = { id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const radius = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function Recenter({ center }: { center: LatLngExpression }) {
  const map = useMap();
  useEffect(() => { map.setView(center, 13); }, [center, map]);
  return null;
}

function relevantSpecialties(): string[] {
  try {
    const context = JSON.parse(localStorage.getItem("clarity-care-context") ?? "{}") as { results?: Array<{ name: string; calculated_status: string }> };
    const names = (context.results ?? []).filter((result) => result.calculated_status === "high" || result.calculated_status === "low").map((result) => result.name.toLowerCase());
    const specialties = new Set<string>(["Primary care"]);
    if (names.some((name) => name.includes("glucose"))) specialties.add("Endocrinology");
    if (names.some((name) => name.includes("tsh"))) specialties.add("Endocrinology / thyroid care");
    if (names.some((name) => name.includes("creatinine") || name.includes("urea") || name.includes("bun"))) specialties.add("Nephrology");
    if (names.some((name) => name.includes("ast") || name.includes("alt") || name.includes("bilirubin"))) specialties.add("Gastroenterology / hepatology");
    if (names.some((name) => name.includes("hemoglobin") || name.includes("wbc") || name.includes("platelet"))) specialties.add("Hematology");
    return [...specialties];
  } catch { return ["Primary care"]; }
}

export function NearbyCareMap() {
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [selected, setSelected] = useState<Facility | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const specialties = relevantSpecialties();

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      const center: [number, number] = [coords.latitude, coords.longitude];
      setPosition(center);
      const query = `[out:json][timeout:25];(nwr[amenity~"hospital|clinic|doctors"](around:10000,${coords.latitude},${coords.longitude});nwr[healthcare~"hospital|clinic|doctor"](around:10000,${coords.latitude},${coords.longitude}););out center tags;`;
      try {
        const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error("Map service unavailable");
        const data = await response.json() as { elements: OverpassElement[] };
        const mapped = data.elements.flatMap((element): Facility[] => {
          const lat = element.lat ?? element.center?.lat;
          const lon = element.lon ?? element.center?.lon;
          if (lat === undefined || lon === undefined || !element.tags?.name) return [];
          const tags = element.tags;
          const address = [tags["addr:housenumber"], tags["addr:street"], tags["addr:city"]].filter(Boolean).join(" ") || "Address not listed in OpenStreetMap";
          return [{ id: element.id, name: tags.name, lat, lon, type: tags.amenity ?? tags.healthcare ?? "healthcare", address, phone: tags.phone ?? tags["contact:phone"] ?? null, website: tags.website ?? tags["contact:website"] ?? null, specialty: tags["healthcare:speciality"] ?? null, distanceKm: distanceKm(coords.latitude, coords.longitude, lat, lon) }];
        }).sort((left, right) => left.distanceKm - right.distanceKm).slice(0, 40);
        setFacilities(mapped);
        setSelected(mapped[0] ?? null);
      } catch {
        setError("Nearby facilities could not be loaded from OpenStreetMap. Try again later.");
      } finally { setLoading(false); }
    }, () => { setError("Location access is needed to find nearby care. Enable location permission and reload this page."); setLoading(false); }, { enableHighAccuracy: false, timeout: 12000 });
  }, []);

  const reviewUrl = selected ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${selected.name} ${selected.address}`)}` : "#";
  const directionsUrl = selected ? `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${position?.[0]},${position?.[1]};${selected.lat},${selected.lon}` : "#";

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--line)] bg-white"><div className="mx-auto flex min-h-16 max-w-[1500px] items-center justify-between gap-4 px-5 py-3"><div><p className="text-xs font-bold uppercase text-[var(--teal)]">Clarity Health</p><h1 className="font-display text-2xl font-semibold text-[var(--ink)]">Nearby clinics & hospitals</h1></div><button type="button" onClick={() => window.close()} className="border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700">Close</button></div></header>
      <div className="mx-auto grid max-w-[1500px] gap-0 lg:grid-cols-[minmax(0,1fr)_390px]">
        <section className="relative min-h-[55vh] lg:min-h-[calc(100vh-65px)]">
          {position ? <MapContainer center={position} zoom={13} className="absolute inset-0 size-full"><Recenter center={position} /><TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><CircleMarker center={position} radius={9} pathOptions={{ color: "#ffffff", weight: 3, fillColor: "#147d73", fillOpacity: 1 }}><Popup>Your location</Popup></CircleMarker>{facilities.map((facility) => <CircleMarker key={`${facility.id}-${facility.lat}`} center={[facility.lat, facility.lon]} radius={selected?.id === facility.id ? 10 : 7} pathOptions={{ color: "#ffffff", weight: 2, fillColor: selected?.id === facility.id ? "#a65d14" : "#1f2f2d", fillOpacity: 1 }} eventHandlers={{ click: () => setSelected(facility) }}><Popup>{facility.name}</Popup></CircleMarker>)}</MapContainer> : <div className="grid h-full place-items-center px-6 text-center"><div><LocateFixed className="mx-auto size-8 text-teal-700" /><p className="mt-3 text-sm text-zinc-600">{loading ? "Finding your location…" : error}</p></div></div>}
        </section>
        <aside className="max-h-[calc(100vh-65px)] overflow-y-auto border-l border-[var(--line)] bg-white p-5">
          <div className="border-b border-[var(--line)] pb-5"><p className="text-xs font-bold uppercase text-[var(--teal)]">From your report context</p><div className="mt-2 flex flex-wrap gap-1">{specialties.map((specialty) => <span key={specialty} className="bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-800">{specialty}</span>)}</div><p className="mt-3 text-xs leading-5 text-zinc-500">These are discussion areas, not referrals. A primary-care clinician can help decide which specialist, if any, is appropriate.</p></div>
          {selected ? <div className="py-5"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center bg-zinc-900 text-white"><Building2 className="size-5" /></span><div><h2 className="font-display text-xl font-semibold text-zinc-900">{selected.name}</h2><p className="mt-1 text-xs capitalize text-zinc-500">{selected.type.replaceAll("_", " ")} · {selected.distanceKm.toFixed(1)} km</p></div></div><div className="mt-5 space-y-3 text-sm text-zinc-600"><p className="flex gap-2"><MapPin className="mt-0.5 size-4 shrink-0" />{selected.address}</p>{selected.phone && <a href={`tel:${selected.phone}`} className="flex gap-2 text-teal-700"><Phone className="size-4" />{selected.phone}</a>}{selected.specialty && <p className="flex gap-2"><Stethoscope className="size-4" />{selected.specialty}</p>}</div><div className="mt-5 grid gap-2"><a href={directionsUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center gap-2 bg-zinc-900 px-4 text-sm font-semibold text-white">Directions <ExternalLink className="size-4" /></a><a href={reviewUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center gap-2 border border-zinc-300 px-4 text-sm font-semibold text-zinc-700"><Star className="size-4" />View external reviews</a>{selected.website && <a href={selected.website} target="_blank" rel="noreferrer" className="text-center text-sm font-semibold text-teal-700">Facility website</a>}</div><p className="mt-5 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">Ratings and individual doctor reviews are not available in free OpenStreetMap data. The review link opens an external map search; verify credentials and availability yourself.</p></div> : <div className="py-8 text-center text-sm text-zinc-500">Select a facility marker to view details.</div>}
          <div className="border-t border-[var(--line)] pt-4"><h3 className="text-xs font-bold uppercase text-zinc-500">Nearest facilities</h3><div className="mt-3 space-y-2">{facilities.slice(0, 12).map((facility) => <button key={`list-${facility.id}`} type="button" onClick={() => setSelected(facility)} className={`w-full border px-3 py-3 text-left ${selected?.id === facility.id ? "border-teal-700 bg-teal-50" : "border-zinc-200 hover:bg-zinc-50"}`}><span className="block text-sm font-semibold text-zinc-900">{facility.name}</span><span className="mt-1 block text-xs text-zinc-500">{facility.distanceKm.toFixed(1)} km · {facility.type}</span></button>)}</div></div>
        </aside>
      </div>
    </main>
  );
}