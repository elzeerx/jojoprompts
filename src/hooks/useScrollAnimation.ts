import { useEffect, useRef, useState, useCallback } from 'react';

interface UseScrollAnimationOptions {
  /** Threshold for triggering animation (0-1) */
  threshold?: number;
  /** Root margin for intersection observer */
  rootMargin?: string;
  /** Only trigger once */
  triggerOnce?: boolean;
  /** Delay before animation starts (ms) */
  delay?: number;
}

interface UseScrollAnimationReturn {
  ref: React.RefObject<HTMLDivElement>;
  isVisible: boolean;
  hasAnimated: boolean;
}

export function useScrollAnimation(
  options: UseScrollAnimationOptions = {}
): UseScrollAnimationReturn {
  const {
    threshold = 0.1,
    rootMargin = '0px 0px -50px 0px',
    triggerOnce = true,
    delay = 0,
  } = options;

  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    if (prefersReducedMotion) {
      setIsVisible(true);
      setHasAnimated(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (delay > 0) {
            setTimeout(() => {
              setIsVisible(true);
              setHasAnimated(true);
            }, delay);
          } else {
            setIsVisible(true);
            setHasAnimated(true);
          }

          if (triggerOnce) {
            observer.unobserve(element);
          }
        } else if (!triggerOnce) {
          setIsVisible(false);
        }
      },
      {
        threshold,
        rootMargin,
      }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [threshold, rootMargin, triggerOnce, delay]);

  return { ref, isVisible, hasAnimated };
}

// Hook for staggered animations on multiple elements
interface UseStaggerAnimationOptions extends UseScrollAnimationOptions {
  /** Number of items to animate */
  itemCount: number;
  /** Stagger delay between items (ms) */
  staggerDelay?: number;
}

export function useStaggerAnimation(
  options: UseStaggerAnimationOptions
): {
  containerRef: React.RefObject<HTMLDivElement>;
  getItemProps: (index: number) => {
    style: React.CSSProperties;
    className: string;
  };
  isContainerVisible: boolean;
} {
  const { itemCount, staggerDelay = 100, ...scrollOptions } = options;
  const { ref: containerRef, isVisible: isContainerVisible } = useScrollAnimation(scrollOptions);

  const getItemProps = useCallback(
    (index: number) => ({
      style: {
        transitionDelay: isContainerVisible ? `${index * staggerDelay}ms` : '0ms',
        opacity: isContainerVisible ? 1 : 0,
        transform: isContainerVisible ? 'translateY(0)' : 'translateY(20px)',
      } as React.CSSProperties,
      className: 'transition-all duration-500 ease-out',
    }),
    [isContainerVisible, staggerDelay]
  );

  return { containerRef, getItemProps, isContainerVisible };
}

// Hook for parallax scrolling effect
interface UseParallaxOptions {
  /** Speed factor (-1 to 1, negative moves opposite to scroll) */
  speed?: number;
  /** Enable on mobile */
  enableOnMobile?: boolean;
}

export function useParallax(options: UseParallaxOptions = {}): {
  ref: React.RefObject<HTMLDivElement>;
  style: React.CSSProperties;
} {
  const { speed = 0.5, enableOnMobile = false } = options;
  const ref = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    // Check if mobile and should disable
    const isMobile = window.innerWidth < 768;
    if (isMobile && !enableOnMobile) return;

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    if (prefersReducedMotion) return;

    const handleScroll = () => {
      if (!ref.current) return;
      
      const rect = ref.current.getBoundingClientRect();
      const scrolled = window.scrollY;
      const elementTop = rect.top + scrolled;
      const elementCenter = elementTop + rect.height / 2;
      const viewportCenter = scrolled + window.innerHeight / 2;
      
      const distance = viewportCenter - elementCenter;
      setOffset(distance * speed * 0.1);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial calculation

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [speed, enableOnMobile]);

  return {
    ref,
    style: {
      transform: `translateY(${offset}px)`,
      willChange: 'transform',
    },
  };
}
