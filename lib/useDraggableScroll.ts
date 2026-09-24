import { useRef, useState, useCallback } from 'react';

export function useDraggableScroll() {
  const ref = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const hasMovedRef = useRef(false);
  const [isDraggingState, setIsDraggingState] = useState(false);

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    startXRef.current = e.pageX - ref.current.offsetLeft;
    scrollLeftRef.current = ref.current.scrollLeft;
    setIsDraggingState(true);
  }, []);

  const onMouseLeave = useCallback(() => {
    isDraggingRef.current = false;
    setIsDraggingState(false);
  }, []);

  const onMouseUp = useCallback(() => {
    isDraggingRef.current = false;
    setIsDraggingState(false);
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !ref.current) return;
    e.preventDefault();
    const x = e.pageX - ref.current.offsetLeft;
    const walk = (x - startXRef.current) * 1.3;
    if (Math.abs(walk) > 4) {
      hasMovedRef.current = true;
    }
    ref.current.scrollLeft = scrollLeftRef.current - walk;
  }, []);

  // Handler to prevent click if user was dragging
  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (hasMovedRef.current) {
      e.stopPropagation();
      e.preventDefault();
      hasMovedRef.current = false;
    }
  }, []);

  return {
    ref,
    isDragging: isDraggingState,
    events: {
      onMouseDown,
      onMouseLeave,
      onMouseUp,
      onMouseMove,
      onClickCapture,
    },
  };
}
