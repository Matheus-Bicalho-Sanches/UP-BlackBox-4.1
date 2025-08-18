import { redirect } from "next/navigation";

export default function MarketDataIndexPage() {
  redirect("/dashboard/market-data/acompativos");
  return null;
} 