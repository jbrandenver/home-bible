import { Html, Head, Main, NextScript } from 'next/document';

// Sets the document language (accessibility + SEO signal) — Pages Router does
// not provide <html lang> by default.
export default function Document() {
  return (
    <Html lang="en">
      {/* Direction contract for "The Register of Record" lives at the top of
          styles/globals.css; this emitted marker keeps it discoverable in the
          shipped markup. */}
      <Head>
        {/* Brand mark favicons — SVG first (crisp everywhere it's supported),
            PNG + ICO fallbacks for Safari and legacy UAs. */}
        <link rel="icon" href="/favicon.ico" sizes="32x32" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="theme-color" content="#16302A" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
