"use client";

import { stripLocalePrefix } from "@yardmatch/i18n";
import { usePathname } from "next/navigation";
import { NavBar } from "./NavBar";
import { CompactSiteHeader } from "./CompactSiteHeader";

export function SiteHeader() {
  return stripLocalePrefix(usePathname()).path === "/" ? <NavBar /> : <CompactSiteHeader />;
}
