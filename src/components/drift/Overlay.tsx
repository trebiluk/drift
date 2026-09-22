import { useEffect, useRef, useState } from "react";
import { Settings, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clamp } from "@/game/flight";
import { captureUiPointer, releaseUiPointer } from "@/game/input";
import { runtime } from "@/game/runtime";
import { cn } from "@/lib/utils";
import { RETICLES, resetOptions, useHud, type FeatureFlags, type Reticle } from "@/store/hud";
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
      <p
        className={cn(
          "font-sans text-xs tracking-[0.18em] uppercase",
          inky ? "text-cloud/70" : "text-ink/60",
        )}
      >
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
      <p
        className={cn(
          "font-sans text-xs tracking-[0.18em] uppercase",
          inky ? "text-cloud/70" : "text-ink/60",
        )}
      >
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
        <Button
          key={kind}
          type="button"
          variant="ghost"
          size="icon"
          role="radio"
          aria-checked={reticle === kind}
          aria-label={SIGHT_LABEL[kind]}
          onClick={() => useHud.getState().setReticle(kind)}
          className={cn(
            "size-11 bg-ink/10 text-panel-ink",
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
        </Button>
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
      className="flex h-10 w-full items-center justify-between gap-4 rounded-[var(--radius-sm)] px-1 text-left"
      onPointerDown={(e) => captureUiPointer(e.pointerId)}
      onPointerUp={(e) => releaseUiPointer(e.pointerId)}
      onPointerCancel={(e) => releaseUiPointer(e.pointerId)}
    >
      <span className="font-sans text-sm text-panel-ink">{label}</span>
      <span className={cn("fx-switch", checked && "fx-switch-on")} aria-hidden />
    </button>
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
              "h-9 rounded-[var(--radius-sm)] px-3 font-sans text-sm",
              value === opt.id ? "bg-ink/15 ring-1 ring-ink/35" : "bg-ink/5 text-ink-soft",
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
  { id: "haze", name: "Haze" },
  { id: "drift", name: "Drift" },
  { id: "tide", name: "Tide" },
  { id: "void", name: "Void" },
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
];

function SettingsPanel() {
  const open = useHud((s) => s.settingsOpen);
  const nightOn = useHud((s) => s.nightOn);
  const muted = useHud((s) => s.muted);
  const fx = useHud((s) => s.fx);
  const world = useHud((s) => s.world);
  const music = useHud((s) => s.music);

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
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Close options"
            className="size-11 bg-ink/10 text-panel-ink"
            onClick={() => useHud.getState().setSettingsOpen(false)}
          >
            <X className="size-5" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          <ChipPicker
            label="World"
            value={world}
            options={WORLD_OPTS}
            onPick={(id) => useHud.getState().setWorld(id)}
          />
          <ChipPicker
            label="Music"
            value={music}
            options={MUSIC_OPTS}
            onPick={(id) => useHud.getState().setMusic(id)}
          />
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
          <p className="px-1 pt-2 pb-2 font-sans text-xs tracking-[0.16em] text-ink-soft uppercase">
            Sight
          </p>
          <SightPicker />
          <button
            type="button"
            className="mt-4 h-10 w-full rounded-[var(--radius-md)] text-sm text-ink-soft"
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
        <div className="pointer-events-auto absolute inset-0 flex flex-col justify-end bg-linear-to-t from-ink/40 via-ink/10 to-transparent px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-16 sm:px-12 sm:pb-16">
          <div className="mx-auto w-full max-w-xl origin-bottom animate-[drift-in_var(--motion-slow)_var(--ease-out)]">
            <p className="mb-3 font-sans text-xs font-medium tracking-[0.22em] text-cloud/80 uppercase">
              Slow flight
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
                    "h-10 rounded-[var(--radius-pill)] px-4 font-sans text-sm",
                    world === opt.id ? "bg-cloud text-ink" : "bg-cloud/15 text-cloud",
                  )}
                >
                  {opt.name}
                </button>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button type="button" onClick={onStart} aria-label="Start drifting">
                Start
              </Button>
              <p className="copy-desk max-w-[16rem] text-sm text-cloud/75">
                WASD to steer. Q and E change speed. Shift for a burst.
              </p>
              <p className="copy-touch max-w-[16rem] text-sm text-cloud/75">
                One thumb steers. The other sets the pace.
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
                "absolute top-[max(1.25rem,env(safe-area-inset-top))] left-[max(1.25rem,env(safe-area-inset-left))] transition-colors duration-[var(--motion-fast)]",
                inky ? "text-cloud" : "text-ink",
              )}
            >
              <p className="font-display text-xl tracking-[-0.03em] italic sm:text-2xl">{layer}</p>
              <p className="mt-1 font-sans text-sm tabular-nums text-current/70">
                {meters.toLocaleString()} m<span className="mx-2 text-current/35">·</span>
                {kph.toLocaleString()} km/h
              </p>
            </div>
          )}

          <p
            className={cn(
              "copy-desk absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-1/2 max-w-[22rem] -translate-x-1/2 px-4 text-center text-xs tracking-wide transition-opacity duration-[var(--motion-slow)] ease-[var(--ease-out)] sm:text-sm",
              hint ? "opacity-100" : "opacity-0",
              inky ? "text-cloud/70" : "text-ink/65",
            )}
          >
            Click and pull the craft to steer. Scroll or drag the throttle to change speed.
          </p>
          <p
            className={cn(
              "copy-touch absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-1/2 max-w-[22rem] -translate-x-1/2 px-4 text-center text-xs tracking-wide transition-opacity duration-[var(--motion-slow)] ease-[var(--ease-out)]",
              hint ? "opacity-100" : "opacity-0",
              inky ? "text-cloud/70" : "text-ink/65",
            )}
          >
            Pull the craft or drag to steer. Throttle is on the right.
          </p>

          {fx.throttle && <ThrottleRail inky={inky} mobile={mobile} />}
          {playing && <StickGhost inky={inky} showCraft={!mobile} />}
        </>
      )}

      <div className="pointer-events-auto absolute top-[max(1rem,env(safe-area-inset-top))] right-[max(1rem,env(safe-area-inset-right))] z-20">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => useHud.getState().setSettingsOpen(!settingsOpen)}
          aria-label={settingsOpen ? "Close options" : "Open options"}
          aria-expanded={settingsOpen}
          className={cn(inky || !playing ? "bg-cloud/15 text-cloud" : "bg-ink/20 text-ink")}
          onPointerDown={(e) => captureUiPointer(e.pointerId)}
          onPointerUp={(e) => releaseUiPointer(e.pointerId)}
          onPointerCancel={(e) => releaseUiPointer(e.pointerId)}
        >
          <Settings className="size-5" />
        </Button>
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
