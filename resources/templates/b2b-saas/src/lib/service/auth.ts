import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/external/db";
import { ConflictError } from "@/lib/common/errors";
import type { UserProfile, UserRole } from "@/lib/domain/user";

const PASSWORD_ROUNDS = 12;

export interface RegisterInput {
  readonly email: string;
  readonly password: string;
  readonly name?: string;
}

export async function registerUser(input: RegisterInput): Promise<UserProfile> {
  const existing = await db.user.findUnique({ where: { email: input.email } });
  if (existing != null) {
    throw new ConflictError("email already registered");
  }
  const passwordHash = await bcrypt.hash(input.password, PASSWORD_ROUNDS);
  const created = await db.user.create({
    data: {
      email: input.email,
      passwordHash,
      name: input.name ?? null,
    },
  });
  return {
    id: created.id,
    email: created.email,
    name: created.name,
    role: created.role as UserRole,
    createdAt: created.createdAt,
  };
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await db.user.findUnique({
          where: { email: credentials.email },
        });
        if (!user) return null;
        const ok = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!ok) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) {
        token.id = (user as { id: string }).id;
        token.role = (user as { role: UserRole }).role;
      }
      return token;
    },
    session: ({ session, token }) => {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string | null;
      role: UserRole;
    };
  }
  interface User {
    role: UserRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: UserRole;
  }
}
