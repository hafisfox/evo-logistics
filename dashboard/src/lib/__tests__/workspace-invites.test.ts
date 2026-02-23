import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient, User } from "@supabase/supabase-js";

import { acceptWorkspaceInviteForUser } from "@/lib/workspace-invites";
import type { Database } from "@/types/supabase";

const {
  fromMock,
  maybeSingleMock,
  membershipUpsertMock,
  inviteUpdateEqMock,
  profileUpsertMock,
} = vi.hoisted(() => {
  const maybeSingleMock = vi.fn();
  const inviteSelectEqMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
  const inviteSelectMock = vi.fn(() => ({ eq: inviteSelectEqMock }));

  const inviteUpdateEqMock = vi.fn();
  const inviteUpdateMock = vi.fn(() => ({ eq: inviteUpdateEqMock }));

  const membershipUpsertMock = vi.fn();
  const profileUpsertMock = vi.fn();

  const fromMock = vi.fn((table: string) => {
    if (table === "workspace_invites") {
      return {
        select: inviteSelectMock,
        update: inviteUpdateMock,
      };
    }

    if (table === "workspace_members") {
      return {
        upsert: membershipUpsertMock,
      };
    }

    if (table === "user_profiles") {
      return {
        upsert: profileUpsertMock,
      };
    }

    throw new Error(`Unexpected table ${table}`);
  });

  return {
    fromMock,
    maybeSingleMock,
    membershipUpsertMock,
    inviteUpdateEqMock,
    profileUpsertMock,
  };
});

describe("acceptWorkspaceInviteForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    maybeSingleMock.mockResolvedValue({
      data: {
        id: "inv-1",
        workspace_id: "ws-1",
        email: "invitee@example.com",
        role: "member",
        status: "pending",
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      },
      error: null,
    });

    membershipUpsertMock.mockResolvedValue({
      error: null,
    });

    inviteUpdateEqMock.mockResolvedValue({
      error: null,
    });

    profileUpsertMock.mockResolvedValue({
      error: null,
    });
  });

  it("returns error when invite status update fails after membership upsert", async () => {
    inviteUpdateEqMock.mockResolvedValue({
      error: { message: "invite update failed" },
    });

    const supabase = { from: fromMock } as unknown as SupabaseClient<Database>;
    const user = {
      id: "u-1",
      email: "invitee@example.com",
    } as unknown as User;

    const result = await acceptWorkspaceInviteForUser(supabase, user, "token-1");

    expect(result).toEqual({
      error: "invite_status_update_failed",
    });
  });

  it("succeeds even if profile default workspace upsert fails", async () => {
    profileUpsertMock.mockResolvedValue({
      error: { message: "profile upsert failed" },
    });

    const supabase = { from: fromMock } as unknown as SupabaseClient<Database>;
    const user = {
      id: "u-1",
      email: "invitee@example.com",
    } as unknown as User;

    const result = await acceptWorkspaceInviteForUser(supabase, user, "token-1");

    expect(result).toEqual({
      workspaceId: "ws-1",
    });
  });
});
