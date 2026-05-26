"use client";

import { usePathname } from "next/navigation";
import { CustomerAppHeader } from "./CustomerAppHeader";
import { NavBar } from "./NavBar";
import { ProviderSiteHeader } from "./ProviderSiteHeader";

export function SiteHeader() {
  const pathname = usePathname();

  if (pathname.startsWith("/customer")) {
    return <CustomerAppHeader />;
  }

  if (
    pathname.startsWith("/provider") ||
    pathname.startsWith("/auth/provider") ||
    pathname.startsWith("/login/provider")
  ) {
    return <ProviderSiteHeader />;
  }

  return <NavBar />;
}
