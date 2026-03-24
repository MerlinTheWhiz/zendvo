import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { passwordResets, refreshTokens, users } from "@/lib/db/schema";

export interface RegisterUserInput {
  email: string;
  passwordHash: string;
  name?: string | null;
  phoneNumber?: string | null;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  phoneNumber: string | null;
  role: string;
  status: string;
}

export interface PasswordResetRequest {
  id: string;
  userId: string;
  expiresAt: Date;
  usedAt: Date | null;
  user: {
    email: string;
    name: string | null;
  };
}

export async function findUserByEmail(email: string): Promise<AuthUser | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phoneNumber: user.phoneNumber,
    role: user.role,
    status: user.status,
  };
}

export async function findUserByPhoneNumber(phoneNumber: string): Promise<AuthUser | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.phoneNumber, phoneNumber),
  });

  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phoneNumber: user.phoneNumber,
    role: user.role,
    status: user.status,
  };
}

export async function createUser(input: RegisterUserInput): Promise<AuthUser> {
  const [user] = await db
    .insert(users)
    .values({
      email: input.email,
      passwordHash: input.passwordHash,
      name: input.name ?? null,
      phoneNumber: input.phoneNumber ?? null,
      role: "user",
      status: "unverified",
      loginAttempts: 0,
      lockUntil: null,
    })
    .returning();

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phoneNumber: user.phoneNumber,
    role: user.role,
    status: user.status,
  };
}

export async function findPasswordResetByToken(
  token: string,
): Promise<PasswordResetRequest | null> {
  const record = await db.query.passwordResets.findFirst({
    where: eq(passwordResets.token, token),
    with: {
      user: true,
    },
  });

  if (!record) {
    return null;
  }

  return {
    id: record.id,
    userId: record.userId,
    expiresAt: record.expiresAt,
    usedAt: record.usedAt,
    user: {
      email: record.user.email,
      name: record.user.name,
    },
  };
}

export async function completePasswordReset(input: {
  resetId: string;
  userId: string;
  passwordHash: string;
}): Promise<void> {
  const now = new Date();

  await db
    .update(users)
    .set({
      passwordHash: input.passwordHash,
      updatedAt: now,
    })
    .where(eq(users.id, input.userId));

  await db
    .update(passwordResets)
    .set({ usedAt: now })
    .where(
      and(
        eq(passwordResets.id, input.resetId),
        eq(passwordResets.userId, input.userId),
      ),
    );

  await db.delete(refreshTokens).where(eq(refreshTokens.userId, input.userId));
}
