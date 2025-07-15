import { redirect } from "next/navigation";

export default function WhatsAppRootPage() {
  redirect("/dashboard/whatsapp/web");
  return null;
} 