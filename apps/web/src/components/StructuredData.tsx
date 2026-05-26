export function StructuredData({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // Next can stream this safely and it improves discoverability for the marketing pages.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
