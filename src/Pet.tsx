import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { creatureById, hatchProgress, stageFor, type Student } from "./types";

interface PetProps {
  student: Student;
  hatching: boolean;
  hatchAt: number;
}

export default function Pet({ student, hatching, hatchAt }: PetProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const stageIsVisible = useInView(stageRef, { amount: 0.01 });
  const creature = creatureById(student.species);

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

  const { src, frames, fps } = creature.sprite;
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
        <Sprite src={src} frames={frames} fps={fps} />
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
        backgroundImage: `url(${src})`,
        animationDuration: `${frames / fps}s`,
        ["--frames" as string]: frames,
        ["--sprite-end" as string]: `${-(frames - 1) * 104}px`,
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
