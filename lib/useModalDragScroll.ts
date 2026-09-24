'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

// Singleton para gestión estricta del bloqueo de scroll de la página de fondo
let lockCount = 0;
let originalStyles: {
  bodyPosition: string;
  bodyTop: string;
  bodyLeft: string;
  bodyRight: string;
  bodyWidth: string;
  bodyOverflow: string;
  bodyTouchAction: string;
  bodyPaddingRight: string;
  htmlOverflow: string;
  scrollY: number;
} | null = null;

export function lockBodyScroll() {
  if (typeof window === 'undefined') return;

  if (lockCount === 0) {
    const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    originalStyles = {
      bodyPosition: document.body.style.position,
      bodyTop: document.body.style.top,
      bodyLeft: document.body.style.left,
      bodyRight: document.body.style.right,
      bodyWidth: document.body.style.width,
      bodyOverflow: document.body.style.overflow,
      bodyTouchAction: document.body.style.touchAction,
      bodyPaddingRight: document.body.style.paddingRight,
      htmlOverflow: document.documentElement.style.overflow,
      scrollY,
    };

    // Bloqueo estricto del viewport (inmune a rebotes elásticos de iOS Safari y Chrome)
    document.documentElement.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';

    // Evitar salto horizontal por desaparición del scrollbar en desktop
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
  }

  lockCount++;
}

export function unlockBodyScroll() {
  if (typeof window === 'undefined') return;

  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0 && originalStyles) {
    const {
      bodyPosition,
      bodyTop,
      bodyLeft,
      bodyRight,
      bodyWidth,
      bodyOverflow,
      bodyTouchAction,
      bodyPaddingRight,
      htmlOverflow,
      scrollY,
    } = originalStyles;

    document.documentElement.style.overflow = htmlOverflow;
    document.body.style.position = bodyPosition;
    document.body.style.top = bodyTop;
    document.body.style.left = bodyLeft;
    document.body.style.right = bodyRight;
    document.body.style.width = bodyWidth;
    document.body.style.overflow = bodyOverflow;
    document.body.style.touchAction = bodyTouchAction;
    document.body.style.paddingRight = bodyPaddingRight;

    originalStyles = null;
    window.scrollTo(0, scrollY);
  }
}

export interface UseModalDragScrollOptions {
  isOpen?: boolean;
  onDismiss?: () => void;
  thresholdDismiss?: number;
}

/**
 * Hook para permitir deslizar y arrastrar verticalmente (Drag-to-Scroll)
 * tanto con ratón/cursor en emuladores como en pantallas táctiles,
 * con bloqueo absoluto del scroll en la página de fondo (Body Scroll Lock)
 * y soporte opcional de deslizamiento hacia abajo para cerrar (Swipe down to dismiss).
 */
export function useModalDragScroll(options?: UseModalDragScrollOptions) {
  const { isOpen, onDismiss, thresholdDismiss = 65 } = options || {};

  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const scrollTopRef = useRef(0);
  const hasMovedRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const [pullDownOffset, setPullDownOffset] = useState(0);

  // 1. Bloqueo estricto del scroll de fondo mientras el modal esté abierto
  useEffect(() => {
    if (isOpen) {
      lockBodyScroll();
      return () => {
        unlockBodyScroll();
      };
    }
  }, [isOpen]);

  // 2. Mouse Drag Handlers (para emuladores y usuarios de escritorio)
  const onMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;

    // No interferir con inputs, textareas, selects o elementos editables
    const target = e.target as HTMLElement;
    if (target.closest('input, textarea, select, [contenteditable="true"]')) {
      return;
    }

    e.stopPropagation();

    const container = e.currentTarget;
    containerRef.current = container;
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    startYRef.current = e.pageY;
    scrollTopRef.current = container.scrollTop;
    setIsDragging(true);
  }, []);

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isDraggingRef.current || !containerRef.current) return;
      e.stopPropagation();

      const deltaY = e.pageY - startYRef.current;
      if (Math.abs(deltaY) > 4) {
        hasMovedRef.current = true;
        if (e.cancelable) {
          e.preventDefault();
        }
      }

      if (scrollTopRef.current <= 0 && deltaY > 0 && onDismiss) {
        setPullDownOffset(Math.min(deltaY * 0.55, 130));
      } else {
        setPullDownOffset(0);
        containerRef.current.scrollTop = scrollTopRef.current - deltaY;
      }
    },
    [onDismiss]
  );

  const onMouseUp = useCallback(() => {
    if (isDraggingRef.current) {
      if (pullDownOffset > thresholdDismiss && onDismiss) {
        onDismiss();
      }
      isDraggingRef.current = false;
      setIsDragging(false);
      setPullDownOffset(0);
    }
  }, [pullDownOffset, thresholdDismiss, onDismiss]);

  const onMouseLeave = useCallback(() => {
    // El listener global de window se encargará del mouseup/mousemove fuera del div
  }, []);

  // Prevenir clics accidentales si el usuario estaba arrastrando para hacer scroll
  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (hasMovedRef.current) {
      e.stopPropagation();
      e.preventDefault();
      hasMovedRef.current = false;
    }
  }, []);

  // Prevenir que eventos de rueda (wheel) se escapen a la página de fondo
  const onWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.stopPropagation();
  }, []);

  // Listeners globales en window para continuar el arrastre fluidamente si el cursor sale del modal
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !containerRef.current) return;
      const deltaY = e.pageY - startYRef.current;

      if (Math.abs(deltaY) > 4) {
        hasMovedRef.current = true;
        if (e.cancelable) {
          e.preventDefault();
        }
      }

      if (scrollTopRef.current <= 0 && deltaY > 0 && onDismiss) {
        setPullDownOffset(Math.min(deltaY * 0.55, 130));
      } else {
        setPullDownOffset(0);
        containerRef.current.scrollTop = scrollTopRef.current - deltaY;
      }
    };

    const handleGlobalMouseUp = () => {
      if (isDraggingRef.current) {
        if (pullDownOffset > thresholdDismiss && onDismiss) {
          onDismiss();
        }
        isDraggingRef.current = false;
        setIsDragging(false);
        setPullDownOffset(0);
      }
    };

    window.addEventListener('mousemove', handleGlobalMouseMove, { passive: false });
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [onDismiss, pullDownOffset, thresholdDismiss]);

  // 3. Touch Handlers para dispositivos táctiles reales y emuladores móviles
  const touchStartYRef = useRef<number | null>(null);
  const touchContainerRef = useRef<HTMLDivElement | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('input, textarea, select, [contenteditable="true"]')) {
      return;
    }
    e.stopPropagation();
    const container = e.currentTarget;
    touchContainerRef.current = container;
    touchStartYRef.current = e.touches[0].clientY;
  }, []);

  const onTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (touchStartYRef.current === null || !touchContainerRef.current) return;
      e.stopPropagation();

      const currentY = e.touches[0].clientY;
      const deltaY = currentY - touchStartYRef.current;

      // Si está en el tope y desliza hacia abajo, activar pull-to-dismiss evitando pull-to-refresh
      if (touchContainerRef.current.scrollTop <= 0 && deltaY > 0 && onDismiss) {
        setPullDownOffset(Math.min(deltaY * 0.55, 130));
        if (e.cancelable) {
          e.preventDefault();
        }
      } else {
        setPullDownOffset(0);
      }
    },
    [onDismiss]
  );

  const onTouchEnd = useCallback(() => {
    if (pullDownOffset > thresholdDismiss && onDismiss) {
      onDismiss();
    }
    touchStartYRef.current = null;
    setPullDownOffset(0);
  }, [pullDownOffset, thresholdDismiss, onDismiss]);

  return {
    containerRef,
    isDragging,
    pullDownOffset,
    style:
      pullDownOffset > 0
        ? {
            transform: `translateY(${pullDownOffset}px)`,
            transition: 'none',
          }
        : undefined,
    dragProps: {
      onMouseDown,
      onMouseMove,
      onMouseUp,
      onMouseLeave,
      onClickCapture,
      onWheel,
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
    overlayProps: {
      onTouchMove: (e: React.TouchEvent) => {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
      },
      onWheel: (e: React.WheelEvent) => {
        e.preventDefault();
        e.stopPropagation();
      },
    },
  };
}
