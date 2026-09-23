import { useEffect, useMemo, useRef, useState } from "react";
import { captureUiPointer, releaseUiPointer } from "@/game/input";
import { runtime } from "@/game/runtime";
import {
  deadReckon,
  getLiveTraffic,
  REGION_LIST,
  TRAFFIC_REGIONS,
  type LiveFlight,
  type TrafficRegionId,
  type TrafficSnapshot,
} from "@/game/traffic";
import { cn } from "@/lib/utils";
import { useHud } from "@/store/hud";

const SIZE = 232;

function project(lat: number, lon: number, originLat: number, originLon: number, distNm: number) {
  const latSpan = distNm / 60;
  const lonSpan = latSpan / Math.max(0.35, Math.cos((originLat * Math.PI) / 180));
  const x = (0.5 + (lon - originLon) / (lonSpan * 2)) * SIZE;
  const y = (0.5 - (lat - originLat) / (latSpan * 2)) * SIZE;
  return { x, y };
}

function fl(alt: number) {
  if (alt < 500) return "low";
  return `FL${Math.max(1, Math.round(alt / 100))}`;
}

export function TrafficMap({ inky }: { inky: boolean }) {
  const on = useHud((s) => s.fx.traffic);
  const [region, setRegion] = useState<TrafficRegionId>("upstate");
  const [snap, setSnap] = useState<TrafficSnapshot | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [status, setStatus] = useState<"idle" | "live" | "quiet" | "lost">("idle");
  const alive = useRef(true);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("drift-traffic-region");
      if (saved === "nyc" || saved === "chicago" || saved === "upstate") setRegion(saved);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!on) {
      runtime.traffic = null;
      return;
    }
    alive.current = true;
    let timer = 0;
    const pull = async () => {
      try {
        const next = await getLiveTraffic({ data: { region } });
        if (!alive.current) return;
        setSnap(next);
        runtime.traffic = next;
        setStatus(next.quiet ? "quiet" : "live");
      } catch {
        if (alive.current) setStatus((s) => (s === "live" ? "live" : "lost"));
      }
    };
    void pull();
    timer = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void pull();
    }, 12_000);
    return () => {
      alive.current = false;
      window.clearInterval(timer);
      runtime.traffic = null;
    };
  }, [on, region]);

  useEffect(() => {
    if (!on) return;
    const id = window.setInterval(() => setNow(Date.now()), 900);
    return () => window.clearInterval(id);
  }, [on]);

  const flights = useMemo(() => {
    if (!snap) return [];
    const dt = (now - snap.fetchedAt) / 1000;
    return snap.flights.map((f) => deadReckon(f, Math.min(dt, 20)));
  }, [snap, now]);

  const labeled = useMemo(() => {
    if (!snap) return [];
    const picked: LiveFlight[] = [];
    for (const f of flights) {
      const p = project(f.lat, f.lon, snap.lat, snap.lon, snap.dist);
      const clash = picked.some((o) => {
        const q = project(o.lat, o.lon, snap.lat, snap.lon, snap.dist);
        return Math.hypot(p.x - q.x, p.y - q.y) < 28;
      });
      if (clash) continue;
      picked.push(f);
      if (picked.length >= 7) break;
    }
    return picked;
  }, [flights, snap]);

  if (!on) return null;

  const spec = TRAFFIC_REGIONS[region];
  const originLat = snap?.lat ?? spec.lat;
  const originLon = snap?.lon ?? spec.lon;
  const dist = snap?.dist ?? spec.dist;
  const ink = inky ? "text-cloud" : "text-ink";
  const faint = inky ? "text-cloud/55" : "text-ink/50";
  const line = inky ? "stroke-cloud/30" : "stroke-ink/25";
  const fill = inky ? "fill-cloud" : "fill-ink";
  const water = inky ? "fill-cloud/12" : "fill-ink/10";
  const roster = labeled.slice(0, 4);

  return (
    <aside
      className={cn(
        "pointer-events-auto absolute bottom-[max(5.5rem,calc(env(safe-area-inset-bottom)+4.5rem))] left-[max(1rem,env(safe-area-inset-left))] z-[8] w-[13.5rem] rounded-[var(--radius-lg)] p-3",
        inky ? "bg-ink/32 text-cloud" : "bg-cloud/42 text-ink",
      )}
      aria-label="Live air traffic"
    >
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className={cn("font-sans text-xs tracking-[0.16em] uppercase", faint)}>Live sky</p>
        <p className={cn("font-sans text-xs tabular-nums", faint)}>
          {status === "idle" && "Listening"}
          {status === "live" && `${flights.length} aloft`}
          {status === "quiet" && "Radio quiet"}
          {status === "lost" && "No radio"}
        </p>
      </div>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className={cn("block h-36 w-full overflow-visible", ink)}
        role="img"
        aria-label={`${spec.name} traffic`}
      >
        <rect x="0.5" y="0.5" width={SIZE - 1} height={SIZE - 1} rx="10" className={cn("fill-none", line)} />
        {spec.water.map((w, i) => {
          const p = project(w.lat, w.lon, originLat, originLon, dist);
          const rx = (w.rx / (dist / 60)) * SIZE * 0.5;
          const ry = (w.ry / (dist / 60)) * SIZE * 0.5;
          return <ellipse key={i} cx={p.x} cy={p.y} rx={rx} ry={ry} className={water} />;
        })}
        {spec.airports.map((ap) => {
          const p = project(ap.lat, ap.lon, originLat, originLon, dist);
          if (p.x < 8 || p.x > SIZE - 8 || p.y < 8 || p.y > SIZE - 8) return null;
          return (
            <g key={ap.id} transform={`translate(${p.x},${p.y})`}>
              <circle r="2.1" className={fill} opacity="0.5" />
              <text x="5" y="3.2" className={cn("font-sans", fill)} fontSize="8" opacity="0.62">
                {ap.id}
              </text>
            </g>
          );
        })}
        {(() => {
          const h = project(spec.home.lat, spec.home.lon, originLat, originLon, dist);
          return (
            <g transform={`translate(${h.x},${h.y})`}>
              <circle r="4.5" className={cn("fill-none", line)} />
              <circle r="1.6" className={fill} />
            </g>
          );
        })()}
        {flights.map((f) => {
          const p = project(f.lat, f.lon, originLat, originLon, dist);
          if (p.x < 4 || p.x > SIZE - 4 || p.y < 4 || p.y > SIZE - 4) return null;
          return (
            <g key={f.id} transform={`translate(${p.x},${p.y}) rotate(${f.track})`}>
              <path d="M0 -5.2 L3.6 5.2 L0 2.6 L-3.6 5.2 Z" className={fill} opacity="0.88" />
            </g>
          );
        })}
      </svg>
      <ul className="mt-2 space-y-0.5">
        {roster.map((f) => (
          <li key={f.id} className="flex items-baseline justify-between gap-2 font-sans text-xs tabular-nums">
            <span>{f.callsign}</span>
            <span className={faint}>
              {fl(f.alt)}
              {f.type ? ` · ${f.type}` : ""}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap gap-1" role="radiogroup" aria-label="Map region">
        {REGION_LIST.map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={region === id}
            className={cn(
              "h-9 min-w-11 rounded-[var(--radius-sm)] px-2.5 font-sans text-xs",
              region === id
                ? inky
                  ? "bg-cloud text-ink"
                  : "bg-ink text-cloud"
                : inky
                  ? "bg-cloud/10 text-cloud/80"
                  : "bg-ink/10 text-ink/70",
            )}
            onClick={() => {
              setRegion(id);
              try {
                window.localStorage.setItem("drift-traffic-region", id);
              } catch {
                /* ignore */
              }
            }}
            onPointerDown={(e) => captureUiPointer(e.pointerId)}
            onPointerUp={(e) => releaseUiPointer(e.pointerId)}
            onPointerCancel={(e) => releaseUiPointer(e.pointerId)}
          >
            {TRAFFIC_REGIONS[id].name}
          </button>
        ))}
      </div>
    </aside>
  );
}
