import { db } from "@/lib/external/db";
import type { UserProfile, UserRole } from "@/lib/domain/user";

export async function listAllUsers(): Promise<UserProfile[]> {
  const users = await db.user.findMany({
    orderBy: { createdAt: "desc" },
  });
  return users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role as UserRole,
    createdAt: u.createdAt,
  }));
}
