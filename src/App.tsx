import { useState } from "react";
import StudentCard from "./StudentCard";
import { useRewardStudents } from "./useRewardStudents";
import { useSchoolYears } from "./useSchoolYears";
import { useWorkspace } from "./useWorkspace";
import { useHatchThreshold } from "./useHatchThreshold";
import { updateReward } from "./updateReward";
import type { Student } from "./types";
import "./App.css";

export default function App() {
  const workspace = useWorkspace();

  if (workspace.status === "loading") {
    return <WorkspaceState message="Verifying workspace access…" />;
  }
  if (workspace.status === "error") {
    return <WorkspaceState message={`Could not verify workspace access: ${workspace.error ?? "Unknown error"}`} error />;
  }
  if (workspace.status === "missing" || !workspace.workspaceId) {
    return <WorkspaceState message="No school workspace is linked to this account." />;
  }

  return <WorkspaceDisplay key={workspace.workspaceId} workspaceId={workspace.workspaceId} />;
}

function WorkspaceDisplay({ workspaceId }: { workspaceId: string }) {
  const schoolYears = useSchoolYears(workspaceId);
  const hatchAt = useHatchThreshold(workspaceId);
  const rewardStudents = useRewardStudents(workspaceId, schoolYears.selectedYear?.id ?? null);
  const [isUpdatingPoints, setIsUpdatingPoints] = useState(false);
  const [pointsError, setPointsError] = useState<string | null>(null);
  const sorted = [...rewardStudents.students].sort((a, b) => a.name.localeCompare(b.name));

  async function adjustStudents(students: Student[], delta: number) {
    const yearId = schoolYears.selectedYear?.id;
    if (!yearId || isUpdatingPoints || students.length === 0) return;
    setIsUpdatingPoints(true);
    setPointsError(null);
    try {
      await Promise.all(
        students.map((student) => updateReward(workspaceId, yearId, student, delta, hatchAt)),
      );
    } catch (error) {
      setPointsError(error instanceof Error ? error.message : "Could not update points.");
    } finally {
      setIsUpdatingPoints(false);
    }
  }

  return (
    <div className="app">
      <header>
        <h1>ATB Hatchlings</h1>
        <p>One egg. One surprise creature. A classroom full of rewards.</p>
        <div className="year-picker">
          <label htmlFor="school-year">School year</label>
          <select
            id="school-year"
            value={schoolYears.overrideYearId ?? ""}
            onChange={(event) => schoolYears.selectYear(event.target.value || null)}
            disabled={schoolYears.status === "loading" || schoolYears.status === "error"}
          >
            <option value="">
              {automaticYearLabel(schoolYears.status, schoolYears.selectedYear?.name)}
            </option>
            {schoolYears.years.map((year) => (
              <option key={year.id} value={year.id}>{year.name}</option>
            ))}
          </select>
          {schoolYears.error && <div className="year-error" role="alert">Could not load school years: {schoolYears.error}</div>}
        </div>
        <div className="data-mode">Live roster · rewards update automatically</div>
      </header>

      {rewardStudents.rewardsError && (
        <div className="live-warning" role="status">
          Roster loaded, but rewards access is not enabled in Firestore rules yet.
        </div>
      )}
      {rewardStudents.rosterError && <div className="live-error" role="alert">Could not load roster: {rewardStudents.rosterError}</div>}
      {pointsError && <div className="live-error" role="alert">Could not change points: {pointsError}</div>}

      {rewardStudents.loading ? (
        <div className="display-state">Loading students…</div>
      ) : !schoolYears.selectedYear ? (
        <div className="display-state">Choose a school year to open its display.</div>
      ) : sorted.length === 0 && !rewardStudents.rosterError ? (
        <div className="display-state">No active students were found for this school year.</div>
      ) : (
        <>
          <div className="everyone-bar">
            <div>
              <strong>Everyone</strong>
              <span>Change points for the whole class</span>
            </div>
            <div className="point-controls everyone-controls" aria-label="Points for everyone">
              <button
                type="button"
                onClick={() => void adjustStudents(sorted, -1)}
                disabled={isUpdatingPoints || sorted.every((student) => student.points === 0)}
              >
                Remove 1
              </button>
              <button
                type="button"
                onClick={() => void adjustStudents(sorted, 1)}
                disabled={isUpdatingPoints}
              >
                Add 1
              </button>
            </div>
          </div>

          <div className="grid">
            {sorted.map((student) => (
              <StudentCard
                key={`${schoolYears.selectedYear?.id}:${student.id}`}
                student={student}
                hatchAt={hatchAt}
                onDelta={(delta) => void adjustStudents([student], delta)}
                controlsDisabled={isUpdatingPoints}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function WorkspaceState({ message, error = false }: { message: string; error?: boolean }) {
  return (
    <main className="app">
      <div className={error ? "live-error" : "display-state"} role={error ? "alert" : "status"}>
        {message}
      </div>
    </main>
  );
}

function automaticYearLabel(status: string, selectedName?: string): string {
  if (status === "loading") return "Loading school years…";
  if (status === "error") return "School years unavailable";
  if (!selectedName) return "No current school year";
  return `Automatic — ${selectedName}`;
}
