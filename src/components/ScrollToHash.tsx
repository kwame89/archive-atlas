import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Makes hash links (/#principles, /#get-started) actually scroll.
 *
 * The browser only scrolls to a fragment on a real document load. React
 * Router's <Link> navigates via history.pushState, so the URL gains the hash
 * but nothing moves — which is why the header's Principles and Get started
 * links appeared dead after they became <Link>s.
 *
 * Mounted once inside the router: on every location change, scroll to the
 * element the hash names, or to the top when there is no hash.
 */
export function ScrollToHash() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    // Deliberately does nothing without a hash. Scroll-to-top on every route
    // change is a separate (defensible) behavior change, and this component
    // exists to fix the dead hash links only.
    if (!hash) return;

    // The target usually mounts in the same commit as this effect, but a
    // route change (e.g. Directory -> /#principles) swaps the whole page
    // first, so retry on the next frame before giving up.
    const scrollToTarget = () => {
      const el = document.getElementById(hash.slice(1));
      if (!el) return false;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      return true;
    };

    if (scrollToTarget()) return;
    const raf = requestAnimationFrame(() => {
      scrollToTarget();
    });
    return () => cancelAnimationFrame(raf);
  }, [pathname, hash]);

  return null;
}
