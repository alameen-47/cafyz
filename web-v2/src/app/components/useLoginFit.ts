import { useLayoutEffect, useRef, type RefObject } from "react";

/** Tablets and desktops have room to spare and keep their scrolling column. */
const PHONE = "(max-width: 767px)";
/** Density steps, roomiest first. LoginScreen.css says what each one tightens. */
const STEPS = 4;
/** The logo gives way down to this share of its full size; past that the form tightens instead. */
const LOGO_KEEP = 0.75;

const isTyping = () => {
  const el = document.activeElement as HTMLElement | null;
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
};

export interface LoginFitRefs {
  /** The scroll area: its height is the space the screen has. */
  scroll: RefObject<HTMLElement | null>;
  /** Pinned to that height while fitted; carries `data-fit`. */
  canvas: RefObject<HTMLElement | null>;
  /** The logo box, which gives way first. */
  brand: RefObject<HTMLElement | null>;
  /** The form, watched for anything that changes its height (a late Google button, a language). */
  content: RefObject<HTMLElement | null>;
}

/**
 * Fits the phone sign-in screen to the height it actually has, so nothing scrolls.
 *
 * The canvas is pinned to the scroll area's height and the roomiest density step that fits
 * is chosen (`data-fit` 0–3); the logo flexes to absorb whatever space is left over and the
 * footer settles at the foot. When even the tightest step cannot fit (a phone on its side),
 * the canvas grows and scrolls as before.
 *
 * `baseline` marks the default method (email and password). Its step is remembered, and the
 * other methods never use a roomier one, so switching to a shorter method does not re-pack
 * the logo and the welcome above it; a taller one (the PIN pad) may still tighten further.
 *
 * The on-screen keyboard shrinks the web view: the height measured before it opened is kept,
 * so the screen scrolls under the keyboard instead of re-packing while someone types.
 */
export function useLoginFit(enabled: boolean, baseline: boolean, refs: LoginFitRefs) {
  // Survives method switches: the height before any keyboard, and the baseline's step at it.
  const memo = useRef({ height: 0, baseStep: 0, baseHeight: 0 });

  useLayoutEffect(() => {
    const scroller = refs.scroll.current;
    const canvas = refs.canvas.current;
    if (!scroller || !canvas) return;

    const phone = window.matchMedia(PHONE);
    const m = memo.current;

    const release = () => {
      delete canvas.dataset.fit;
      delete canvas.dataset.fitOverflow;
      canvas.style.removeProperty("--login-fit-h");
      canvas.style.removeProperty("--login-logo-give");
    };

    const fit = () => {
      if (!enabled || !phone.matches) { release(); return; }
      const available = scroller.clientHeight;
      if (!available) return;
      if (!m.height || available >= m.height || !isTyping()) m.height = available;
      const height = m.height;
      canvas.style.setProperty("--login-fit-h", `${height}px`);
      delete canvas.dataset.fitOverflow;

      const brand = refs.brand.current;
      const inner = canvas.querySelector<HTMLElement>(".login-screen-panel-inner");
      const footer = canvas.querySelector<HTMLElement>(".login-footer");
      const logoFull = brand ? parseFloat(getComputedStyle(brand).flexBasis) || 0 : 0;
      const logoNow = () => (brand ? brand.getBoundingClientRect().height : logoFull);
      // Everything, the footer and the padding under it (the home-indicator inset on an
      // iPhone) included, must end within the screen.
      const fits = () => {
        if (canvas.scrollHeight > height + 1) return false;
        if (!inner || !footer) return true;
        const end = footer.getBoundingClientRect().bottom + parseFloat(getComputedStyle(inner).paddingBottom);
        return end <= canvas.getBoundingClientRect().top + height + 1;
      };

      // Sizes must land at once while measuring, not ease there (LoginScreen.css).
      canvas.dataset.fitting = "";
      const from = !baseline && m.baseHeight === height ? m.baseStep : 0;
      let step = from;
      for (; step < STEPS; step++) {
        canvas.dataset.fit = String(step);
        if (fits() && logoNow() >= logoFull * LOGO_KEEP - 0.5) break;
      }
      if (step === STEPS) {
        // Nothing keeps the logo at size: take the roomiest step that fits at all.
        for (step = from; step < STEPS; step++) {
          canvas.dataset.fit = String(step);
          if (fits()) break;
        }
      }
      if (step === STEPS) {
        step = STEPS - 1;
        canvas.dataset.fit = String(step);
        canvas.dataset.fitOverflow = "";
      }
      if (baseline) { m.baseStep = step; m.baseHeight = height; }
      delete canvas.dataset.fitting;
      // The room photograph rides up with the logo so the cloche still meets the welcome line.
      canvas.style.setProperty("--login-logo-give", `${Math.max(0, logoFull - logoNow())}px`);
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(scroller);
    if (refs.content.current) observer.observe(refs.content.current);
    phone.addEventListener("change", fit);
    // Field focus moves without a resize; refit once the keyboard has gone.
    const onFocusOut = () => requestAnimationFrame(fit);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      observer.disconnect();
      phone.removeEventListener("change", fit);
      document.removeEventListener("focusout", onFocusOut);
      release();
    };
  }, [enabled, baseline, refs]);
}
