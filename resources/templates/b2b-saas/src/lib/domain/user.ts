export type UserRole = "USER" | "ADMIN";

export interface UserProfile {
  readonly id: string;
  readonly email: string;
  readonly name: string | null;
  readonly role: UserRole;
  readonly createdAt: Date;
}
