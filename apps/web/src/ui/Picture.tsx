/**
 * Renders an example picture: almost always a plain emoji character, but a handful of words (e.g.
 * "pomegranate") have no matching Unicode emoji at all, so their content authors used a bundled
 * image instead, referenced as `img:<path under public/>`. Sized to the surrounding text (1em
 * square) so it drops into the same emoji-sized slot everywhere without extra layout code.
 */
export function Picture({ value, alt = '' }: { value: string; alt?: string }) {
  if (value.startsWith('img:')) {
    return <img src={`${import.meta.env.BASE_URL}${value.slice(4)}`} alt={alt} className="inline-block h-[1em] w-[1em] align-[-0.15em] object-contain" />;
  }
  return <>{value}</>;
}
