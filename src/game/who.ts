type WhoRec = { alias: string; code: string; verified?: boolean };

type WhoApi = {
  read?: () => WhoRec | null;
  active?: () => boolean;
  mark?: (appId: string, line: string) => WhoRec | null;
};

function api(): WhoApi | null {
  if (typeof window === "undefined") return null;
  const host = window as Window & { KulibertWho?: WhoApi };
  return host.KulibertWho ?? null;
}

/** Alias from a verified TechWorks sign-in. Empty when signed out. Never typed here. */
export function signedAlias() {
  const who = api();
  if (!who?.read || !who.active?.()) return "";
  const rec = who.read();
  if (!rec?.verified || rec.code.length !== 5 || !rec.alias) return "";
  return rec.alias;
}

/** A flight mark uses the verified TechWorks code inside kw-who. No alias is turned into a code. */
export function markFlight(line: string) {
  const who = api();
  if (!who?.mark || !signedAlias()) return;
  who.mark("drift", line);
}
