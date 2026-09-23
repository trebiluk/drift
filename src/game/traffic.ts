import { createServerFn } from "@tanstack/react-start";

export type TrafficRegionId = "upstate" | "nyc" | "chicago";

export type TrafficAirport = { id: string; name: string; lat: number; lon: number };

export type LiveFlight = {
  id: string;
  callsign: string;
  lat: number;
  lon: number;
  alt: number;
  gs: number;
  track: number;
  type: string;
};

export type TrafficSnapshot = {
  region: TrafficRegionId;
  name: string;
  lat: number;
  lon: number;
  dist: number;
  fetchedAt: number;
  flights: LiveFlight[];
  quiet: boolean;
};

export type WaterBlob = { lat: number; lon: number; rx: number; ry: number };

export const TRAFFIC_REGIONS: Record<
  TrafficRegionId,
  {
    name: string;
    lat: number;
    lon: number;
    dist: number;
    airports: TrafficAirport[];
    home: { lat: number; lon: number };
    water: WaterBlob[];
  }
> = {
  upstate: {
    name: "Upstate",
    lat: 43.16,
    lon: -76.33,
    dist: 150,
    home: { lat: 43.159, lon: -76.333 },
    airports: [
      { id: "SYR", name: "Syracuse", lat: 43.111, lon: -76.106 },
      { id: "BUF", name: "Buffalo", lat: 42.941, lon: -78.732 },
      { id: "ROC", name: "Rochester", lat: 43.119, lon: -77.672 },
      { id: "ITH", name: "Ithaca", lat: 42.491, lon: -76.458 },
    ],
    water: [
      { lat: 43.62, lon: -77.9, rx: 1.15, ry: 0.32 },
      { lat: 42.52, lon: -81.0, rx: 0.7, ry: 0.28 },
    ],
  },
  nyc: {
    name: "New York",
    lat: 40.7,
    lon: -73.95,
    dist: 70,
    home: { lat: 40.758, lon: -73.985 },
    airports: [
      { id: "JFK", name: "Kennedy", lat: 40.641, lon: -73.778 },
      { id: "LGA", name: "LaGuardia", lat: 40.777, lon: -73.872 },
      { id: "EWR", name: "Newark", lat: 40.69, lon: -74.174 },
    ],
    water: [
      { lat: 40.45, lon: -73.6, rx: 0.85, ry: 0.45 },
      { lat: 40.62, lon: -74.05, rx: 0.28, ry: 0.55 },
    ],
  },
  chicago: {
    name: "Chicago",
    lat: 41.9,
    lon: -87.75,
    dist: 70,
    home: { lat: 41.878, lon: -87.629 },
    airports: [
      { id: "ORD", name: "O'Hare", lat: 41.974, lon: -87.907 },
      { id: "MDW", name: "Midway", lat: 41.786, lon: -87.752 },
    ],
    water: [{ lat: 42.1, lon: -87.0, rx: 0.95, ry: 1.15 }],
  },
};

export const REGION_LIST = Object.keys(TRAFFIC_REGIONS) as TrafficRegionId[];

type AdsbCraft = {
  hex?: string;
  flight?: string;
  r?: string;
  t?: string;
  lat?: number;
  lon?: number;
  alt_baro?: number | string;
  gs?: number;
  track?: number;
};

type CacheEntry = { at: number; snap: TrafficSnapshot };

const cache = new Map<TrafficRegionId, CacheEntry>();
const CACHE_MS = 12_000;

function parseRegion(raw: unknown): TrafficRegionId {
  if (raw === "nyc" || raw === "chicago" || raw === "upstate") return raw;
  return "upstate";
}

function callsignOf(ac: AdsbCraft) {
  const flight = (ac.flight ?? "").trim().toUpperCase();
  if (flight && flight !== "NA" && !/^#[0-9A-F]+$/.test(flight)) return flight.slice(0, 8);
  const reg = (ac.r ?? "").trim().toUpperCase();
  if (reg) return reg.slice(0, 8);
  return (ac.hex ?? "UNKN").slice(0, 6).toUpperCase();
}

function altitudeFt(alt: AdsbCraft["alt_baro"]) {
  if (typeof alt === "number" && Number.isFinite(alt)) return alt;
  return 0;
}

export const getLiveTraffic = createServerFn({ method: "POST" })
  .validator((data: { region?: string } | undefined) => ({
    region: parseRegion(data?.region),
  }))
  .handler(async ({ data }): Promise<TrafficSnapshot> => {
    const region = data.region;
    const hit = cache.get(region);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.snap;

    const spec = TRAFFIC_REGIONS[region];
    const url = `https://api.adsb.lol/v2/lat/${spec.lat}/lon/${spec.lon}/dist/${spec.dist}`;
    let flights: LiveFlight[] = [];
    try {
      const res = await fetch(url, {
        headers: { accept: "application/json", "user-agent": "Drift/1.0 (slow flight overlay)" },
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const body = (await res.json()) as { ac?: AdsbCraft[] };
        const list = Array.isArray(body.ac) ? body.ac : [];
        flights = list
          .filter((ac) => typeof ac.lat === "number" && typeof ac.lon === "number")
          .map((ac) => ({
            id: (ac.hex ?? callsignOf(ac)).toLowerCase(),
            callsign: callsignOf(ac),
            lat: ac.lat as number,
            lon: ac.lon as number,
            alt: altitudeFt(ac.alt_baro),
            gs: typeof ac.gs === "number" ? ac.gs : 0,
            track: typeof ac.track === "number" ? ac.track : 0,
            type: (ac.t ?? "").trim().toUpperCase().slice(0, 4),
          }))
          .filter((f) => f.alt > 400)
          .sort((a, b) => b.alt - a.alt)
          .slice(0, 36);
      }
    } catch {
      if (hit) return hit.snap;
    }

    const snap: TrafficSnapshot = {
      region,
      name: spec.name,
      lat: spec.lat,
      lon: spec.lon,
      dist: spec.dist,
      fetchedAt: Date.now(),
      flights,
      quiet: flights.length === 0,
    };
    cache.set(region, { at: Date.now(), snap });
    return snap;
  });

export function offsetNm(lat: number, lon: number, originLat: number, originLon: number) {
  const north = (lat - originLat) * 60;
  const east = (lon - originLon) * 60 * Math.max(0.35, Math.cos((originLat * Math.PI) / 180));
  return { north, east };
}

export function deadReckon(f: LiveFlight, dtSec: number): LiveFlight {
  if (dtSec <= 0 || f.gs < 20) return f;
  const meters = f.gs * 0.514444 * dtSec;
  const dLat = meters / 111_320;
  const dLon = meters / (111_320 * Math.max(0.35, Math.cos((f.lat * Math.PI) / 180)));
  const rad = (f.track * Math.PI) / 180;
  return {
    ...f,
    lat: f.lat + dLat * Math.cos(rad),
    lon: f.lon + dLon * Math.sin(rad),
  };
}

export const NM_TO_WORLD = 7.2;
