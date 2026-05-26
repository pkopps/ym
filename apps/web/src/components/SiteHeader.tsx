"use client";

import { usePathname } from "next/navigation";
import { CustomerAppHeader } from "./CustomerAppHeader";
import { NavBar } from "./NavBar";

export function SiteHeader() {
  const pathname = usePathname();

  if (pathname.startsWith("/customer")) {
    return <CustomerAppHeader />;
  }

  return <NavBar />;
}
