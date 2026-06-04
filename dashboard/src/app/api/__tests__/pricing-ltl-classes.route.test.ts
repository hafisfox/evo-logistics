import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireWorkspaceApiContextMock } = vi.hoisted(() => ({
  requireWorkspaceApiContextMock: vi.fn(),
}));

const { createClientMock, fromSpy, setListResult, setSingleResult } = vi.hoisted(() => {
  let listResult: { data: unknown; error: unknown } = { data: [], error: null };
  let singleResult: { data: unknown; error: unknown } = { data: null, error: null };
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.order = () => chain;
  chain.insert = () => chain;
  chain.update = () => chain;
  chain.delete = () => chain;
  chain.single = () => Promise.resolve(singleResult);
  chain.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(listResult).then(resolve, reject);
  const fromSpy = vi.fn(() => chain);
  const createClientMock = vi.fn();
  return {
    createClientMock,
    fromSpy,
    setListResult: (r: { data: unknown; error: unknown }) => {
      listResult = r;
    },
    setSingleResult: (r: { data: unknown; error: unknown }) => {
      singleResult = r;
    },
  };
});

vi.mock("@/lib/workspace-context", () => ({
  requireWorkspaceApiContext: requireWorkspaceApiContextMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import { DELETE, GET, POST } from "@/app/api/pricing/ltl-classes/route";

function postBody(body: unknown) {
  return new Request("http://localhost/api/pricing/ltl-classes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/pricing/ltl-classes route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClientMock.mockResolvedValue({ from: fromSpy });
    requireWorkspaceApiContextMock.mockResolvedValue({
      context: { workspaceId: "ws-1", userId: "u-1", role: "owner" },
    });
    setListResult({ data: [], error: null });
    setSingleResult({ data: null, error: null });
  });

  it("maps GET rows with nullable density coerced", async () => {
    setListResult({
      data: [
        { id: 1, nmfc_class: "70", description: "Auto parts", min_density: 15, max_density: null, rate_per_100lb_usd: 30, min_charge_usd: 90 },
      ],
      error: null,
    });
    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      { id: 1, nmfc_class: "70", description: "Auto parts", min_density: 15, max_density: null, rate_per_100lb_usd: 30, min_charge_usd: 90 },
    ]);
  });

  it("creates an LTL class", async () => {
    setSingleResult({
      data: { id: 1, nmfc_class: "70", description: "", min_density: null, max_density: null, rate_per_100lb_usd: 30, min_charge_usd: 0 },
      error: null,
    });
    const response = await POST(postBody({ nmfc_class: "70", rate_per_100lb_usd: 30 }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true, row: { id: 1, nmfc_class: "70" } });
  });

  it("returns 400 when rate_per_100lb_usd is missing", async () => {
    const response = await POST(postBody({ nmfc_class: "70" }));
    expect(response.status).toBe(400);
  });

  it("returns 409 on duplicate class", async () => {
    setSingleResult({ data: null, error: { code: "23505", message: "duplicate key value" } });
    const response = await POST(postBody({ nmfc_class: "70", rate_per_100lb_usd: 30 }));
    expect(response.status).toBe(409);
  });

  it("deletes an LTL class", async () => {
    setListResult({ data: [], error: null });
    const request = new Request("http://localhost/api/pricing/ltl-classes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: 9 }),
    });
    const response = await DELETE(request);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
  });
});
