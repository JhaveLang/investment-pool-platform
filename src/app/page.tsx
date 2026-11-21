import { redirect } from "next/navigation";
import { homePathForRole } from "@/server/auth/guards";
import { getCurrentUser } from "@/server/auth/session";

export default async function HomePage() {
  const user = await getCurrentUser();
  redirect(user ? homePathForRole(user.role) : "/login");
}
