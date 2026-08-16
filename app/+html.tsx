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
        <meta name="theme-color" content="#050505" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />

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
      </head>
      <body>{children}</body>
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
