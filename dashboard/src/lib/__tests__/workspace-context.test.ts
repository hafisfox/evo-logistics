import { describe, expect, it } from "vitest";

import { pickWorkspaceMembership } from "@/lib/workspace-context";

const memberships = [
  { workspaceId: "ws-1", role: "member" as const },
  { workspaceId: "ws-2", role: "owner" as const },
];

describe("pickWorkspaceMembership", () => {
  it("prefers cookie workspace when it belongs to the user", () => {
    const selected = pickWorkspaceMembership(memberships, "ws-2", null);
    expect(selected?.workspaceId).toBe("ws-2");
  });

  it("falls back to default workspace when cookie workspace is invalid", () => {
    const selected = pickWorkspaceMembership(memberships, "ws-999", "ws-1");
    expect(selected?.workspaceId).toBe("ws-1");
  });

  it("falls back to the first membership when no preferred values exist", () => {
    const selected = pickWorkspaceMembership(memberships, null, null);
    expect(selected?.workspaceId).toBe("ws-1");
  });

  it("returns null when user has no memberships", () => {
    const selected = pickWorkspaceMembership([], null, null);
    expect(selected).toBeNull();
  });
});

