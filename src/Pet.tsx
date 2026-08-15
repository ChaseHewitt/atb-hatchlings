import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { hatchProgress, stageFor, type Student } from "./types";
import { rosterCreatureById, spriteSrc, type Roster } from "./roster";

interface PetProps {
  student: Student;
  hatching: boolean;
  hatchAt: number;
  roster: Roster;
}

export default function Pet({ student, hatching, hatchAt, roster }: PetProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const stageIsVisible = useInView(stageRef, { amount: 0.01 });
  const resolved = rosterCreatureById(roster, student.species);
  const creature = resolved?.creature ?? null;

  if (stageFor(student) === "egg" || !creature) {
    const ratio = hatchProgress(student, hatchAt);
    const wobble = 1 + ratio * 6;
    return (
      <div className="pet-stage" ref={stageRef}>
        <HatchBurst active={hatching} />
        <motion.div
          className="pet egg"
          animate={!stageIsVisible
            ? { rotate: 0, scale: 1 }
            : hatching
              ? { rotate: [0, -18, 18, -14, 14, 0], scale: [1, 1.15, 0.9, 1.1, 1] }
              : { rotate: [-wobble, wobble, -wobble] }}
          transition={hatching
            ? { duration: 0.5 }
            : { repeat: Infinity, duration: 1.8 - ratio * 1.1, ease: "easeInOut" }}
          aria-label="Egg"
        >
          <span className="egg-shine" />
          <span className="egg-spot egg-spot-one" />
          <span className="egg-spot egg-spot-two" />
        </motion.div>
      </div>
    );
  }

  // Pets hatched under an earlier theme resolve back to Classic, so the art
  // comes from the theme that actually owns the creature, not the active one.
  const src = spriteSrc(resolved!.theme, creature);
  return (
    <div className="pet-stage">
      <HatchBurst active={hatching} />
      <motion.div
        key={creature.id}
        className="pet creature"
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 13 }}
        title={creature.name}
      >
        {creature.format === "strip" ? (
          <Sprite src={src} frames={creature.frames ?? 25} fps={creature.fps ?? 12} />
        ) : (
          <img className="pet-image" src={src} alt={creature.name} draggable={false} />
        )}
      </motion.div>
    </div>
  );
}

function Sprite({ src, frames, fps }: { src: string; frames: number; fps: number }) {
  const ref = useRef<HTMLDivElement>(null);
  // The image is always present, but animation starts only after the observer
  // confirms that the sprite is actually on screen.
  const [inViewport, setInViewport] = useState(false);
  const [pageVisible, setPageVisible] = useState(() => !document.hidden);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const handlePageVisibility = () => setPageVisible(!document.hidden);
    document.addEventListener("visibilitychange", handlePageVisibility);

    if (!("IntersectionObserver" in window)) {
      setInViewport(true);
      return () => document.removeEventListener("visibilitychange", handlePageVisibility);
    }

    const observer = new IntersectionObserver(
      ([entry]) => setInViewport(entry.isIntersecting),
      { rootMargin: "0px", threshold: 0.01 },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", handlePageVisibility);
    };
  }, []);

  const shouldAnimate = inViewport && pageVisible && !reduceMotion;

  return (
    <div
      ref={ref}
      className={`sprite${shouldAnimate ? "" : " sprite-paused"}`}
      style={{
        // Quoted: an unquoted CSS url() cannot contain parentheses, so a theme
        // folder like "Animals (Christmas)" produced an invalid declaration
        // that browsers discard silently — no console error, just no sprite.
        backgroundImage: `url("${src}")`,
        animationDuration: `${frames / fps}s`,
        // One discrete step per frame, travelling the full strip width so every
        // frame gets an equal slice — including the last one, which a
        // frames-1 travel never reached.
        animationTimingFunction: `steps(${frames})`,
        ["--frames" as string]: frames,
        ["--sprite-end" as string]: `${-frames * 104}px`,
      }}
    />
  );
}

function HatchBurst({ active }: { active: boolean }) {
  return (
    <AnimatePresence>
      {active && Array.from({ length: 14 }).map((_, i) => {
        const angle = (i / 14) * Math.PI * 2;
        return (
          <motion.span
            key={i}
            className="particle"
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{
              x: Math.cos(angle) * 90,
              y: Math.sin(angle) * 90,
              opacity: 0,
              scale: 0.3,
            }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        );
      })}
    </AnimatePresence>
  );
}
