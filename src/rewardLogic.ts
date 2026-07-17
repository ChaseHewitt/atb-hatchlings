import { HATCH_AT, rollCreature, type Student } from "./types";

// Applies a point delta while preserving the high-water mark and permanent pet.
// This is the reference implementation for the eventual iOS writer.
export function applyDelta(
  student: Student,
  delta: number,
  hatchAt = HATCH_AT,
): Student {
  const points = Math.max(0, student.points + delta);
  const peak = Math.max(student.peak, points);
  let species = student.species;
  if (species === null && points >= hatchAt) {
    species = rollCreature().id;
  }
  return { ...student, points, peak, species };
}
