let counter = 0;

/** Short, unique-enough ids for local data. Prefix makes debugging easier. */
export function newId(prefix: string): string {
  counter += 1;
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 7);
  return `${prefix}_${time}${counter.toString(36)}${rand}`;
}
