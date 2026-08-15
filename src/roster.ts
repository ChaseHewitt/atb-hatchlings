// Per-theme creature rosters.
//
// Rosters live in Firestore at appConfig/hatchlings/themes/<Theme>, published
// from a sprite folder by scripts/publish-theme.mjs. That document is the one
// source of truth: this site renders from it and the iOS app rolls a species
// from it. Keeping a second copy in either codebase is exactly what let the
// app hatch Classic pets while the site was showing another theme.
//
// Pets store the theme they hatched under, so a pet keeps its own art after
// the school switches themes. Pets predating that field are Classic, which is
// what the fallback covers.

import { useEffect, useState } from "react";
import { CREATURES } from "./types";

export interface RosterCreature {
  id: string;
  name: string;
  /** Path under the theme folder, e.g. "pikachu.gif". */
  file: string;
  format: "gif" | "strip";
  /** Strip-only: frame count and playback rate. */
  frames?: number;
  fps?: number;
}

export interface Roster {
  theme: string;
  creatures: RosterCreature[];
}

const classicRoster: Roster = {
  theme: "Classic",
  creatures: CREATURES.map((creature) => ({
    id: creature.id,
    name: creature.name,
    file: creature.sprite.src.split("/").pop() ?? "",
    format: "strip" as const,
    frames: creature.sprite.frames,
    fps: creature.sprite.fps,
  })),
};

export function spriteSrc(theme: string, creature: RosterCreature): string {
  return `/sprites/${encodeURIComponent(theme)}/${creature.file}`;
}

function validRoster(theme: string, data: unknown): Roster | null {
  if (typeof data !== "object" || data === null) return null;
  const raw = (data as { creatures?: unknown }).creatures;
  if (!Array.isArray(raw)) return null;

  const creatures: RosterCreature[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const candidate = entry as Partial<RosterCreature>;
    if (!candidate.id || !candidate.name || !candidate.file) continue;
    creatures.push({
      id: String(candidate.id),
      name: String(candidate.name),
      file: String(candidate.file),
      format: candidate.format === "strip" ? "strip" : "gif",
      frames: typeof candidate.frames === "number" ? candidate.frames : undefined,
      fps: typeof candidate.fps === "number" ? candidate.fps : undefined,
    });
  }
  return creatures.length > 0 ? { theme, creatures } : null;
}

const cache = new Map<string, Roster>();

export async function loadRoster(theme: string): Promise<Roster> {
  const cached = cache.get(theme);
  if (cached) return cached;

  try {
    const [{ db }, { doc, getDoc }] = await Promise.all([
      import("./firestore"),
      import("firebase/firestore"),
    ]);
    const snapshot = await getDoc(doc(db, "appConfig", "hatchlings", "themes", theme));
    const roster = validRoster(theme, snapshot.data()) ?? classicRoster;
    cache.set(theme, roster);
    return roster;
  } catch {
    return classicRoster;
  }
}

/** The active theme's roster, falling back to Classic until it loads. */
export function useRoster(theme: string): Roster {
  const [roster, setRoster] = useState<Roster>(classicRoster);

  useEffect(() => {
    let cancelled = false;
    void loadRoster(theme).then((loaded) => {
      if (!cancelled) setRoster(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [theme]);

  return roster;
}

export function rollFromRoster(roster: Roster): RosterCreature {
  return roster.creatures[Math.floor(Math.random() * roster.creatures.length)];
}

/**
 * Resolves a pet to the creature it actually hatched as. `owningRoster` is the
 * roster for the pet's own speciesTheme, which may differ from the active one;
 * Classic is the last resort for pets stored before themes existed.
 */
export function rosterCreatureById(
  roster: Roster,
  id: string | null,
): { creature: RosterCreature; theme: string } | null {
  if (!id) return null;
  const active = roster.creatures.find((creature) => creature.id === id);
  if (active) return { creature: active, theme: roster.theme };
  const classic = classicRoster.creatures.find((creature) => creature.id === id);
  return classic ? { creature: classic, theme: "Classic" } : null;
}

/**
 * Roster a pet should be rendered from: its own hatch-time theme when that is
 * not the active one, so switching themes never restyles existing pets.
 */
export function useOwningRoster(active: Roster, speciesTheme: string | null): Roster {
  const [owning, setOwning] = useState<Roster>(active);

  useEffect(() => {
    if (!speciesTheme || speciesTheme === active.theme) {
      setOwning(active);
      return;
    }
    let cancelled = false;
    void loadRoster(speciesTheme).then((loaded) => {
      if (!cancelled) setOwning(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [active, speciesTheme]);

  return owning;
}

/**
 * Chooses which creature each hatching student gets, preferring ones nobody in
 * the school year has yet.
 *
 * Rolling independently made duplicates the norm rather than the exception:
 * with 25 creatures and 10 students the birthday problem puts at least one
 * collision at ~88%, and past a roster's worth of students some creatures never
 * appear at all while others turn up five times. Handing out unused creatures
 * first means every creature shows up before any repeats.
 *
 * Assigning the whole batch in one pass also fixes the "add 1 to everyone"
 * case, where ten hatches fired at once would otherwise each pick from the same
 * unused pool and collide with each other.
 */
export function planHatchSpecies(
  candidates: { id: string; points: number; species: string | null }[],
  delta: number,
  hatchAt: number,
  roster: Roster,
  allStudents: { species: string | null }[],
): Map<string, string> {
  const plan = new Map<string, string>();
  const hatching = candidates.filter(
    (student) => !student.species && student.points + delta >= hatchAt,
  );
  if (hatching.length === 0 || roster.creatures.length === 0) return plan;

  const taken = new Set(
    allStudents.map((student) => student.species).filter((id): id is string => Boolean(id)),
  );
  const unused = shuffle(roster.creatures.filter((creature) => !taken.has(creature.id)));

  for (const student of hatching) {
    const next = unused.pop() ?? roster.creatures[Math.floor(Math.random() * roster.creatures.length)];
    plan.set(student.id, next.id);
  }
  return plan;
}

/** Fisher-Yates, so "unused first" doesn't mean "always in roster order". */
function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
