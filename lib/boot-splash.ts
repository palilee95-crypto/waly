const BOOT_ID = 'risev-boot';
const FADE_MS = 320;

let hidden = false;
let prefetchDone = false;
let screenDone = false;

function tryHide() {
  if (prefetchDone && screenDone) hideBootSplash();
}

/** Fades out the pre-rendered boot splash in `app/+html.tsx`. Safe on native and SSR. */
export function hideBootSplash() {
  if (hidden || typeof document === 'undefined') return;
  const el = document.getElementById(BOOT_ID);
  if (!el) {
    hidden = true;
    return;
  }
  hidden = true;
  document.documentElement.setAttribute('data-risev-boot', 'done');
  window.setTimeout(() => el.remove(), FADE_MS);
}

/** The tab-bar prefetch has settled (success or failure). */
export function markPrefetchDone() {
  prefetchDone = true;
  tryHide();
}

/** The landing screen's own first-paint fetches have settled. */
export function markAppReady() {
  screenDone = true;
  tryHide();
}
