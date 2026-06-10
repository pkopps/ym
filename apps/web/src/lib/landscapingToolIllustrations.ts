export interface LandscapingToolIllustration {
  id: "lawn-mower" | "string-trimmer" | "leaf-blower" | "hedge-trimmer";
  title: string;
  alt: string;
  src: string;
}

export const landscapingToolIllustrations: LandscapingToolIllustration[] = [
  {
    id: "lawn-mower",
    title: "Lawn mower",
    alt: "Artsy cartoony illustration of a walk-behind lawn mower",
    src: "/media/landscaping-tools/lawn-mower.png"
  },
  {
    id: "string-trimmer",
    title: "String trimmer",
    alt: "Artsy cartoony illustration of a string trimmer weed whacker",
    src: "/media/landscaping-tools/string-trimmer.png"
  },
  {
    id: "leaf-blower",
    title: "Leaf blower",
    alt: "Artsy cartoony illustration of a handheld leaf blower with leaves in motion",
    src: "/media/landscaping-tools/leaf-blower.png"
  },
  {
    id: "hedge-trimmer",
    title: "Hedge trimmer",
    alt: "Artsy cartoony illustration of a hedge trimmer with soft leaves around it",
    src: "/media/landscaping-tools/hedge-trimmer.png"
  }
];
