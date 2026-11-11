import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, type HTMLAttributes } from "react";

/**
 * A row that scrolls sideways (filter chips, category tabs, open bills).
 *
 * The edge that still has more to show fades out, so a cut-off chip reads as "swipe for more"
 * rather than as a broken layout; once the row is scrolled to an end, that end stops fading.
 * The fade is drawn by `.cafyz-hscroll` in native-shell.css from `data-more`.
 */
export const HScroll = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function HScroll({ className = "", onScroll, ...rest }, forwarded) {
    const ref = useRef<HTMLDivElement>(null);
    useImperativeHandle(forwarded, () => ref.current as HTMLDivElement);

    const update = useCallback(() => {
      const el = ref.current;
      if (!el) return;
      // scrollLeft runs negative in right-to-left layouts; distance from the start is what matters.
      const fromStart = Math.abs(el.scrollLeft);
      const room = el.scrollWidth - el.clientWidth;
      const start = fromStart > 2;
      const end = room - fromStart > 2;
      const more = start && end ? "both" : start ? "start" : end ? "end" : "";
      if ((el.dataset.more ?? "") !== more) {
        if (more) el.dataset.more = more;
        else delete el.dataset.more;
      }
    }, []);

    useEffect(() => {
      const el = ref.current;
      if (!el) return;
      update();
      const ro = new ResizeObserver(update);
      ro.observe(el);
      // Chips arriving or leaving change the width without resizing the row itself.
      const mo = new MutationObserver(update);
      mo.observe(el, { childList: true, subtree: true, characterData: true });
      return () => { ro.disconnect(); mo.disconnect(); };
    }, [update]);

    return (
      <div
        ref={ref}
        className={`cafyz-hscroll ${className}`}
        onScroll={e => { update(); onScroll?.(e); }}
        {...rest}
      />
    );
  },
);
