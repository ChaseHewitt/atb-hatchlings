import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import Pet from "./Pet";
import type { Student } from "./types";
import { useOwningRoster, type Roster } from "./roster";

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
  const owningRoster = useOwningRoster(roster, student.speciesTheme);

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

  return (
    <motion.div className="card" layout>
      <div className="card-head">
        <div className="name" title={student.name}>{student.name}</div>
        <div className="points">{student.points}</div>
      </div>

      <Pet student={displayStudent} hatching={hatching} hatchAt={hatchAt} roster={owningRoster} />

      {onDelta && (
        // The labels are symbols now, so each button carries its own
        // aria-label — otherwise a screen reader hears only "minus one" with
        // no idea which child it belongs to.
        <div className="point-controls">
          <button
            type="button"
            onClick={() => onDelta(-1)}
            disabled={controlsDisabled || student.points === 0}
            aria-label={`Remove a point from ${student.name}`}
          >
            −1
          </button>
          <button
            type="button"
            onClick={() => onDelta(1)}
            disabled={controlsDisabled}
            aria-label={`Add a point to ${student.name}`}
          >
            +1
          </button>
        </div>
      )}
    </motion.div>
  );
}
