// Per-theme creature rosters.
//
// Each theme folder carries /sprites/<Theme>/manifest.json describing its own
// creatures — names, files, and how to animate them — so a theme can be a
// completely different character set, in gif or strip form, shipped by
// dropping a folder on the site. Classic's manifest is generated from the
// built-in catalog, which also serves as the fallback when a manifest is
// missing or unreachable.
//
// Already-hatched pets keep their stored species id even after the school
// switches themes: lookups fall back to the Classic catalog, so old pets keep
// rendering with their original art until a reset hands out fresh eggs.

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

export async function loadRoster(theme: string): Promise<Roster> {
  if (theme === "Classic") return classicRoster;
  try {
    const response = await fetch(`/sprites/${encodeURIComponent(theme)}/manifest.json`, {
      cache: "no-cache",
    });
    if (!response.ok) return classicRoster;
    return validRoster(theme, await response.json()) ?? classicRoster;
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
 * Finds a stored species id: the active roster first, then Classic, so pets
 * hatched under an earlier theme keep their original creature and art.
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
