// XSS-safe JSON-LD serializer — escapes </script> breakout + line
// terminators. Use for every JSON-LD block. See docs/STRUCTURED_DATA_GUIDE.md.
export function toJsonLd(schema: object | object[]): string {
  const payload = Array.isArray(schema)
    ? { "@context": "https://schema.org", "@graph": schema.map(stripContext) }
    : schema;
  return JSON.stringify(payload).replace(
    /[<>&\u2028\u2029]/g,
    (ch) => "\\u" + ch.charCodeAt(0).toString(16).padStart(4, "0"),
  );
}

function stripContext(item: object): object {
  const { ["@context"]: _drop, ...rest } = item as Record<string, unknown>;
  return rest;
}
