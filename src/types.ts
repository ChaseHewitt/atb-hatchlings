// Shared rewards contract. Keep Student in sync with Firestore and the iOS writer.

export const HATCH_AT = 20;

export interface Student {
  id: string;
  name: string;
  room: string;
  grade: string;
  points: number;
  peak: number;
  species: string | null; // creature id, rolled once at hatch
}

export type PetStage = "egg" | "hatched";

export interface Creature {
  id: string;
  name: string;
  sprite: { src: string; frames: number; fps: number };
}

const CREATURE_NAMES = [
  "Berrydrop", "Breezeflick", "Bubblo", "Bumblebop", "Buzzy",
  "Cuddlebean", "Cuddlebug", "Cuddlefluff", "Cuddlequill", "Dewdrop",
  "Doodlebug", "Doodlewink", "Fluffernut", "Fluffertail", "Fluffin",
  "Fluffletwist", "Froodlewoo", "Froottlepuff", "Fuzzbloom", "Fuzzle",
  "Glimmer", "Glimmerpuff", "Jellybean", "Mochi", "Nibbles",
  "Nibblesnap", "Peppypaw", "Puddlehop", "Puddlewhisk", "Puffcloud",
  "Puffkin", "Puffwhisk", "Sniplet", "Snugglebug", "Snugglepuff",
  "Sparklequill", "Spriglet", "Sproutling", "Sprouty", "Thimble",
  "Tinkertail", "Tinkletoff", "Twinklepomp", "Waddlewhisk", "Wiggly",
  "Willowkin", "Zippywinkle",
] as const;

// Every creature has an equal chance. Each source strip contains 25 128px frames.
export const CREATURES: Creature[] = CREATURE_NAMES.map((name) => ({
  id: name.toLowerCase(),
  name,
  sprite: {
    src: `/sprites/${name}_idle_v1_norife_original_strip.png`,
    frames: 25,
    fps: 12,
  },
}));

export function rollCreature(): Creature {
  return CREATURES[Math.floor(Math.random() * CREATURES.length)];
}

export function creatureById(id: string | null): Creature | null {
  return CREATURES.find((creature) => creature.id === id) ?? null;
}

export function stageFor(student: Student): PetStage {
  return student.species === null ? "egg" : "hatched";
}

export function hatchProgress(student: Student, hatchAt = HATCH_AT): number {
  return Math.max(0, Math.min(student.points / hatchAt, 1));
}
