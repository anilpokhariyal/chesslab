export type BoardTheme = {
  id: string;
  name: string;
  premium: boolean;
  light: string;
  dark: string;
};

export const THEMES: BoardTheme[] = [
  { id: "default", name: "Green", premium: false, light: "#eedeb0", dark: "#769656" },
  { id: "wooden", name: "Wooden", premium: false, light: "#e8c992", dark: "#b58863" },
  { id: "marble", name: "Marble", premium: true, light: "#e8e8e8", dark: "#6a7b8a" },
  { id: "neon", name: "Neon", premium: true, light: "#2a3344", dark: "#1a2233" },
];

export function themeById(id: string): BoardTheme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}
