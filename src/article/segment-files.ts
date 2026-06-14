/**
 * Parse numeric segment id from filenames like seg01.mp3, scene14.png, scene01.html
 */
export function parseSegmentId(filename: string, prefix: string): number | null {
  const re = new RegExp(`^${prefix}(\\d+)`, "i");
  const match = filename.match(re);
  if (!match) return null;
  return parseInt(match[1]!, 10);
}

export function sortBySegmentId(files: string[], prefix: string): string[] {
  return [...files].sort((a, b) => {
    const idA = parseSegmentId(a, prefix) ?? 0;
    const idB = parseSegmentId(b, prefix) ?? 0;
    return idA - idB;
  });
}

export function scenePngName(id: number): string {
  return `scene${String(id).padStart(2, "0")}.png`;
}

export function sceneHtmlName(id: number): string {
  return `scene${String(id).padStart(2, "0")}.html`;
}
