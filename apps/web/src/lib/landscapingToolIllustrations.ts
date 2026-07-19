import type { TranslationKey } from "@yardmatch/i18n";

export interface LandscapingToolIllustration {
  id: "lawn-mower" | "string-trimmer" | "leaf-blower" | "hedge-trimmer";
  titleKey: TranslationKey;
  altKey: TranslationKey;
  src: string;
}

export const landscapingToolIllustrations: LandscapingToolIllustration[] = [
  {
    id: "lawn-mower",
    titleKey: "landscaping_tool.lawn_mower.title",
    altKey: "landscaping_tool.lawn_mower.alt",
    src: "/media/landscaping-tools/lawn-mower.png"
  },
  {
    id: "string-trimmer",
    titleKey: "landscaping_tool.string_trimmer.title",
    altKey: "landscaping_tool.string_trimmer.alt",
    src: "/media/landscaping-tools/string-trimmer.png"
  },
  {
    id: "leaf-blower",
    titleKey: "landscaping_tool.leaf_blower.title",
    altKey: "landscaping_tool.leaf_blower.alt",
    src: "/media/landscaping-tools/leaf-blower.png"
  },
  {
    id: "hedge-trimmer",
    titleKey: "landscaping_tool.hedge_trimmer.title",
    altKey: "landscaping_tool.hedge_trimmer.alt",
    src: "/media/landscaping-tools/hedge-trimmer.png"
  }
];
