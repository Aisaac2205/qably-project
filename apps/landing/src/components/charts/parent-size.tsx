import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

export interface ParentSizeState {
  width: number;
  height: number;
  top: number;
  left: number;
}

export interface ParentSizeProvidedProps extends ParentSizeState {
  ref: HTMLDivElement | null;
  resize: (state: ParentSizeState) => void;
}

export interface ParentSizeProps {
  className?: string;
  style?: CSSProperties;
  parentSizeStyles?: CSSProperties;
  debounceTime?: number;
  ignoreDimensions?: keyof ParentSizeState | (keyof ParentSizeState)[];
  enableDebounceLeadingCall?: boolean;
  children: (args: ParentSizeProvidedProps) => ReactNode;
  initialSize?: Partial<ParentSizeState>;
}

const DEFAULT_INITIAL_SIZE: ParentSizeState = {
  width: 0,
  height: 0,
  top: 0,
  left: 0,
};

const DEFAULT_IGNORE_DIMENSIONS: (keyof ParentSizeState)[] = [];

const DEFAULT_PARENT_SIZE_STYLES: CSSProperties = {
  width: "100%",
  height: "100%",
};

function debounce<T>(
  fn: (value: T) => void,
  wait: number,
  leading: boolean
): ((value: T) => void) & { cancel: () => void } {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let pending = false;

  const debounced = (value: T) => {
    if (leading && timeout === null) {
      fn(value);
    } else {
      pending = true;
    }

    if (timeout !== null) clearTimeout(timeout);

    timeout = setTimeout(() => {
      timeout = null;
      if (pending) {
        pending = false;
        fn(value);
      }
    }, wait);
  };

  debounced.cancel = () => {
    if (timeout !== null) clearTimeout(timeout);
    timeout = null;
    pending = false;
  };

  return debounced;
}

export function ParentSize({
  className,
  style,
  parentSizeStyles = DEFAULT_PARENT_SIZE_STYLES,
  debounceTime = 300,
  ignoreDimensions = DEFAULT_IGNORE_DIMENSIONS,
  enableDebounceLeadingCall = true,
  initialSize,
  children,
}: ParentSizeProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const animationFrameID = useRef(0);
  const [state, setState] = useState<ParentSizeState>({
    ...DEFAULT_INITIAL_SIZE,
    ...initialSize,
  });

  const resize = useMemo(() => {
    const normalized = Array.isArray(ignoreDimensions)
      ? ignoreDimensions
      : [ignoreDimensions];

    return debounce<ParentSizeState>(
      (incoming) => {
        setState((existing) => {
          const keysWithChanges = (
            Object.keys(existing) as (keyof ParentSizeState)[]
          ).filter((key) => existing[key] !== incoming[key]);
          const shouldBail = keysWithChanges.every((key) =>
            normalized.includes(key)
          );
          return shouldBail ? existing : incoming;
        });
      },
      debounceTime,
      enableDebounceLeadingCall
    );
  }, [debounceTime, enableDebounceLeadingCall, ignoreDimensions]);

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        const { left, top, width, height } = entry.contentRect;
        animationFrameID.current = window.requestAnimationFrame(() => {
          resize({ width, height, top, left });
        });
      });
    });

    if (parentRef.current) observer.observe(parentRef.current);

    return () => {
      window.cancelAnimationFrame(animationFrameID.current);
      observer.disconnect();
      resize.cancel();
    };
  }, [resize]);

  return (
    <div
      ref={parentRef}
      className={className}
      style={{ ...parentSizeStyles, ...style }}
    >
      {children({
        ...state,
        ref: parentRef.current,
        resize,
      })}
    </div>
  );
}

export default ParentSize;
