import { ScrollViewStyleReset } from 'expo-router/html';
import React from 'react';

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
            __html: `setTimeout(function(){var el=document.getElementById('risev-boot');if(el&&!el.__removed){el.__removed=true;el.remove();}},12000);`,
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
`;
