import { ScrollViewStyleReset } from 'expo-router/html';
import React from 'react';

/**
 * Web-only HTML shell used during static export. Runs in Node, no DOM access.
 */
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
        <title>Chart The Game</title>
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: pageStyles }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const pageStyles = `
body { background-color: #EEF1F5; }
#root { min-height: 100%; }
`;
