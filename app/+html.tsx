import { ScrollViewStyleReset } from 'expo-router/html';
import React from 'react';

/**
 * Never leave a blank white page behind. A stale cached shell can reference a
 * bundle that the latest deploy deleted; Vercel/Netlify then answer that
 * request with index.html and a 200, so the browser parses HTML as JS and the
 * app never mounts. Detect that (and a silent no-boot) and retry once with a
 * cache-busting URL, then fall back to a real reload button.
 */
const bootGuardScript = `
(function () {
  var BOOT = 'risev-boot';
  var KEY = 'risev-boot-retry';

  function booted() {
    return document.documentElement.getAttribute('data-risev-boot') === 'done';
  }

  function cleanUrl() {
    var url = location.pathname + location.search;
    url = url.replace(/([?&])risev_bust=[^&]*&?/, '$1').replace(/[?&]$/, '');
    return url || '/';
  }

  function fail() {
    var el = document.getElementById(BOOT);
    if (!el || el.__risevGone || booted()) return;
    var retried = false;
    try { retried = sessionStorage.getItem(KEY) === '1'; } catch (e) {}
    if (!retried) {
      try { sessionStorage.setItem(KEY, '1'); } catch (e) {}
      var target = cleanUrl();
      target += (target.indexOf('?') === -1 ? '?' : '&') + 'risev_bust=' + Date.now();
      location.replace(target);
      return;
    }
    el.style.backgroundColor = '#FFFFFF';
    el.innerHTML =
      '<div class="risev-recover">' +
        '<img class="risev-recover-logo" src="/risev-boot.png" alt="" />' +
        '<div class="risev-recover-title">The app could not load</div>' +
        '<div class="risev-recover-body">You may be on an older cached version. Check your connection, then reload.</div>' +
        '<button class="risev-recover-btn" type="button">Reload</button>' +
      '</div>';
    var btn = el.querySelector('.risev-recover-btn');
    if (btn) {
      btn.onclick = function () {
        try { sessionStorage.removeItem(KEY); } catch (e) {}
        location.replace(cleanUrl());
      };
    }
  }

  // A script element that fails to load or parse. Only our bundle is fatal — an
  // ad-blocked Turnstile/Facebook SDK (or an inline script) must not reload.
  window.addEventListener('error', function (e) {
    var t = e && e.target;
    if (t && t.tagName === 'SCRIPT') {
      var src = t.src || '';
      if (!src || src.indexOf('/_expo/') === -1) return;
      fail();
      return;
    }
    var msg = String((e && e.message) || '');
    if (/Unexpected token\\s*'<'|Loading chunk|Importing a module script failed|error loading dynamically imported module/i.test(msg)) {
      fail();
    }
  }, true);

  window.addEventListener('unhandledrejection', function (e) {
    var r = e && e.reason;
    var msg = String((r && r.message) || r || '');
    if (/Loading chunk|Importing a module script failed|Unexpected token\\s*'<'|error loading dynamically imported module/i.test(msg)) {
      fail();
    }
  });

  // Last resort: the bundle never mounted. A stalled request can keep the
  // document at 'interactive' forever, so wait a little longer in that case
  // instead of skipping the check entirely.
  var passes = 0;
  function watchdog() {
    if (!document.getElementById(BOOT)) return;
    if (document.readyState === 'loading' && passes < 3) {
      passes += 1;
      window.setTimeout(watchdog, 6000);
      return;
    }
    fail();
  }
  window.setTimeout(watchdog, 12000);
})();
`;

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, shrink-to-fit=no" />

        {/* PWA Manifest Link */}
        <link rel="manifest" href="/manifest.json" />
        {/* Boot splash mark — start the fetch immediately, it is the first paint */}
        <link rel="preload" href="/risev-boot.png" as="image" />
        <meta name="theme-color" content="#050505" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />
        <style dangerouslySetInnerHTML={{ __html: bootSplashStyles }} />

        {/* Facebook JS SDK for Meta WhatsApp Embedded Signup */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.fbAsyncInit = function() {
                if (window.FB) {
                  window.FB.init({
                    appId      : '1040853298682209',
                    cookie     : true,
                    xfbml      : true,
                    version    : 'v20.0'
                  });
                  if (window.FB.AppEvents && window.FB.AppEvents.logPageView) {
                    window.FB.AppEvents.logPageView();
                  }
                }
              };

              (function(d, s, id){
                var js, fjs = d.getElementsByTagName(s)[0];
                if (d.getElementById(id)) {return;}
                js = d.createElement(s); js.id = id;
                js.src = "https://connect.facebook.net/en_US/sdk.js";
                fjs.parentNode.insertBefore(js, fjs);
              }(document, 'script', 'facebook-jssdk'));
            `,
          }}
        />

        {/* Cloudflare Turnstile */}
        <script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async defer />
      </head>
      <body>
        <div id="risev-boot" aria-hidden="true">
          <div className="risev-boot-inner">
            <img className="risev-boot-logo" src="/risev-boot.png" alt="" />
            <svg className="risev-boot-arc" viewBox="0 0 44 44">
              <circle cx="22" cy="22" r="19" />
            </svg>
          </div>
        </div>
        <script
          dangerouslySetInnerHTML={{
            __html: bootGuardScript,
          }}
        />
        {children}
      </body>
    </html>
  );
}

const responsiveBackground = `
  html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    position: fixed;
    overscroll-behavior: none;
    background-color: #FFFFFF;
    user-select: none;
    -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  /* Enable text selection inside inputs and textareas and remove browser focus rings */
  input, textarea, select, [contenteditable] {
    user-select: text;
    -webkit-user-select: text;
    outline: none !important;
    outline-style: none !important;
    box-shadow: none !important;
  }

  *:focus, *:focus-visible {
    outline: none !important;
    outline-style: none !important;
    box-shadow: none !important;
  }

  #root {
    width: 100%;
    height: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
`;

const bootSplashStyles = `
  #risev-boot {
    position: fixed;
    inset: 0;
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #FFFFFF;
    opacity: 1;
    transition: opacity 0.3s ease;
  }

  html[data-risev-boot="done"] #risev-boot {
    opacity: 0;
    pointer-events: none;
  }

  .risev-boot-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
  }

  .risev-boot-logo {
    width: 104px;
    height: auto;
    animation: risev-boot-pulse 1.6s ease-in-out infinite;
  }

  .risev-boot-arc {
    width: 34px;
    height: 34px;
  }

  .risev-boot-arc circle {
    fill: none;
    stroke: #FFCC00;
    stroke-width: 3.2;
    stroke-linecap: round;
    stroke-dasharray: 34 86;
    transform-origin: 22px 22px;
    animation: risev-boot-spin 1.05s linear infinite;
  }

  @keyframes risev-boot-pulse {
    0%, 100% { opacity: 0.55; }
    50% { opacity: 1; }
  }

  @keyframes risev-boot-spin {
    to { transform: rotate(360deg); }
  }

  @media (prefers-reduced-motion: reduce) {
    .risev-boot-logo,
    .risev-boot-arc circle {
      animation: none;
    }
  }

  .risev-recover {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    max-width: 340px;
    padding: 32px;
    text-align: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .risev-recover-logo {
    width: 72px;
    height: auto;
    margin-bottom: 4px;
  }

  .risev-recover-title {
    font-size: 17px;
    font-weight: 700;
    color: #0F172A;
  }

  .risev-recover-body {
    font-size: 13px;
    font-weight: 500;
    line-height: 1.5;
    color: #64748B;
  }

  .risev-recover-btn {
    margin-top: 8px;
    height: 44px;
    padding: 0 24px;
    border: 0;
    border-radius: 12px;
    background-color: #0F172A;
    color: #FFFFFF;
    font-family: inherit;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
  }
`;
