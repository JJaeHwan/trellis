import Handlebars from "handlebars";

export function toKebab(input: string): string {
  return String(input)
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}

export function toPascal(input: string): string {
  return String(input)
    .split(/[-_\s]+/)
    .filter((s) => s.length > 0)
    .map((s) => s[0]!.toUpperCase() + s.slice(1))
    .join("");
}

export function toCamel(input: string): string {
  const parts = String(input)
    .split(/[-_\s]+/)
    .filter((s) => s.length > 0);
  if (parts.length === 0) return "";
  const [first, ...rest] = parts;
  return (
    first!.toLowerCase() +
    rest.map((s) => s[0]!.toUpperCase() + s.slice(1)).join("")
  );
}

export function toSnake(input: string): string {
  return String(input)
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[-\s]+/g, "_")
    .toLowerCase();
}

export function registerHelpers(hbs: typeof Handlebars): void {
  hbs.registerHelper("kebab", (s: unknown) => toKebab(String(s ?? "")));
  hbs.registerHelper("pascal", (s: unknown) => toPascal(String(s ?? "")));
  hbs.registerHelper("camel", (s: unknown) => toCamel(String(s ?? "")));
  hbs.registerHelper("snake", (s: unknown) => toSnake(String(s ?? "")));
  hbs.registerHelper("eq", (a: unknown, b: unknown) => a === b);
}
