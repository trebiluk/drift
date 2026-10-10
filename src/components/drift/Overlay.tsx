import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Settings, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clamp, type MusicId, type WorldMode } from "@/game/flight";
import { signedAlias } from "@/game/who";
import { previewSound } from "@/game/audio";
import { captureUiPointer, releaseUiPointer } from "@/game/input";
import { runtime } from "@/game/runtime";
import { cn } from "@/lib/utils";
import { LOOK_SENS_MAX, LOOK_SENS_MIN, RETICLES, resetOptions, useHud, type FeatureFlags, type Reticle } from "@/store/hud";
import { TrafficMap } from "./TrafficMap";
import { layerLine, line, sharedLine, type Key } from "@/game/copy";
import { noVoiceLine, speakLine, useLang } from "./LangRoot";

type OverlayProps = {
  onStart: () => void;
};

function persistDensity(v: number) {
  runtime.starDensity = clamp(v, 0.12, 1);
  try {
    window.localStorage.setItem("drift-star-density", String(runtime.starDensity));
  } catch {
    /* ignore */
  }
}

function WarpDock({ inky }: { inky: boolean }) {
  const lang = useLang();
  const [density, setDensity] = useState(runtime.starDensity);
  const [boosting, setBoosting] = useState(false);

  const endBoost = (id: number) => {
    runtime.boostHold = false;
    setBoosting(false);
    releaseUiPointer(id);
  };

  return (
    <div className="warp-dock pointer-events-auto flex flex-wrap items-center gap-2" dir="ltr">
      <label
        className={cn(
          "flex h-11 items-center gap-2 rounded-[var(--radius-pill)] px-3 font-sans text-xs tracking-[0.16em] uppercase",
          inky ? "bg-cloud/15 text-cloud" : "bg-ink/15 text-ink",
        )}
      >
        <span>{line(lang, "density")}</span>
        <input
          type="range"
          min={0.12}
          max={1}
          step={0.01}
          value={density}
          aria-label={line(lang, "density")}
          className="warp-range"
          onPointerDown={(e) => captureUiPointer(e.pointerId)}
          onPointerUp={(e) => releaseUiPointer(e.pointerId)}
          onPointerCancel={(e) => releaseUiPointer(e.pointerId)}
          onChange={(e) => {
            const next = Number(e.target.value);
            setDensity(next);
            persistDensity(next);
          }}
        />
      </label>
      <button
        type="button"
        aria-pressed={boosting}
        aria-label={line(lang, "boost")}
        className={cn(
          "h-11 rounded-[var(--radius-pill)] px-4 font-sans text-xs tracking-[0.16em] uppercase",
          boosting ? "bg-cloud text-ink" : inky ? "bg-cloud/15 text-cloud" : "bg-ink/15 text-ink",
        )}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          captureUiPointer(e.pointerId);
          runtime.boostHold = true;
          setBoosting(true);
        }}
        onPointerUp={(e) => endBoost(e.pointerId)}
        onPointerCancel={(e) => endBoost(e.pointerId)}
      >
        {line(lang, "boost")}
      </button>
    </div>
  );
}

function persistCruise(v: number) {
  runtime.cruise = clamp(v, 0, 1);
  useHud.getState().patch({ cruise: runtime.cruise });
  try {
    window.localStorage.setItem("drift-cruise", String(runtime.cruise));
  } catch {
    /* ignore */
  }
}

const NOTCHES = [0, 0.25, 0.5, 0.75, 1];

function nearestNotch(v: number) {
  let best = NOTCHES[0];
  let bestD = 2;
  for (const n of NOTCHES) {
    const d = Math.abs(n - v);
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best;
}

function stepNotch(cur: number, dir: number) {
  if (dir > 0) {
    for (const n of NOTCHES) if (n > cur + 0.02) return n;
    return 1;
  }
  for (let i = NOTCHES.length - 1; i >= 0; i--) if (NOTCHES[i] < cur - 0.02) return NOTCHES[i];
  return 0;
}

function ThrottleRail({ kph }: { kph: number }) {
  const lang = useLang();
  const cruise = useHud((s) => s.cruise);
  const rail = useRef<HTMLDivElement>(null);
  const drag = useRef({ y: 0, moved: false });

  const setFromY = (clientY: number) => {
    const el = rail.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const inset = 22;
    const span = Math.max(1, r.height - inset * 2);
    const t = (clientY - r.top - inset) / span;
    persistCruise(1 - Math.min(1, Math.max(0, t)));
  };

  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const dir = e.deltaY > 0 ? -1 : 1;
      persistCruise(stepNotch(useHud.getState().cruise, dir));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const leverTop = (t: number) => `calc(22px + ${1 - t} * (100% - 44px))`;

  return (
    <div className="throttle-slot cockpit-plate pointer-events-auto touch-auto" dir="ltr">
      <p className="cockpit-lever-label">
        <ChevronUp className="size-3.5" aria-hidden />
        <span>{line(lang, "fast")}</span>
      </p>
      <div className="throttle-row">
        <div className="throttle-bubble" style={{ top: leverTop(cruise) }}>
          {kph.toLocaleString()} km/h
        </div>
        <div
          ref={rail}
          role="slider"
          aria-label={line(lang, "speed")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(cruise * 100)}
          aria-valuetext={`${kph} km/h`}
          aria-orientation="vertical"
          tabIndex={0}
          className="throttle-track"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            captureUiPointer(e.pointerId);
            drag.current.y = e.clientY;
            drag.current.moved = false;
            setFromY(e.clientY);
          }}
          onPointerMove={(e) => {
            if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
            if (Math.abs(e.clientY - drag.current.y) > 6) drag.current.moved = true;
            setFromY(e.clientY);
          }}
          onPointerUp={(e) => {
            releaseUiPointer(e.pointerId);
            if (!drag.current.moved) persistCruise(nearestNotch(useHud.getState().cruise));
          }}
          onPointerCancel={(e) => {
            releaseUiPointer(e.pointerId);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp" || e.key === "ArrowRight") {
              e.preventDefault();
              persistCruise(stepNotch(useHud.getState().cruise, 1));
            }
            if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
              e.preventDefault();
              persistCruise(stepNotch(useHud.getState().cruise, -1));
            }
          }}
        >
          <div className="throttle-spine" />
          {NOTCHES.map((n) => (
            <span key={n} className="throttle-notch" style={{ top: leverTop(n) }} />
          ))}
          <div className="throttle-knob" style={{ top: leverTop(cruise) }}>
            <span className="throttle-grip" />
          </div>
        </div>
      </div>
      <p className="cockpit-lever-label">
        <ChevronDown className="size-3.5" aria-hidden />
        <span>{line(lang, "slowSpeed")}</span>
      </p>
    </div>
  );
}

function StickGhost({ inky, showCraft }: { inky: boolean; showCraft: boolean }) {
  const ring = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let id = 0;
    const tick = () => {
      const el = ring.current;
      const k = knob.current;
      if (el && k) {
        const s = runtime.stick;
        if (s.active) {
          el.style.opacity = "1";
          el.style.left = `${s.originX}px`;
          el.style.top = `${s.originY}px`;
          k.style.opacity = "1";
          k.style.transform = `translate(calc(-50% + ${s.x * 28}px), calc(-50% + ${-s.y * 28}px))`;
        } else if (showCraft) {
          el.style.opacity = "0.55";
          el.style.left = "50%";
          el.style.top = "50%";
          k.style.opacity = "0.55";
          k.style.transform = "translate(-50%, -50%)";
        } else {
          el.style.opacity = "0";
        }
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [showCraft]);

  return (
    <div
      ref={ring}
      className="pointer-events-none absolute size-[7.5rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cloud/35 opacity-0"
      style={{ left: 0, top: 0 }}
      aria-hidden
    >
      <div
        ref={knob}
        className={cn(
          "absolute top-1/2 left-1/2 size-11 -translate-x-1/2 -translate-y-1/2 rounded-full",
          inky ? "bg-cloud/70" : "bg-white/40",
        )}
      />
    </div>
  );
}

function SightMark({ kind, tight }: { kind: Reticle; tight?: boolean }) {
  const box = tight ? "size-4" : "size-5";
  if (kind === "off") {
    return <span className={cn("relative block", box)} />;
  }
  if (kind === "dot") {
    return (
      <span className={cn("relative block", box)}>
        <span className="absolute top-1/2 left-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current" />
      </span>
    );
  }
  if (kind === "ring") {
    return (
      <span className={cn("relative block", box)}>
        <span className="absolute top-1/2 left-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-current" />
      </span>
    );
  }
  return (
    <span className={cn("relative block", box)}>
      <span className="absolute top-0 left-1/2 h-1.5 w-px -translate-x-1/2 bg-current" />
      <span className="absolute bottom-0 left-1/2 h-1.5 w-px -translate-x-1/2 bg-current" />
      <span className="absolute top-1/2 left-0 h-px w-1.5 -translate-y-1/2 bg-current" />
      <span className="absolute top-1/2 right-0 h-px w-1.5 -translate-y-1/2 bg-current" />
    </span>
  );
}

function SightPicker() {
  const reticle = useHud((s) => s.reticle);
  const lang = useLang();
  const label: Record<Reticle, Key> = {
    off: "sightOff",
    dot: "sightDot",
    plus: "sightPlus",
    ring: "sightRing",
  };
  return (
    <div role="radiogroup" aria-label={line(lang, "sight")} className="flex gap-1">
      {RETICLES.map((kind) => (
        <button
          key={kind}
          type="button"
          role="radio"
          aria-checked={reticle === kind}
          aria-label={line(lang, label[kind])}
          onClick={() => useHud.getState().setReticle(kind)}
          className={cn(
            "inline-flex size-11 items-center justify-center rounded-[var(--radius-pill)] bg-ink/10 text-ink",
            reticle === kind ? "ring-1 ring-ink/40" : "opacity-70",
          )}
          onPointerDown={(e) => captureUiPointer(e.pointerId)}
          onPointerUp={(e) => releaseUiPointer(e.pointerId)}
          onPointerCancel={(e) => releaseUiPointer(e.pointerId)}
        >
          {kind === "off" ? (
            <span className="relative size-4">
              <span className="absolute top-1/2 left-0 h-px w-full -translate-y-1/2 rotate-12 bg-current" />
            </span>
          ) : (
            <SightMark kind={kind} tight />
          )}
        </button>
      ))}
    </div>
  );
}

function FeatureSwitch({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      className="flex h-11 w-full items-center justify-between gap-4 rounded-[var(--radius-sm)] px-1 text-start"
      onPointerDown={(e) => captureUiPointer(e.pointerId)}
      onPointerUp={(e) => releaseUiPointer(e.pointerId)}
      onPointerCancel={(e) => releaseUiPointer(e.pointerId)}
    >
      <span className="font-sans text-sm text-panel-ink">{label}</span>
      <span className={cn("fx-switch", checked && "fx-switch-on")} aria-hidden />
    </button>
  );
}

function SensRail() {
  const lookSens = useHud((s) => s.lookSens);
  const lang = useLang();
  const rail = useRef<HTMLDivElement>(null);
  const span = LOOK_SENS_MAX - LOOK_SENS_MIN;
  const t = (lookSens - LOOK_SENS_MIN) / span;

  const setFromX = (clientX: number) => {
    const el = rail.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const next = LOOK_SENS_MIN + clamp((clientX - r.left) / r.width, 0, 1) * span;
    useHud.getState().setLookSens(next);
  };

  return (
    <div className="px-1 pt-2 pb-3" dir="ltr">
      <div className="flex items-center justify-between pb-2">
        <p className="font-sans text-xs tracking-[0.16em] text-ink-soft uppercase">{line(lang, "sensitivity")}</p>
        <span className="font-sans text-xs text-ink-soft">{Math.round(lookSens * 100)}%</span>
      </div>
      <div
        ref={rail}
        role="slider"
        aria-label={line(lang, "sensitivity")}
        aria-valuemin={Math.round(LOOK_SENS_MIN * 100)}
        aria-valuemax={Math.round(LOOK_SENS_MAX * 100)}
        aria-valuenow={Math.round(lookSens * 100)}
        aria-orientation="horizontal"
        tabIndex={0}
        className="relative h-10 cursor-ew-resize touch-none"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          captureUiPointer(e.pointerId);
          setFromX(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) setFromX(e.clientX);
        }}
        onPointerUp={(e) => releaseUiPointer(e.pointerId)}
        onPointerCancel={(e) => releaseUiPointer(e.pointerId)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowUp") {
            e.preventDefault();
            useHud.getState().setLookSens(lookSens + 0.1);
          }
          if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
            e.preventDefault();
            useHud.getState().setLookSens(lookSens - 0.1);
          }
        }}
      >
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-ink/15" />
        <div
          className="absolute top-1/2 left-0 h-1 -translate-y-1/2 rounded-full bg-ink/40"
          style={{ width: `${t * 100}%` }}
        />
        <div
          className="absolute top-1/2 size-7 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink shadow-[0_6px_16px_rgba(28,40,56,0.22)]"
          style={{ left: `${t * 100}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between font-sans text-xs text-ink-soft">
        <span>{line(lang, "soft")}</span>
        <span>{line(lang, "quick")}</span>
      </div>
    </div>
  );
}

function ChipPicker<T extends string>({
  label,
  value,
  options,
  onPick,
}: {
  label: string;
  value: T;
  options: { id: T; name: string }[];
  onPick: (id: T) => void;
}) {
  return (
    <div className="px-1 pt-2 pb-1">
      <p className="pb-2 font-sans text-xs tracking-[0.16em] text-ink-soft uppercase">{label}</p>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={value === opt.id}
            aria-label={opt.name}
            onClick={() => onPick(opt.id)}
            className={cn(
              "h-11 min-h-11 min-w-11 rounded-[var(--radius-sm)] px-3 font-sans text-sm whitespace-nowrap",
              value === opt.id ? "bg-ink text-cloud" : "bg-ink/8 text-ink-soft hover:bg-ink/10",
            )}
            onPointerDown={(e) => captureUiPointer(e.pointerId)}
            onPointerUp={(e) => releaseUiPointer(e.pointerId)}
            onPointerCancel={(e) => releaseUiPointer(e.pointerId)}
          >
            {opt.name}
          </button>
        ))}
      </div>
    </div>
  );
}

const WORLD_OPTS: { id: WorldMode; key: Key }[] = [
  { id: "sky", key: "clouds" },
  { id: "space", key: "space" },
  { id: "reef", key: "reef" },
];

const MUSIC_OPTS: { id: MusicId; key: Key }[] = [
  { id: "off", key: "off" },
  { id: "rain", key: "rain" },
  { id: "bowls", key: "bowls" },
  { id: "ocean", key: "ocean" },
  { id: "focus", key: "focus" },
  { id: "keys", key: "keys" },
];

const FX_ROWS: { key: keyof FeatureFlags; label: Key }[] = [
  { key: "sun", label: "sun" },
  { key: "stars", label: "stars" },
  { key: "haze", label: "haze" },
  { key: "streaks", label: "streaks" },
  { key: "airplanes", label: "airplanes" },
  { key: "contrails", label: "contrails" },
  { key: "throttle", label: "throttle" },
  { key: "hud", label: "altimeter" },
  { key: "traffic", label: "liveMap" },
];

function debugHud() {
  if (typeof window === "undefined") return false;
  const value = new URLSearchParams(window.location.search).get("debug");
  return value === "" || value === "1" || value === "true";
}

function SettingsPanel() {
  const open = useHud((s) => s.settingsOpen);
  const lang = useLang();
  const nightOn = useHud((s) => s.nightOn);
  const muted = useHud((s) => s.muted);
  const fx = useHud((s) => s.fx);
  const world = useHud((s) => s.world);
  const music = useHud((s) => s.music);
  const invertLook = useHud((s) => s.invertLook);
  const invertTurn = useHud((s) => s.invertTurn);
  const easy = useHud((s) => s.easy);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") useHud.getState().setSettingsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div className="pointer-events-auto absolute inset-0 z-30 touch-auto">
      <button
        type="button"
        aria-label={sharedLine("close")}
        className="absolute inset-0 bg-ink/40"
        onClick={() => useHud.getState().setSettingsOpen(false)}
      />
      <aside
        role="dialog"
        aria-label={sharedLine("settings")}
        className="fx-panel absolute top-2 left-2 flex max-h-[calc(100%-1rem)] w-72 flex-col overflow-hidden rounded-[var(--radius-xl)] bg-panel text-panel-ink shadow-[0_18px_50px_rgba(28,40,56,0.28)]"
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 className="font-display text-xl tracking-[-0.03em] italic">{sharedLine("settings")}</h2>
          <button
            type="button"
            aria-label={sharedLine("close")}
            className="inline-flex size-11 items-center justify-center rounded-[var(--radius-pill)] bg-ink/10 text-ink hover:bg-ink/15 [&_svg]:text-ink"
            onClick={() => useHud.getState().setSettingsOpen(false)}
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          <ChipPicker
            label={line(lang, "world")}
            value={world}
            options={WORLD_OPTS.map((opt) => ({ id: opt.id, name: line(lang, opt.key) }))}
            onPick={(id) => useHud.getState().setWorld(id)}
          />
          <ChipPicker
            label={sharedLine("sound")}
            value={music === "haze" || music === "drift" || music === "tide" || music === "void" ? "off" : music}
            options={MUSIC_OPTS.map((opt) => ({ id: opt.id, name: line(lang, opt.key) }))}
            onPick={(id) => {
              useHud.getState().setMusic(id);
              previewSound(id);
            }}
          />
          <p className="px-1 pb-2 font-sans text-sm text-ink-soft">{line(lang, "soundNote")}</p>
          <div className="mt-2 border-t border-ink/10 pt-1">
            <p className="px-1 pt-2 pb-1 font-sans text-xs tracking-[0.16em] text-ink-soft uppercase">{line(lang, "steer")}</p>
            <FeatureSwitch
              label={line(lang, "invertLook")}
              checked={invertLook}
              onToggle={() => {
                const s = useHud.getState();
                s.setInvertLook(!s.invertLook);
              }}
            />
            <FeatureSwitch
              label={line(lang, "invertTurn")}
              checked={invertTurn}
              onToggle={() => {
                const s = useHud.getState();
                s.setInvertTurn(!s.invertTurn);
              }}
            />
            <FeatureSwitch
              label={line(lang, "watch")}
              checked={easy}
              onToggle={() => useHud.getState().setEasy(!useHud.getState().easy)}
            />
            <SensRail />
          </div>
          <div className="mt-1 border-t border-ink/10 pt-1">
            <p className="px-1 pt-2 pb-1 font-sans text-xs tracking-[0.16em] text-ink-soft uppercase">{line(lang, "sky")}</p>
            <FeatureSwitch
              label={line(lang, "night")}
              checked={nightOn}
              onToggle={() => {
                const s = useHud.getState();
                s.setNightOn(!s.nightOn);
              }}
            />
            <FeatureSwitch
              label={line(lang, "wind")}
              checked={!muted}
              onToggle={() => {
                const s = useHud.getState();
                s.setMuted(!s.muted);
              }}
            />
            {FX_ROWS.map((row) => (
              <FeatureSwitch
                key={row.key}
                label={line(lang, row.label)}
                checked={fx[row.key]}
                onToggle={() => {
                  const s = useHud.getState();
                  s.setFx(row.key, !s.fx[row.key]);
                }}
              />
            ))}
          </div>
          <div className="mt-1 border-t border-ink/10 pt-1">
            <p className="px-1 pt-2 pb-2 font-sans text-xs tracking-[0.16em] text-ink-soft uppercase">{line(lang, "sight")}</p>
            <SightPicker />
          </div>
          <button
            type="button"
            className="mt-4 h-11 w-full rounded-[var(--radius-md)] text-sm text-ink-soft hover:bg-ink/8"
            onClick={() => resetOptions()}
          >
            {line(lang, "reset")}
          </button>
        </div>
      </aside>
    </div>
  );
}

function useOverflowCue(active: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const more = el.scrollHeight > el.clientHeight + 2 && el.scrollTop + el.clientHeight < el.scrollHeight - 2;
      setOverflowing(more);
    };
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      watch.disconnect();
    };
  }, [active]);
  return { ref, overflowing };
}

export function Overlay({ onStart }: OverlayProps) {
  const playing = useHud((s) => s.playing);
  const altitude = useHud((s) => s.altitude);
  const speed = useHud((s) => s.speed);
  const layer = useHud((s) => s.layer);
  const inCloud = useHud((s) => s.inCloud);
  const space = useHud((s) => s.space);
  const mobile = useHud((s) => s.mobile);
  const night = useHud((s) => s.night);
  const reticle = useHud((s) => s.reticle);
  const fx = useHud((s) => s.fx);
  const world = useHud((s) => s.world);
  const music = useHud((s) => s.music);
  const easy = useHud((s) => s.easy);
  const settingsOpen = useHud((s) => s.settingsOpen);
  const lang = useLang();
  const [fps, setFps] = useState(0);
  const [hint, setHint] = useState(true);
  const [alias, setAlias] = useState("");
  const [voiceNote, setVoiceNote] = useState("");
  const newsCue = useOverflowCue(!playing);
  const sideCue = useOverflowCue(!playing);

  useEffect(() => {
    setVoiceNote("");
  }, [lang]);

  useEffect(() => {
    if (!playing || !debugHud()) return;
    let frames = 0;
    let last = performance.now();
    let id = 0;
    const tick = (now: number) => {
      frames += 1;
      if (now - last >= 500) {
        setFps(Math.round((frames * 1000) / (now - last)));
        frames = 0;
        last = now;
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [playing]);

  useEffect(() => {
    const read = () => setAlias(signedAlias());
    read();
    window.addEventListener("kw-mark", read);
    window.addEventListener("storage", read);
    const id = window.setInterval(read, 1200);
    return () => {
      window.removeEventListener("kw-mark", read);
      window.removeEventListener("storage", read);
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!playing) {
      setHint(true);
      return;
    }
    const started = performance.now();
    let gone = false;
    const finish = () => {
      if (gone) return;
      gone = true;
      setHint(false);
    };
    const steerKey = (code: string) =>
      code === "KeyA" ||
      code === "KeyD" ||
      code === "KeyW" ||
      code === "KeyS" ||
      code === "ArrowLeft" ||
      code === "ArrowRight" ||
      code === "ArrowUp" ||
      code === "ArrowDown";
    const onDown = (e: PointerEvent) => {
      const t = e.target;
      if (t instanceof Element && t.closest("button, a, input, textarea, select, [role='slider'], .throttle-slot, .warp-dock")) {
        return;
      }
      finish();
    };
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      if (t instanceof Element && t.closest("[role='slider'], input, textarea, select")) return;
      if (steerKey(e.code)) finish();
    };
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey);
    const id = window.setInterval(() => {
      if (performance.now() - started >= 6000) finish();
    }, 200);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey);
      window.clearInterval(id);
    };
  }, [playing]);

  const meters = Math.round(altitude);
  const kph = Math.round(speed * 3.6);
  const sound =
    music === "haze" || music === "drift" || music === "tide" || music === "void" ? "off" : music;
  const inky = space > 0.55 || night > 0.42 || world !== "sky";

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div
        className="absolute inset-0 bg-white transition-opacity duration-200 ease-out"
        style={{ opacity: fx.haze ? Math.min(0.82, inCloud * inCloud * 0.95) * (1 - night) : 0 }}
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-space transition-opacity duration-[var(--motion-slow)] ease-[var(--ease-out)]"
        style={{ opacity: fx.haze ? space * 0.14 + inCloud * 0.22 * night : 0 }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 shadow-[inset_0_0_90px_rgba(20,60,130,0.12)]"
        aria-hidden
      />

      {playing && reticle !== "off" && (
        <div
          className={cn(
            "pointer-events-none absolute inset-0 z-[5] flex items-center justify-center",
            inky ? "text-cloud" : "text-ink",
          )}
          style={{ opacity: 0.42 + space * 0.12 - inCloud * 0.18 }}
          aria-hidden
        >
          <SightMark kind={reticle} />
        </div>
      )}

      {!playing && (
        <div className="door-sheet pointer-events-auto absolute inset-0 flex min-h-0 flex-col bg-linear-to-t from-ink/55 via-ink/18 to-transparent">
          <div className="door-flow flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pt-16 sm:px-12">
            <div className="door-flow-inner mx-auto mt-auto w-full max-w-xl origin-bottom animate-[drift-in_var(--motion-slow)_var(--ease-out)] pb-3">
              <div className="door-left">
                <div className="door-copy-col">
                  <div className="door-hero cockpit-plate">
                    <div className="door-brand">
                      <p data-version="1.12.4" className="mb-3 font-sans text-xs font-medium tracking-[0.22em] uppercase">
                        {line(lang, "slow")} · 1.12.4
                      </p>
                      {alias ? <p className="mb-3 font-sans text-sm">{alias}</p> : null}
                      <h1 className="door-title font-display text-[clamp(2.5rem,8vw,5.5rem)] leading-[0.9] font-medium tracking-[-0.035em] italic">
                        <bdi>Drift</bdi>
                      </h1>
                    </div>
                    <div className="door-lede">
                      <p data-lede="desk" className="copy-desk mt-4 max-w-md text-base leading-relaxed sm:text-lg">{line(lang, "ledeDesk")}</p>
                      <p data-lede="touch" className="copy-touch mt-4 max-w-md text-base leading-relaxed sm:text-lg">{line(lang, "ledeTouch")}</p>
                    </div>
                  </div>
                </div>
                <div ref={newsCue.ref} className={cn("door-news", newsCue.overflowing && "is-overflowing")}>
                  <p className="mt-3 max-w-md text-sm text-cloud">
                    {sharedLine("whatsNew")} (Oct 9): {line(lang, "whatsBody")}
                  </p>
                  {voiceNote ? <p className="mt-2 w-full text-sm text-cloud">{voiceNote}</p> : null}
                  <p className="copy-desk mt-3 max-w-[18rem] text-sm text-cloud">{line(lang, "hintDesk")}</p>
                  <p className="copy-touch mt-3 max-w-[18rem] text-sm text-cloud">{line(lang, "hintTouch")}</p>
                </div>
              </div>
              <div ref={sideCue.ref} className={cn("door-side", sideCue.overflowing && "is-overflowing")}>
                <div className="door-sound cockpit-plate">
                  <p className="mt-4 font-sans text-xs tracking-[0.16em] text-cloud/80 uppercase">{sharedLine("sound")}</p>
                  <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={sharedLine("sound")}>
                    {MUSIC_OPTS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        role="radio"
                        aria-checked={sound === opt.id}
                        onClick={() => {
                          useHud.getState().setMusic(opt.id);
                          previewSound(opt.id);
                        }}
                        className={cn(
                          "h-11 min-h-11 min-w-11 rounded-[var(--radius-pill)] px-4 font-sans text-sm whitespace-nowrap",
                          sound === opt.id ? "bg-cloud text-ink" : "bg-cloud/15 text-cloud hover:bg-cloud/25",
                        )}
                      >
                        {line(lang, opt.key)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="door-watch">
                  <button
                    type="button"
                    aria-pressed={easy}
                    onClick={() => useHud.getState().setEasy(!easy)}
                    className={cn(
                      "mt-3 h-11 min-h-11 min-w-11 rounded-[var(--radius-pill)] px-4 font-sans text-sm",
                      easy ? "bg-cloud text-ink" : "bg-cloud/15 text-cloud hover:bg-cloud/25",
                    )}
                  >
                    {easy ? line(lang, "watchOn") : line(lang, "watch")}
                  </button>
                  <p className="mt-2 max-w-md text-sm text-cloud">{line(lang, "watchHint")}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="door-pick shrink-0 px-6 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-12 sm:pb-8">
            <div className="door-pick-inner mx-auto flex w-full max-w-xl flex-col gap-2">
              <div className="door-world cockpit-plate flex flex-wrap gap-2" role="radiogroup" aria-label={line(lang, "world")}>
                {WORLD_OPTS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    data-world={opt.id}
                    aria-checked={world === opt.id}
                    onClick={() => useHud.getState().setWorld(opt.id)}
                    className={cn(
                      "h-11 min-h-11 min-w-11 rounded-[var(--radius-pill)] px-4 font-sans text-sm whitespace-nowrap",
                      world === opt.id ? "bg-cloud text-ink" : "bg-cloud/15 text-cloud hover:bg-cloud/25",
                    )}
                  >
                    {line(lang, opt.key)}
                  </button>
                ))}
              </div>
              <div className="door-go flex flex-wrap items-center gap-3">
                <Button type="button" onClick={onStart} aria-label={line(lang, "start")}>
                  {line(lang, "start")}
                </Button>
                <button
                  type="button"
                  className="h-11 min-h-11 min-w-11 rounded-[var(--radius-pill)] bg-cloud/15 px-4 font-sans text-sm text-cloud"
                  onClick={() => {
                    const words = line(lang, "ledeDesk");
                    speakLine(words, lang);
                    setVoiceNote(lang === "rw" || lang === "ti" ? `${words} ${noVoiceLine()}` : "");
                  }}
                >
                  {sharedLine("readAloud")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {playing && (
        <>
          {fx.hud && (
            <div className="cockpit-plate cockpit-hud absolute top-[max(4.25rem,calc(env(safe-area-inset-top)+3.75rem))] left-[max(1rem,env(safe-area-inset-left))]">
              <p className="cockpit-world">{layerLine(lang, layer)}</p>
              {alias ? <p className="cockpit-meta">{alias}</p> : null}
              <p className="cockpit-readout">
                {meters.toLocaleString()} m
                <span className="cockpit-dot">·</span>
                {kph.toLocaleString()} km/h
                {debugHud() ? (
                  <>
                    <span className="cockpit-dot">·</span>
                    {fps} fps
                  </>
                ) : null}
              </p>
              {easy && <p className="cockpit-meta">{line(lang, "watch")}</p>}
              {sound !== "off" && (
                <p className="cockpit-meta">{line(lang, MUSIC_OPTS.find((opt) => opt.id === sound)?.key || "off")}</p>
              )}
            </div>
          )}

          <div className={cn("cockpit-hint cockpit-plate", hint ? "is-on" : "is-off")} aria-hidden={!hint}>
            <p className="copy-desk">{line(lang, world === "space" ? "flySpaceDesk" : "flyDesk")}</p>
            <p className="copy-touch">{line(lang, world === "space" ? "flySpaceTouch" : "flyTouch")}</p>
          </div>

          {world === "space" && <WarpDock inky={inky} />}
          {fx.throttle && <ThrottleRail kph={kph} />}
          {fx.traffic && !settingsOpen && !easy && <TrafficMap inky={inky} />}
          {playing && <StickGhost inky={inky} showCraft={!mobile} />}
        </>
      )}

      <div className="pointer-events-auto absolute top-2 left-2 z-20">
        {!settingsOpen && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => useHud.getState().setSettingsOpen(true)}
            aria-label={sharedLine("settings")}
            aria-expanded={false}
            className="cockpit-plate h-11 min-h-11 min-w-11 gap-2 px-3"
            onPointerDown={(e) => captureUiPointer(e.pointerId)}
            onPointerUp={(e) => releaseUiPointer(e.pointerId)}
            onPointerCancel={(e) => releaseUiPointer(e.pointerId)}
          >
            <Settings className="size-5" />
            <span className="font-sans text-sm">{sharedLine("settings")}</span>
          </Button>
        )}
      </div>

      <SettingsPanel />

      <style>{`
        @keyframes drift-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-\\[drift-in_var\\(--motion-slow\\)_var\\(--ease-out\\)\\] {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
