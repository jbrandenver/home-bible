import { Html, Head, Main, NextScript } from 'next/document';

// Sets the document language (accessibility + SEO signal) — Pages Router does
// not provide <html lang> by default.
export default function Document() {
  return (
    <Html lang="en">
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
