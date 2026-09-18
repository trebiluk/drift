import { useEffect, useRef, useState } from "react";
import { Moon, Sun, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clamp } from "@/game/flight";
import { captureUiPointer, releaseUiPointer } from "@/game/input";
import { runtime } from "@/game/runtime";
import { cn } from "@/lib/utils";
import { RETICLES, useHud, type Reticle } from "@/store/hud";

type OverlayProps = {
  onStart: () => void;
  onToggleMute: () => void;
  onToggleNight: () => void;
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
    <div
      className={cn(
        "throttle-slot pointer-events-auto touch-auto flex flex-col items-center gap-2",
      )}
    >
      <p className={cn("font-sans text-[10px] tracking-[0.18em] uppercase", inky ? "text-cloud/70" : "text-ink/60")}>
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
      <p className={cn("font-sans text-[10px] tracking-[0.18em] uppercase", inky ? "text-cloud/70" : "text-ink/60")}>
        Slow
      </p>
    </div>
  );
}

function StickGhost({ inky }: { inky: boolean }) {
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
          k.style.transform = `translate(calc(-50% + ${s.x * 28}px), calc(-50% + ${-s.y * 28}px))`;
        } else {
          el.style.opacity = "0";
        }
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);

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
    return <span className={cn("relative block", box)}><span className="absolute top-1/2 left-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current" /></span>;
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

function SightPicker({ inky }: { inky: boolean }) {
  const reticle = useHud((s) => s.reticle);
  return (
    <div
      role="radiogroup"
      aria-label="Sight"
      className="flex gap-1"
    >
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
            "size-11",
            inky ? "bg-cloud/15 text-cloud" : "bg-ink/20 text-ink",
            reticle === kind ? "ring-1 ring-current/50" : "opacity-70",
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

export function Overlay({ onStart, onToggleMute, onToggleNight }: OverlayProps) {
  const playing = useHud((s) => s.playing);
  const altitude = useHud((s) => s.altitude);
  const speed = useHud((s) => s.speed);
  const layer = useHud((s) => s.layer);
  const inCloud = useHud((s) => s.inCloud);
  const space = useHud((s) => s.space);
  const muted = useHud((s) => s.muted);
  const mobile = useHud((s) => s.mobile);
  const night = useHud((s) => s.night);
  const nightOn = useHud((s) => s.nightOn);
  const reticle = useHud((s) => s.reticle);
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
  const inky = space > 0.55 || night > 0.42;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 touch-none">
      <div
        className="absolute inset-0 bg-cloud transition-opacity duration-[var(--motion-slow)] ease-[var(--ease-out)]"
        style={{ opacity: inCloud * 0.22 * (1 - night) }}
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-space transition-opacity duration-[var(--motion-slow)] ease-[var(--ease-out)]"
        style={{ opacity: space * 0.14 + inCloud * 0.22 * night }}
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
              Glide through white clouds on a bright day. Steer with your mouse or finger. Set the
              pace with the throttle, or scroll. Climb until the sky turns to space.
            </p>
            <p className="copy-touch mt-4 max-w-md text-base leading-relaxed text-cloud/90 sm:text-lg">
              Glide through white clouds on a bright day. Drag to steer. Slide the throttle to
              change speed. Climb until the sky turns to space.
            </p>
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
          <div
            className={cn(
              "absolute top-[max(1.25rem,env(safe-area-inset-top))] left-[max(1.25rem,env(safe-area-inset-left))] transition-colors duration-[var(--motion-fast)]",
              inky ? "text-cloud" : "text-ink",
            )}
          >
            <p className="font-display text-xl tracking-[-0.03em] italic sm:text-2xl">{layer}</p>
            <p className="mt-1 font-sans text-sm tabular-nums text-current/70">
              {meters.toLocaleString()} m
              <span className="mx-2 text-current/35">·</span>
              {kph.toLocaleString()} km/h
            </p>
          </div>

          <p
            className={cn(
              "copy-desk absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-1/2 max-w-[22rem] -translate-x-1/2 px-4 text-center text-xs tracking-wide transition-opacity duration-[var(--motion-slow)] ease-[var(--ease-out)] sm:text-sm",
              hint ? "opacity-100" : "opacity-0",
              inky ? "text-cloud/70" : "text-ink/65",
            )}
          >
            Scroll or drag the throttle to change speed.
          </p>
          <p
            className={cn(
              "copy-touch absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-1/2 max-w-[22rem] -translate-x-1/2 px-4 text-center text-xs tracking-wide transition-opacity duration-[var(--motion-slow)] ease-[var(--ease-out)]",
              hint ? "opacity-100" : "opacity-0",
              inky ? "text-cloud/70" : "text-ink/65",
            )}
          >
            Drag to steer. Throttle is on the right.
          </p>

          <ThrottleRail inky={inky} mobile={mobile} />
          {mobile && playing && <StickGhost inky={inky} />}
        </>
      )}

      <div className="pointer-events-auto absolute top-[max(1rem,env(safe-area-inset-top))] right-[max(1rem,env(safe-area-inset-right))] z-20 flex flex-col items-end gap-2">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onToggleNight}
            aria-label={nightOn ? "Switch to day" : "Switch to night"}
            className={cn(inky || !playing ? "bg-cloud/15 text-cloud" : "bg-ink/20 text-ink")}
            onPointerDown={(e) => captureUiPointer(e.pointerId)}
            onPointerUp={(e) => releaseUiPointer(e.pointerId)}
            onPointerCancel={(e) => releaseUiPointer(e.pointerId)}
          >
            {nightOn ? <Sun className="size-5" /> : <Moon className="size-5" />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onToggleMute}
            aria-label={muted ? "Unmute wind" : "Mute wind"}
            className={cn(inky || !playing ? "bg-cloud/15 text-cloud" : "bg-ink/20 text-ink")}
            onPointerDown={(e) => captureUiPointer(e.pointerId)}
            onPointerUp={(e) => releaseUiPointer(e.pointerId)}
            onPointerCancel={(e) => releaseUiPointer(e.pointerId)}
          >
            {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
          </Button>
        </div>
        {playing && <SightPicker inky={inky} />}
      </div>

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
