"use client";

import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
  type MotionValue,
  type SpringOptions,
} from "framer-motion";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// Adapted from the supplied Dock: spring magnification with real links/buttons,
// client-coordinate pointer math, and a single keyboard stop per item.
type DockContextType = {
  mouseX: MotionValue<number>;
  spring: SpringOptions;
  magnification: number;
  distance: number;
  reduce: boolean;
};
const DockContext = createContext<DockContextType | null>(null);
const ItemContext = createContext<{
  width: MotionValue<number>;
  hovered: MotionValue<number>;
} | null>(null);
function useDock() {
  const context = useContext(DockContext);
  if (!context) throw new Error("DockItem requires Dock");
  return context;
}
function useItem() {
  const context = useContext(ItemContext);
  if (!context) throw new Error("DockIcon and DockLabel require DockItem");
  return context;
}

export function Dock({
  children,
  className,
  label = "Quick links",
  distance = 150,
  magnification = 68,
  spring = { mass: 0.1, stiffness: 150, damping: 16 },
}: {
  children: ReactNode;
  className?: string;
  label?: string;
  distance?: number;
  magnification?: number;
  spring?: SpringOptions;
}) {
  const mouseX = useMotionValue(Infinity),
    reduced = useReducedMotion();
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(hover: none)");
    const sync = () => setCoarse(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return (
    <div className="dock-scroll">
      <nav
        className={cn("app-dock", className)}
        aria-label={label}
        onPointerMove={(event) => {
          if (event.pointerType === "mouse") mouseX.set(event.clientX);
        }}
        onPointerLeave={() => mouseX.set(Infinity)}
      >
        <DockContext
          value={{
            mouseX,
            spring,
            distance,
            magnification,
            reduce: !!reduced || coarse,
          }}
        >
          {children}
        </DockContext>
      </nav>
    </div>
  );
}

export function DockItem({
  children,
  className,
  label,
  href,
  onClick,
  pressed,
  current,
  controlClassName,
}: {
  children: ReactNode;
  className?: string;
  label: string;
  href?: string;
  onClick?: () => void;
  pressed?: boolean;
  current?: boolean;
  controlClassName?: string;
}) {
  const ref = useRef<HTMLDivElement>(null),
    { mouseX, spring, distance, magnification, reduce } = useDock();
  const hovered = useMotionValue(0);
  const mouseDistance = useTransform(mouseX, (value) => {
    const rect = ref.current?.getBoundingClientRect();
    return rect ? value - rect.x - rect.width / 2 : Infinity;
  });
  const desired = useTransform(
    mouseDistance,
    [-distance, 0, distance],
    [44, magnification, 44],
  );
  const animated = useSpring(desired, spring),
    width = useTransform(animated, (value) => (reduce ? 44 : value));
  const content = (
    <ItemContext value={{ width, hovered }}>{children}</ItemContext>
  );
  return (
    <motion.div
      ref={ref}
      className={cn("dock-item", className)}
      style={{ width, height: width }}
      onHoverStart={() => hovered.set(1)}
      onHoverEnd={() => hovered.set(0)}
      onFocus={() => hovered.set(1)}
      onBlur={() => hovered.set(0)}
    >
      {href ? (
        <Link
          className={cn("dock-control", controlClassName)}
          href={href}
          prefetch={false}
          aria-label={label}
          aria-current={current ? "page" : undefined}
          onClick={onClick}
        >
          {content}
        </Link>
      ) : (
        <button
          type="button"
          className="dock-control"
          aria-label={label}
          aria-pressed={pressed}
          onClick={onClick}
        >
          {content}
        </button>
      )}
    </motion.div>
  );
}

export function DockLabel({ children }: { children: ReactNode }) {
  const { hovered } = useItem(),
    { reduce } = useDock();
  const [visible, setVisible] = useState(false);
  useEffect(
    () => hovered.on("change", (value) => setVisible(value === 1)),
    [hovered],
  );
  return (
    <AnimatePresence>
      {visible && (
        <motion.span
          className="dock-label"
          aria-hidden="true"
          initial={{ opacity: 0, y: reduce ? 0 : 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.15 }}
        >
          {children}
        </motion.span>
      )}
    </AnimatePresence>
  );
}
export function DockIcon({ children }: { children: ReactNode }) {
  const { width } = useItem(),
    iconWidth = useTransform(width, (value) => value / 2);
  return (
    <motion.span
      className="dock-icon"
      style={{ width: iconWidth, height: iconWidth }}
      aria-hidden="true"
    >
      {children}
    </motion.span>
  );
}
