export class BrandTokens {
  // These mirrored tokens let native apps stay visually aligned with the canonical CSS variables.
  public static readonly colors = {
    ink: "#14281d",
    inkSoft: "#2d4736",
    surface: "#f7f5ef",
    surfaceStrong: "#f0eadc",
    card: "#ffffff",
    primary: "#2f7d4c",
    primaryStrong: "#205938",
    accent: "#e29a45",
    accentSoft: "#f6d9b6",
    border: "rgba(20, 40, 29, 0.12)",
    danger: "#b84d41",
    success: "#23754f",
    muted: "#66756a"
  } as const;

  public static readonly spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    hero: 48
  } as const;

  public static readonly radius = {
    sm: 14,
    md: 20,
    lg: 32
  } as const;
}
