// Client helpers for the global "lineups played" counter.
// Returns null when the backend store isn't configured (so the UI can hide it).

export async function fetchPlays(): Promise<number | null> {
  try {
    const res = await fetch("/api/plays", { cache: "no-store" });
    const data = (await res.json()) as { count: number | null };
    return data.count;
  } catch {
    return null;
  }
}

export async function bumpPlays(): Promise<number | null> {
  try {
    const res = await fetch("/api/plays", { method: "POST" });
    const data = (await res.json()) as { count: number | null };
    return data.count;
  } catch {
    return null;
  }
}
