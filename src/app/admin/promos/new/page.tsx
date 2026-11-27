import { redirect } from "next/navigation";

export default function AdminNewPromoPage() {
  redirect("/admin/promos?new=1");
}
