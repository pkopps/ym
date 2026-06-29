import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Business owner sign up"
};

export default function ProviderSignupPage() {
  redirect("/provider");
}
