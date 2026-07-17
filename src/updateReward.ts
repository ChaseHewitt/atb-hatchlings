import type { Student } from "./types";
import { rollCreature } from "./types";

export async function updateReward(
  workspaceId: string,
  yearId: string,
  student: Student,
  delta: number,
  hatchAt: number,
): Promise<void> {
  const [{ db }, { doc, runTransaction, serverTimestamp }] = await Promise.all([
    import("./firestore"),
    import("firebase/firestore"),
  ]);
  const rewardRef = doc(
    db,
    "schools",
    workspaceId,
    "schoolYears",
    yearId,
    "rewards",
    student.id,
  );

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(rewardRef);
    const current = snapshot.data();
    const currentPoints = nonnegativeNumber(current?.points);
    const points = Math.max(0, currentPoints + delta);
    const peak = Math.max(nonnegativeNumber(current?.peak), points);
    const storedSpecies = current?.species;
    const species = typeof storedSpecies === "string" && storedSpecies
      ? storedSpecies
      : points >= hatchAt
        ? rollCreature().id
        : null;

    transaction.set(rewardRef, {
      name: student.name,
      room: student.room,
      grade: student.grade,
      points,
      peak,
      species,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  });
}

function nonnegativeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
}
