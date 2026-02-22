import { beforeEach, describe, expect, it, vi } from "vitest";

const { signOutMock, createClientMock } = vi.hoisted(() => ({
  signOutMock: vi.fn(),
  createClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import { POST } from "@/app/api/auth/logout/route";

describe("/api/auth/logout route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClientMock.mockResolvedValue({
      auth: {
        signOut: signOutMock,
      },
    });
  });

  it("signs out and returns success", async () => {
    signOutMock.mockResolvedValue({ error: null });

    const response = await POST();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
  });

  it("returns 500 when sign out fails", async () => {
    signOutMock.mockResolvedValue({ error: new Error("boom") });

    const response = await POST();
    expect(response.status).toBe(500);
  });
});

