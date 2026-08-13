import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import Pet from "./Pet";
import { hatchProgress, type Student } from "./types";
import { rosterCreatureById, useOwningRoster, type Roster } from "./roster";

interface Props {
  student: Student;
  onDelta?: (delta: number) => void;
  controlsDisabled?: boolean;
  hatchAt: number;
  roster: Roster;
}

export default function StudentCard({ student, onDelta, controlsDisabled = false, hatchAt, roster }: Props) {
  const [hatching, setHatching] = useState(false);
  const [displaySpecies, setDisplaySpecies] = useState(student.species);
  const previousSpecies = useRef(student.species);
  const ratio = hatchProgress(student, hatchAt);
  const owningRoster = useOwningRoster(roster, student.speciesTheme);
  const creature = rosterCreatureById(owningRoster, displaySpecies)?.creature ?? null;

  useEffect(() => {
    const before = previousSpecies.current;
    previousSpecies.current = student.species;
    if (before === null && student.species !== null) {
      setHatching(true);
      const revealTimer = window.setTimeout(() => setDisplaySpecies(student.species), 450);
      const burstTimer = window.setTimeout(() => setHatching(false), 600);
      return () => {
        window.clearTimeout(revealTimer);
        window.clearTimeout(burstTimer);
      };
    }
    setDisplaySpecies(student.species);
  }, [student.species]);

  const displayStudent = { ...student, species: displaySpecies };
  const studentDetails = [student.room ? `Room ${student.room}` : null, student.grade]
    .filter(Boolean)
    .join(" · ");

  return (
    <motion.div className="card" layout>
      <div className="card-head">
        <div>
          <div className="name">{student.name}</div>
          <div className="room">{studentDetails}</div>
        </div>
        <div className="points">{student.points}</div>
      </div>

      <Pet student={displayStudent} hatching={hatching} hatchAt={hatchAt} roster={owningRoster} />

      <div className="stage-label">{creature?.name ?? "Egg"}</div>

      {!creature && (
        <>
          <div className="progress-track">
            <motion.div
              className="progress-fill"
              animate={{ width: `${ratio * 100}%` }}
              transition={{ type: "spring", stiffness: 200, damping: 24 }}
            />
          </div>
          <div className="progress-label">
            {Math.max(hatchAt - student.points, 0)} {hatchAt - student.points === 1 ? "point" : "points"} to hatch
          </div>
        </>
      )}

      {onDelta && (
        <div className="point-controls" aria-label={`Points for ${student.name}`}>
          <button type="button" onClick={() => onDelta(-1)} disabled={controlsDisabled || student.points === 0}>Remove 1</button>
          <button type="button" onClick={() => onDelta(1)} disabled={controlsDisabled}>Add 1</button>
        </div>
      )}

    </motion.div>
  );
}
