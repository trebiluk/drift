export function detectTouchMode() {
  if (typeof window === "undefined") return false;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const noHover = window.matchMedia("(hover: none)").matches;
  const ua = /Android|webOS|iPhone|iPod|iPad|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const iPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  const narrow = window.matchMedia("(max-width: 720px)").matches;
  return (coarse && noHover) || ua || iPadOS || narrow;
}