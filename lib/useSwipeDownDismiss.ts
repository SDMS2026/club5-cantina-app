'use client';

import { useRef, useState, useCallback } from 'react';

interface UseSwipeDownDismissOptions {
  onDismiss: () => void;
  threshold?: number;
}

export function useSwipeDownDismiss({ onDismiss, threshold = 50 }: UseSwipeDownDismissOptions) {
  const startYRef = useRef<number | null>(null);
  const currentYRef = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState<number>(0);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
    currentYRef.current = e.touches[0].clientY;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (startYRef.current === null) return;
    const currentY = e.touches[0].clientY;
    currentYRef.current = currentY;
    const delta = Math.max(0, currentY - startYRef.current);
    setDragOffset(Math.min(delta, 140));
  }, []);

  const onTouchEnd = useCallback(() => {
    if (startYRef.current !== null && currentYRef.current !== null) {
      const delta = currentYRef.current - startYRef.current;
      if (delta > threshold) {
        onDismiss();
      }
    }
    startYRef.current = null;
    currentYRef.current = null;
    setDragOffset(0);
  }, [onDismiss, threshold]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Solo botón primario
      if (e.button !== 0) return;
      startYRef.current = e.clientY;
      currentYRef.current = e.clientY;

      const onPointerMove = (moveEvt: PointerEvent) => {
        if (startYRef.current === null) return;
        currentYRef.current = moveEvt.clientY;
        const delta = Math.max(0, moveEvt.clientY - startYRef.current);
        setDragOffset(Math.min(delta, 140));
      };

      const onPointerUp = () => {
        if (startYRef.current !== null && currentYRef.current !== null) {
          const delta = currentYRef.current - startYRef.current;
          if (delta > threshold) {
            onDismiss();
          }
        }
        startYRef.current = null;
        currentYRef.current = null;
        setDragOffset(0);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    },
    [onDismiss, threshold]
  );

  return {
    dragOffset,
    style:
      dragOffset > 0
        ? {
            transform: `translateY(${dragOffset}px)`,
            transition: 'none',
          }
        : undefined,
    handleProps: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onPointerDown,
    },
  };
}
