
import { useRef } from "react";

/**
 * Returns [ref to IDs, function to add, and function to cleanup]
 */
export function useTimeoutManager() {
  const timeoutsRef = useRef<number[]>([]);
  const addTimeout = (id: number) => timeoutsRef.current.push(id);
  const clean = () => {
    timeoutsRef.current.forEach(id => clearTimeout(id));
    timeoutsRef.current = [];
  };
  return { timeoutsRef, addTimeout, clean };
}
