import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("User", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  passwordHash: text("passwordHash").notNull(),
  name: text("name"),
  phoneNumber: text("phoneNumber"),
  username: text("username"),
  avatarUrl: text("avatarUrl"),
  role: text("role").notNull(),
  status: text("status").notNull(),
  loginAttempts: integer("loginAttempts").notNull(),
  lockUntil: text("lockUntil"),
  createdAt: text("createdAt").notNull(),
  updatedAt: text("updatedAt").notNull(),
  lastLogin: text("lastLogin"),
});

export const passwordResets = sqliteTable("PasswordReset", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  token: text("token").notNull(),
  expiresAt: text("expiresAt").notNull(),
  createdAt: text("createdAt").notNull(),
  usedAt: text("usedAt"),
  ipAddress: text("ipAddress"),
});

export const refreshTokens = sqliteTable("RefreshToken", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  token: text("token").notNull(),
  expiresAt: text("expiresAt").notNull(),
  createdAt: text("createdAt").notNull(),
  revokedAt: text("revokedAt"),
  deviceInfo: text("deviceInfo"),
});

export const gifts = sqliteTable("Gift", {
  id: text("id").primaryKey(),
  senderId: text("senderId"),
  recipientId: text("recipientId").notNull(),
  amount: real("amount").notNull(),
  currency: text("currency").notNull().default("USDC"),
  message: text("message"),
  template: text("template"),
  status: text("status").notNull(),
  otpHash: text("otpHash"),
  otpExpiresAt: text("otpExpiresAt"),
  otpAttempts: integer("otpAttempts").notNull().default(0),
  transactionId: text("transactionId"),
  hideAmount: integer("hideAmount", { mode: "boolean" }).notNull().default(false),
  hideSender: integer("hideSender", { mode: "boolean" }).notNull().default(false),
  unlockDatetime: text("unlockDatetime"),
  senderName: text("senderName"),
  senderEmail: text("senderEmail"),
  senderAvatar: text("senderAvatar"),
  createdAt: text("createdAt").notNull(),
  updatedAt: text("updatedAt").notNull(),
});

export const wallets = sqliteTable("Wallet", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  currency: text("currency").notNull(),
  balance: real("balance").notNull().default(0),
  createdAt: text("createdAt").notNull(),
  updatedAt: text("updatedAt").notNull(),
});
