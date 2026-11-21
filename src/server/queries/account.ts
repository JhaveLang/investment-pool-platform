import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { users, type UserRole } from "@/server/db/schema";

export type Profile = {
  fullName: string;
  email: string;
  investorCode: string | null;
  role: UserRole;
  createdAt: Date;
};

export async function getProfile(userId: string): Promise<Profile | null> {
  const [profile] = await getDb()
    .select({
      fullName: users.fullName,
      email: users.email,
      investorCode: users.investorCode,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return profile ?? null;
}
