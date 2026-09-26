import { useEffect, useRef, useState } from "react";
import { Settings, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clamp } from "@/game/flight";
import { captureUiPointer, releaseUiPointer } from "@/game/input";
import { runtime } from "@/game/runtime";
import { cn } from "@/lib/utils";
import { LOOK_SENS_MAX, LOOK_SENS_MIN, RETICLES, resetOptions, useHud, type FeatureFlags, type Reticle } from "@/store/hud";
import { TrafficMap } from "./TrafficMap";
import type { MusicId, WorldMode } from "@/game/flight";

type OverlayProps = {
  onStart: () => void;
};

function persistCruise(v: number) {
  runtime.cruise = clamp(v, 0, 1);
  useHud.getState().patch({ cruise: runtime.cruise });
  try {
    window.localStorage.setItem("drift-cruise", String(runtime.cruise));
  } catch {
    /* ignore */
  }
}

function ThrottleRail({ inky, mobile }: { inky: boolean; mobile: boolean }) {
  const cruise = useHud((s) => s.cruise);
  const rail = useRef<HTMLDivElement>(null);

  const setFromY = (clientY: number) => {
    const el = rail.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    persistCruise(1 - (clientY - r.top) / r.height);
  };

  return (
    <div className="throttle-slot pointer-events-auto touch-auto flex flex-col items-center gap-2">
      <p className={cn("font-sans text-xs tracking-[0.18em] uppercase", inky ? "text-cloud" : "text-ink")}>
        Fast
      </p>
      <div
        ref={rail}
        role="slider"
        aria-label="Speed"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(cruise * 100)}
        aria-orientation="vertical"
        tabIndex={0}
        className={cn(
          "relative cursor-ns-resize touch-none rounded-[var(--radius-pill)]",
          mobile ? "h-52 w-14" : "h-44 w-11 sm:h-52",
          inky ? "bg-cloud/15" : "bg-ink/15",
        )}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          captureUiPointer(e.pointerId);
          setFromY(e.clientY);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) setFromY(e.clientY);
        }}
        onPointerUp={(e) => {
          releaseUiPointer(e.pointerId);
        }}
        onPointerCancel={(e) => {
          releaseUiPointer(e.pointerId);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowRight") {
            e.preventDefault();
            persistCruise(cruise + 0.06);
          }
          if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
            e.preventDefault();
            persistCruise(cruise - 0.06);
          }
        }}
      >
        <div
          className={cn(
            "absolute inset-x-1/2 top-2 bottom-2 w-1 -translate-x-1/2 rounded-full",
            inky ? "bg-cloud/35" : "bg-ink/30",
          )}
        />
        <div
          className={cn(
            "absolute left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[0_6px_16px_rgba(28,40,56,0.22)]",
            mobile ? "size-11" : "size-7",
            inky ? "bg-cloud" : "bg-ink",
          )}
          style={{ top: `${(1 - cruise) * 100}%` }}
        />
      </div>
      <p className={cn("font-sans text-xs tracking-[0.18em] uppercase", inky ? "text-cloud" : "text-ink")}>
        Slow
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
          k.style.opacity = "0.9";
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
          inky ? "bg-cloud/70" : "bg-ink/55",
        )}
      />
    </div>
  );
}

const SIGHT_LABEL: Record<Reticle, string> = {
  off: "No sight",
  dot: "Dot sight",
  plus: "Plus sight",
  ring: "Ring sight",
};

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
  return (
    <div role="radiogroup" aria-label="Sight" className="flex gap-1">
      {RETICLES.map((kind) => (
        <button
          key={kind}
          type="button"
          role="radio"
          aria-checked={reticle === kind}
          aria-label={SIGHT_LABEL[kind]}
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
      className="flex h-11 w-full items-center justify-between gap-4 rounded-[var(--radius-sm)] px-1 text-left"
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
    <div className="px-1 pt-2 pb-3">
      <div className="flex items-center justify-between pb-2">
        <p className="font-sans text-xs tracking-[0.16em] text-ink-soft uppercase">Sensitivity</p>
        <span className="font-sans text-xs text-ink-soft">{Math.round(lookSens * 100)}%</span>
      </div>
      <div
        ref={rail}
        role="slider"
        aria-label="Look sensitivity"
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
        <span>Soft</span>
        <span>Quick</span>
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
              "h-11 rounded-[var(--radius-sm)] px-3 font-sans text-sm",
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

const WORLD_OPTS: { id: WorldMode; name: string }[] = [
  { id: "sky", name: "Clouds" },
  { id: "space", name: "Space" },
  { id: "reef", name: "Reef" },
];

const MUSIC_OPTS: { id: MusicId; name: string }[] = [
  { id: "off", name: "Off" },
  { id: "rain", name: "Rain" },
  { id: "bowls", name: "Bowls" },
  { id: "ocean", name: "Ocean" },
  { id: "focus", name: "Focus" },
  { id: "keys", name: "Keys" },
];

const FX_ROWS: { key: keyof FeatureFlags; label: string }[] = [
  { key: "sun", label: "Sun" },
  { key: "stars", label: "Stars" },
  { key: "haze", label: "Haze" },
  { key: "streaks", label: "Streaks" },
  { key: "airplanes", label: "Airplanes" },
  { key: "contrails", label: "Contrails" },
  { key: "throttle", label: "Throttle" },
  { key: "hud", label: "Altimeter" },
  { key: "traffic", label: "Live map" },
];

function SettingsPanel() {
  const open = useHud((s) => s.settingsOpen);
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
        aria-label="Close settings"
        className="absolute inset-0 bg-ink/40"
        onClick={() => useHud.getState().setSettingsOpen(false)}
      />
      <aside
        role="dialog"
        aria-label="Settings"
        className="fx-panel absolute top-[max(1rem,env(safe-area-inset-top))] right-[max(1rem,env(safe-area-inset-right))] flex w-72 flex-col overflow-hidden rounded-[var(--radius-xl)] bg-panel text-panel-ink shadow-[0_18px_50px_rgba(28,40,56,0.28)]"
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 className="font-display text-xl tracking-[-0.03em] italic">Options</h2>
          <button
            type="button"
            aria-label="Close options"
            className="inline-flex size-11 items-center justify-center rounded-[var(--radius-pill)] bg-ink/10 text-ink hover:bg-ink/15 [&_svg]:text-ink"
            onClick={() => useHud.getState().setSettingsOpen(false)}
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          <ChipPicker
            label="World"
            value={world}
            options={WORLD_OPTS}
            onPick={(id) => useHud.getState().setWorld(id)}
          />
          <ChipPicker
            label="Sound"
            value={music === "haze" || music === "drift" || music === "tide" || music === "void" ? "off" : music}
            options={MUSIC_OPTS}
            onPick={(id) => useHud.getState().setMusic(id)}
          />
          <p className="px-1 pb-2 font-sans text-sm text-ink-soft">
            Rain, bowls, and ocean are calm. Focus and keys are for quiet work.
          </p>
          <div className="mt-2 border-t border-ink/10 pt-1">
            <p className="px-1 pt-2 pb-1 font-sans text-xs tracking-[0.16em] text-ink-soft uppercase">Steer</p>
            <FeatureSwitch
              label="Invert look"
              checked={invertLook}
              onToggle={() => {
                const s = useHud.getState();
                s.setInvertLook(!s.invertLook);
              }}
            />
            <FeatureSwitch
              label="Invert turn"
              checked={invertTurn}
              onToggle={() => {
                const s = useHud.getState();
                s.setInvertTurn(!s.invertTurn);
              }}
            />
            <FeatureSwitch
              label="Watch"
              checked={easy}
              onToggle={() => useHud.getState().setEasy(!useHud.getState().easy)}
            />
            <SensRail />
          </div>
          <div className="mt-1 border-t border-ink/10 pt-1">
            <p className="px-1 pt-2 pb-1 font-sans text-xs tracking-[0.16em] text-ink-soft uppercase">Sky</p>
            <FeatureSwitch
              label="Night"
              checked={nightOn}
              onToggle={() => {
                const s = useHud.getState();
                s.setNightOn(!s.nightOn);
              }}
            />
            <FeatureSwitch
              label="Wind"
              checked={!muted}
              onToggle={() => {
                const s = useHud.getState();
                s.setMuted(!s.muted);
              }}
            />
            {FX_ROWS.map((row) => (
              <FeatureSwitch
                key={row.key}
                label={row.label}
                checked={fx[row.key]}
                onToggle={() => {
                  const s = useHud.getState();
                  s.setFx(row.key, !s.fx[row.key]);
                }}
              />
            ))}
          </div>
          <div className="mt-1 border-t border-ink/10 pt-1">
            <p className="px-1 pt-2 pb-2 font-sans text-xs tracking-[0.16em] text-ink-soft uppercase">Sight</p>
            <SightPicker />
          </div>
          <button
            type="button"
            className="mt-4 h-11 w-full rounded-[var(--radius-md)] text-sm text-ink-soft hover:bg-ink/8"
            onClick={() => resetOptions()}
          >
            Reset
          </button>
        </div>
      </aside>
    </div>
  );
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
  const [hint, setHint] = useState(true);

  useEffect(() => {
    if (!playing) {
      setHint(true);
      return;
    }
    const id = window.setTimeout(() => setHint(false), 9000);
    return () => window.clearTimeout(id);
  }, [playing]);

  const meters = Math.round(altitude);
  const kph = Math.round(speed * 3.6);
  const sound =
    music === "haze" || music === "drift" || music === "tide" || music === "void" ? "off" : music;
  const inky = space > 0.55 || night > 0.42 || world !== "sky";

  return (
    <div className="pointer-events-none absolute inset-0 z-10 touch-none">
      <div
        className="absolute inset-0 bg-cloud transition-opacity duration-[var(--motion-slow)] ease-[var(--ease-out)]"
        style={{ opacity: fx.haze ? inCloud * 0.22 * (1 - night) : 0 }}
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
        <div className="pointer-events-auto absolute inset-0 flex flex-col justify-end bg-linear-to-t from-ink/55 via-ink/18 to-transparent px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-16 sm:px-12 sm:pb-16">
          <div className="mx-auto w-full max-w-xl origin-bottom animate-[drift-in_var(--motion-slow)_var(--ease-out)]">
            <p className="mb-3 font-sans text-xs font-medium tracking-[0.22em] text-cloud uppercase">
              Slow flight · 1.2.1
            </p>
            <h1 className="font-display text-[clamp(3.25rem,12vw,5.5rem)] leading-[0.9] font-medium tracking-[-0.035em] text-cloud italic">
              Drift
            </h1>
            <p className="copy-desk mt-4 max-w-md text-base leading-relaxed text-cloud/90 sm:text-lg">
              Three quiet worlds. Glide the clouds, drift past planets, or float above a reef. Pick
              a calm track, then click and pull the craft.
            </p>
            <p className="copy-touch mt-4 max-w-md text-base leading-relaxed text-cloud/90 sm:text-lg">
              Three quiet worlds. Clouds, space, or a reef. Pull the craft, or drag, to steer. Slide
              the throttle to change speed.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {WORLD_OPTS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => useHud.getState().setWorld(opt.id)}
                  className={cn(
                    "h-11 rounded-[var(--radius-pill)] px-4 font-sans text-sm",
                    world === opt.id ? "bg-cloud text-ink" : "bg-cloud/15 text-cloud hover:bg-cloud/25",
                  )}
                >
                  {opt.name}
                </button>
              ))}
            </div>
            <p className="mt-4 font-sans text-xs tracking-[0.16em] text-cloud/80 uppercase">Sound</p>
            <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Sound">
              {MUSIC_OPTS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={sound === opt.id}
                  onClick={() => useHud.getState().setMusic(opt.id)}
                  className={cn(
                    "h-11 rounded-[var(--radius-pill)] px-4 font-sans text-sm",
                    sound === opt.id ? "bg-cloud text-ink" : "bg-cloud/15 text-cloud hover:bg-cloud/25",
                  )}
                >
                  {opt.name}
                </button>
              ))}
            </div>
            <button
              type="button"
              aria-pressed={easy}
              onClick={() => useHud.getState().setEasy(!easy)}
              className={cn(
                "mt-3 h-11 rounded-[var(--radius-pill)] px-4 font-sans text-sm",
                easy ? "bg-cloud text-ink" : "bg-cloud/15 text-cloud hover:bg-cloud/25",
              )}
            >
              {easy ? "Watch on" : "Watch"}
            </button>
            <p className="mt-2 max-w-md text-sm text-cloud">
              Watch levels out and glides. The map stays hidden until you turn Watch off.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-4">
              <Button type="button" onClick={onStart} aria-label="Start drifting">
                Start
              </Button>
              <p className="copy-desk max-w-[18rem] text-sm text-cloud">
                Click and pull to steer. Q and E change speed.
              </p>
              <p className="copy-touch max-w-[18rem] text-sm text-cloud">
                Pull the craft to steer. Throttle is on the right.
              </p>
              <p className="w-full text-sm text-cloud">
                What’s new (Sep 26): Sound choices are on the start screen. They still start off.
              </p>
            </div>
          </div>
        </div>
      )}

      {playing && (
        <>
          {fx.hud && (
            <div
              className={cn(
                "hud-mark absolute top-[max(1.25rem,env(safe-area-inset-top))] left-[max(1.25rem,env(safe-area-inset-left))] transition-colors duration-[var(--motion-fast)]",
                inky ? "text-cloud" : "text-ink",
              )}
            >
              <p className="font-display text-xl tracking-[-0.03em] italic sm:text-2xl">{layer}</p>
              <p className="mt-1 font-sans text-sm font-medium tabular-nums text-current">
                {meters.toLocaleString()} m
                <span className="mx-2 text-current/45">·</span>
                {kph.toLocaleString()} km/h
              </p>
              {easy && <p className="mt-1 font-sans text-xs tracking-[0.16em] uppercase">Watch</p>}
            </div>
          )}

          <p
            className={cn(
              "copy-desk hud-mark absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-1/2 max-w-[22rem] -translate-x-1/2 px-4 text-center text-xs tracking-wide transition-opacity duration-[var(--motion-slow)] ease-[var(--ease-out)] sm:text-sm",
              hint ? "opacity-100" : "opacity-0",
              inky ? "text-cloud" : "text-ink",
            )}
          >
            Click and pull the craft to steer. Scroll or drag the throttle to change speed.
          </p>
          <p
            className={cn(
              "copy-touch hud-mark absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-1/2 max-w-[22rem] -translate-x-1/2 px-4 text-center text-xs tracking-wide transition-opacity duration-[var(--motion-slow)] ease-[var(--ease-out)]",
              hint ? "opacity-100" : "opacity-0",
              inky ? "text-cloud" : "text-ink",
            )}
          >
            Pull the craft or drag to steer. Throttle is on the right.
          </p>

          {fx.throttle && <ThrottleRail inky={inky} mobile={mobile} />}
          {fx.traffic && !settingsOpen && !easy && <TrafficMap inky={inky} />}
          {playing && <StickGhost inky={inky} showCraft={!mobile} />}
        </>
      )}

      <div className="pointer-events-auto absolute top-[max(1rem,env(safe-area-inset-top))] right-[max(1rem,env(safe-area-inset-right))] z-20">
        {!settingsOpen && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => useHud.getState().setSettingsOpen(true)}
            aria-label="Open options"
            aria-expanded={false}
            className={cn(inky || !playing ? "bg-cloud/20 text-cloud" : "bg-ink/25 text-ink")}
            onPointerDown={(e) => captureUiPointer(e.pointerId)}
            onPointerUp={(e) => releaseUiPointer(e.pointerId)}
            onPointerCancel={(e) => releaseUiPointer(e.pointerId)}
          >
            <Settings className="size-5" />
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
