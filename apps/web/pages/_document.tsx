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
        <meta name="x-design-direction" content="The Register of Record — security-print/deed; deep archive green + gilt; Cinzel/Spectral/Overpass Mono; struck seals, folio, MRZ. See styles/globals.css." />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
