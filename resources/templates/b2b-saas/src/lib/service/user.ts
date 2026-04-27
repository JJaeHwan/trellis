import { db } from "@/lib/external/db";
import type { UserProfile, UserRole } from "@/lib/domain/user";

export async function getUserById(id: string): Promise<UserProfile | null> {
  const u = await db.user.findUnique({ where: { id } });
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role as UserRole,
    createdAt: u.createdAt,
  };
}
