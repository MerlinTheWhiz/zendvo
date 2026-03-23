import {
  pgTable,
  text,
  timestamp,
  integer,
  uuid,
  boolean,
  doublePrecision,
  pgEnum,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const userStatusEnum = pgEnum("user_status", [
  "unverified",
  "active",
  "suspended",
]);
export const giftStatusEnum = pgEnum("gift_status", [
  "pending_otp",
  "otp_verified",
  "pending_review",
  "confirmed",
  "completed",
  "sent",
  "failed",
]);

// Tables
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name"),
  phoneNumber: text("phone_number").unique(),
  username: text("username").unique(),
  avatarUrl: text("avatar_url"),
  role: text("role").default("user").notNull(),
  status: userStatusEnum("status").default("unverified").notNull(),
  loginAttempts: integer("login_attempts").default(0).notNull(),
  lockUntil: timestamp("lock_until"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastLogin: timestamp("last_login"),
  lastOtpSentAt: timestamp("last_otp_sent_at"),
});

export const emailVerifications = pgTable(
  "email_verifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    otpHash: text("otp_hash").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    isUsed: boolean("is_used").default(false).notNull(),
  },
  (table) => {
    return [
      index("ev_user_id_idx").on(table.userId),
      index("ev_expires_at_idx").on(table.expiresAt),
    ];
  },
);

export const passwordResets = pgTable(
  "password_resets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    usedAt: timestamp("used_at"),
    ipAddress: text("ip_address"),
  },
  (table) => {
    return [
      index("pr_user_id_idx").on(table.userId),
      index("pr_expires_at_idx").on(table.expiresAt),
    ];
  },
);

export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    revokedAt: timestamp("revoked_at"),
    deviceInfo: text("device_info"),
  },
  (table) => {
    return [index("rt_user_id_idx").on(table.userId)];
  },
);

export const gifts = pgTable(
  "gifts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    senderId: uuid("sender_id").references(() => users.id),
    recipientId: uuid("recipient_id")
      .notNull()
      .references(() => users.id),
    amount: doublePrecision("amount").notNull(),
    currency: text("currency").notNull(),
    message: text("message"),
    template: text("template"),
    status: giftStatusEnum("status").default("pending_otp").notNull(),
    otpHash: text("otp_hash"),
    otpExpiresAt: timestamp("otp_expires_at"),
    otpAttempts: integer("otp_attempts").default(0).notNull(),
    transactionId: text("transaction_id").unique(),
    hideAmount: boolean("hide_amount").default(false).notNull(),
    hideSender: boolean("hide_sender").default(false).notNull(),
    unlockDatetime: timestamp("unlock_datetime"),
    senderName: text("sender_name"),
    senderEmail: text("sender_email"),
    senderAvatar: text("sender_avatar"),
    shareLink: text("share_link").unique(),
    shareLinkToken: text("share_link_token").unique(),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => {
    return [
      index("gift_sender_id_idx").on(table.senderId),
      index("gift_recipient_id_idx").on(table.recipientId),
      index("gift_status_idx").on(table.status),
      index("gift_sender_email_recipient_idx").on(
        table.senderEmail,
        table.recipientId,
      ),
      index("gift_share_link_token_idx").on(table.shareLinkToken),
    ];
  },
);

export const wallets = pgTable(
  "wallets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    currency: text("currency").notNull(),
    balance: doublePrecision("balance").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => {
    return [
      unique("wallet_user_currency_key").on(table.userId, table.currency),
      index("wallet_user_id_idx").on(table.userId),
    ];
  },
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    type: text("type").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    read: boolean("read").default(false).notNull(),
    metadata: text("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => {
    return [
      index("notif_user_id_idx").on(table.userId),
      index("notif_created_at_idx").on(table.createdAt),
    ];
  },
);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  emailVerifications: many(emailVerifications),
  passwordResets: many(passwordResets),
  refreshTokens: many(refreshTokens),
  sentGifts: many(gifts, { relationName: "sentGifts" }),
  receivedGifts: many(gifts, { relationName: "receivedGifts" }),
  wallets: many(wallets),
  notifications: many(notifications),
}));

export const giftsRelations = relations(gifts, ({ one }) => ({
  sender: one(users, {
    fields: [gifts.senderId],
    references: [users.id],
    relationName: "sentGifts",
  }),
  recipient: one(users, {
    fields: [gifts.recipientId],
    references: [users.id],
    relationName: "receivedGifts",
  }),
}));

export const emailVerificationsRelations = relations(
  emailVerifications,
  ({ one }) => ({
    user: one(users, {
      fields: [emailVerifications.userId],
      references: [users.id],
    }),
  }),
);

export const passwordResetsRelations = relations(passwordResets, ({ one }) => ({
  user: one(users, {
    fields: [passwordResets.userId],
    references: [users.id],
  }),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}));

export const walletsRelations = relations(wallets, ({ one }) => ({
  user: one(users, {
    fields: [wallets.userId],
    references: [users.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));
