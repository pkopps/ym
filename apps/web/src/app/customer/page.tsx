import type { Metadata } from "next";
import { PublicCustomerMarketplacePage } from "../../components/PublicCustomerMarketplacePage";

export const metadata: Metadata = {
  title: "Book lawn care",
  description: "Search for local lawn care and landscaping services."
};

export default function CustomerPage() {
  return <PublicCustomerMarketplacePage />;
}
