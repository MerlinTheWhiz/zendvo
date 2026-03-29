import { NextRequest } from "next/server";
import { POST } from "@/app/api/gifts/route";
import { db } from "@/lib/db";

jest.mock("@/lib/db", () => ({
  db: {
    query: {
      users: {
        findFirst: jest.fn(),
      },
    },
    insert: jest.fn(),
  },
}));

jest.mock("@/server/services/otpService", () => ({
  generateOTP: jest.fn(() => "123456"),
  storeGiftOTP: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/server/services/emailService", () => ({
  sendGiftConfirmationOTP: jest.fn(() => ({ success: true })),
}));

jest.mock("@/lib/slug", () => ({
  generateUniqueSlug: jest.fn(() => Promise.resolve("abc123")),
}));

jest.mock("@/lib/shortCode", () => ({
  generateUniqueShortCode: jest.fn(() => Promise.resolve("xyz123ab")),
}));

function mockInsertReturning(result: unknown) {
  (db.insert as jest.Mock).mockReturnValue({
    values: jest.fn().mockReturnValue({
      returning: jest.fn().mockResolvedValue([result]),
    }),
  });
}

describe("POST /api/gifts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should create a gift successfully with valid data", async () => {
    (db.query.users.findFirst as jest.Mock).mockResolvedValue({
      id: "recipient-123",
      email: "recipient@example.com",
      name: "Recipient User",
    });
    mockInsertReturning({ id: "gift-123", slug: "abc123", shortCode: "xyz123ab" });

    const request = new NextRequest("http://localhost/api/gifts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-user-id": "sender-123",
        "x-user-email": "sender@example.com",
      },
      body: JSON.stringify({
        recipient: "recipient-123",
        amount: 100,
        currency: "USD",
        message: "Happy Birthday!",
        template: "birthday",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.giftId).toBe("gift-123");
    expect(data.status).toBe("pending_otp");
    expect(data.slug).toBe("abc123");
  });

  it("should return 404 if recipient does not exist", async () => {
    (db.query.users.findFirst as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/gifts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-user-id": "sender-123",
        "x-user-email": "sender@example.com",
      },
      body: JSON.stringify({ recipient: "nonexistent-123", amount: 100, currency: "USD" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(404);
  });

  it("should return 422 for invalid amount", async () => {
    const request = new NextRequest("http://localhost/api/gifts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-user-id": "sender-123",
        "x-user-email": "sender@example.com",
      },
      body: JSON.stringify({ recipient: "recipient-123", amount: -100, currency: "USD" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(422);
  });

  it("should return 422 if trying to send gift to self", async () => {
    (db.query.users.findFirst as jest.Mock).mockResolvedValue({ id: "sender-123" });

    const request = new NextRequest("http://localhost/api/gifts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-user-id": "sender-123",
        "x-user-email": "sender@example.com",
      },
      body: JSON.stringify({ recipient: "sender-123", amount: 100, currency: "USD" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(422);
  });

  it("should return 401 if not authenticated", async () => {
    const request = new NextRequest("http://localhost/api/gifts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recipient: "recipient-123", amount: 100, currency: "USD" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("should return 400 for missing required fields", async () => {
    const request = new NextRequest("http://localhost/api/gifts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-user-id": "sender-123",
        "x-user-email": "sender@example.com",
      },
      body: JSON.stringify({ amount: 100, currency: "USD" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Recipient and amount are required");
  });

  it("should return 400 for unlock_at less than 1 hour in the future", async () => {
    (db.query.users.findFirst as jest.Mock).mockResolvedValue({
      id: "recipient-123",
      email: "recipient@example.com",
      name: "Recipient User",
    });

    const thirtyMinutesFromNow = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const request = new NextRequest("http://localhost/api/gifts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-user-id": "sender-123",
        "x-user-email": "sender@example.com",
      },
      body: JSON.stringify({
        recipient: "recipient-123",
        amount: 100,
        currency: "USD",
        unlock_at: thirtyMinutesFromNow,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe("unlock_at must be at least 1 hour in the future");
  });

  it("should return 400 for invalid unlock_at format", async () => {
    (db.query.users.findFirst as jest.Mock).mockResolvedValue({
      id: "recipient-123",
      email: "recipient@example.com",
      name: "Recipient User",
    });

    const request = new NextRequest("http://localhost/api/gifts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-user-id": "sender-123",
        "x-user-email": "sender@example.com",
      },
      body: JSON.stringify({
        recipient: "recipient-123",
        amount: 100,
        currency: "USD",
        unlock_at: "invalid-date",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain("timezone and milliseconds");
  });

  it("should create a gift successfully with valid unlock_at", async () => {
    (db.query.users.findFirst as jest.Mock).mockResolvedValue({
      id: "recipient-123",
      email: "recipient@example.com",
      name: "Recipient User",
    });
    mockInsertReturning({ id: "gift-123", slug: "abc123", shortCode: "xyz123ab" });

    const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

    const request = new NextRequest("http://localhost/api/gifts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-user-id": "sender-123",
        "x-user-email": "sender@example.com",
      },
      body: JSON.stringify({
        recipient: "recipient-123",
        amount: 100,
        currency: "USD",
        unlock_at: twoHoursFromNow,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.giftId).toBe("gift-123");
  });

  it("should reject generic timestamp format for unlock_at", async () => {
    (db.query.users.findFirst as jest.Mock).mockResolvedValue({
      id: "recipient-123",
      email: "recipient@example.com",
      name: "Recipient User",
    });

    const request = new NextRequest("http://localhost/api/gifts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-user-id": "sender-123",
        "x-user-email": "sender@example.com",
      },
      body: JSON.stringify({
        recipient: "recipient-123",
        amount: 100,
        currency: "USD",
        unlock_at: "2026-03-30 14:00:00", // Generic timestamp without timezone
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain("timezone and milliseconds");
  });

  it("should reject incomplete ISO format for unlock_at", async () => {
    (db.query.users.findFirst as jest.Mock).mockResolvedValue({
      id: "recipient-123",
      email: "recipient@example.com",
      name: "Recipient User",
    });

    const request = new NextRequest("http://localhost/api/gifts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-user-id": "sender-123",
        "x-user-email": "sender@example.com",
      },
      body: JSON.stringify({
        recipient: "recipient-123",
        amount: 100,
        currency: "USD",
        unlock_at: "2026-03-30T14:00:00", // Missing milliseconds and timezone
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain("timezone and milliseconds");
  });

  it("should accept valid ISO 8601 with Z timezone for unlock_at", async () => {
    (db.query.users.findFirst as jest.Mock).mockResolvedValue({
      id: "recipient-123",
      email: "recipient@example.com",
      name: "Recipient User",
    });
    mockInsertReturning({ id: "gift-123", slug: "abc123", shortCode: "xyz123ab" });

    const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

    const request = new NextRequest("http://localhost/api/gifts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-user-id": "sender-123",
        "x-user-email": "sender@example.com",
      },
      body: JSON.stringify({
        recipient: "recipient-123",
        amount: 100,
        currency: "USD",
        unlock_at: twoHoursFromNow,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.giftId).toBe("gift-123");
  });

  it("should accept valid ISO 8601 with offset timezone for unlock_at", async () => {
    (db.query.users.findFirst as jest.Mock).mockResolvedValue({
      id: "recipient-123",
      email: "recipient@example.com",
      name: "Recipient User",
    });
    mockInsertReturning({ id: "gift-123", slug: "abc123", shortCode: "xyz123ab" });

    // Create a date 2 hours from now and format it with +01:00 timezone
    const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000);
    // Create a proper ISO 8601 string with offset timezone and milliseconds
    // We need to adjust the time to account for the +01:00 offset
    const adjustedDate = new Date(twoHoursFromNow.getTime() - (1 * 60 * 60 * 1000)); // Subtract 1 hour for +01:00 offset
    
    const year = adjustedDate.getUTCFullYear();
    const month = String(adjustedDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(adjustedDate.getUTCDate()).padStart(2, '0');
    const hours = String(adjustedDate.getUTCHours()).padStart(2, '0');
    const minutes = String(adjustedDate.getUTCMinutes()).padStart(2, '0');
    const seconds = String(adjustedDate.getUTCSeconds()).padStart(2, '0');
    const milliseconds = String(adjustedDate.getUTCMilliseconds()).padStart(3, '0');
    
    const offsetFormat = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}+01:00`;

    const request = new NextRequest("http://localhost/api/gifts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-user-id": "sender-123",
        "x-user-email": "sender@example.com",
      },
      body: JSON.stringify({
        recipient: "recipient-123",
        amount: 100,
        currency: "USD",
        unlock_at: offsetFormat,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.giftId).toBe("gift-123");
  });
});
