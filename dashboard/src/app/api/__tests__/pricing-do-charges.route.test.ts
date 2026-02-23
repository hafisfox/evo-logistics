import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireWorkspaceApiContextMock } = vi.hoisted(() => ({
  requireWorkspaceApiContextMock: vi.fn(),
}));

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

vi.mock("@/lib/workspace-context", () => ({
  requireWorkspaceApiContext: requireWorkspaceApiContextMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import { DELETE, GET, PATCH, POST } from "@/app/api/pricing/do-charges/route";

type QueryResult = { data: unknown; error: unknown };

function makeQueue() {
  const queues = new Map<string, QueryResult[]>();

  const enqueue = (key: string, result: QueryResult) => {
    const existing = queues.get(key) || [];
    existing.push(result);
    queues.set(key, existing);
  };

  const take = (key: string, fallback: QueryResult = { data: null, error: null }): QueryResult => {
    const existing = queues.get(key);
    if (!existing || existing.length === 0) return fallback;
    const next = existing.shift();
    if (existing.length === 0) {
      queues.delete(key);
    } else {
      queues.set(key, existing);
    }
    return next || fallback;
  };

  return { enqueue, take };
}

function buildSupabaseMock(take: (key: string, fallback?: QueryResult) => QueryResult) {
  const makeSelectChain = (table: string) => {
    const chain: {
      eq: ReturnType<typeof vi.fn>;
      in: ReturnType<typeof vi.fn>;
      is: ReturnType<typeof vi.fn>;
      order: ReturnType<typeof vi.fn>;
      single: ReturnType<typeof vi.fn>;
    } = {
      eq: vi.fn(() => chain),
      in: vi.fn(() => chain),
      is: vi.fn(() => chain),
      order: vi.fn(() => Promise.resolve(take(`${table}:selectOrder`))),
      single: vi.fn(() => Promise.resolve(take(`${table}:selectSingle`))),
    };
    return chain;
  };

  const makeMutationChain = (table: string, operation: "insert" | "update" | "delete") => {
    const base = take(`${table}:${operation}`);
    const chain: {
      data: unknown;
      error: unknown;
      eq: ReturnType<typeof vi.fn>;
      select: ReturnType<typeof vi.fn>;
    } = {
      data: base.data,
      error: base.error,
      eq: vi.fn(() => chain),
      select: vi.fn(() => {
        const selectBase = take(`${table}:${operation}Select`);
        const selectChain: {
          data: unknown;
          error: unknown;
          eq: ReturnType<typeof vi.fn>;
          single: ReturnType<typeof vi.fn>;
        } = {
          data: selectBase.data,
          error: selectBase.error,
          eq: vi.fn(() => selectChain),
          single: vi.fn(() =>
            Promise.resolve(take(`${table}:${operation}SelectSingle`, selectBase))
          ),
        };
        return selectChain;
      }),
    };
    return chain;
  };

  return {
    from: vi.fn((table: string) => ({
      select: vi.fn(() => makeSelectChain(table)),
      insert: vi.fn(() => makeMutationChain(table, "insert")),
      update: vi.fn(() => makeMutationChain(table, "update")),
      delete: vi.fn(() => makeMutationChain(table, "delete")),
      upsert: vi.fn(() => Promise.resolve(take(`${table}:upsert`))),
    })),
  };
}

describe("/api/pricing/do-charges route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireWorkspaceApiContextMock.mockResolvedValue({
      context: { workspaceId: "ws-1", userId: "u-1", role: "owner" },
    });
  });

  it("returns DO charges from GET", async () => {
    const queue = makeQueue();
    queue.enqueue("v_do_charges_legacy:selectOrder", {
      data: [{ id: 1, carrier: "MSC", document: 120, "20FT": 200, "40FT": 300, "40HQ": 350 }],
      error: null,
    });

    createClientMock.mockResolvedValue(buildSupabaseMock(queue.take));

    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toHaveLength(1);
  });

  it("creates DO charge row", async () => {
    const queue = makeQueue();
    queue.enqueue("do_charge_profiles:insertSelectSingle", {
      data: { id: 1 },
      error: null,
    });
    queue.enqueue("do_charge_rates:upsert", { data: null, error: null });
    queue.enqueue("v_do_charges_legacy:selectOrder", {
      data: [{ id: 1, carrier: "MSC", document: 120, "20FT": 200, "40FT": 300, "40HQ": 350 }],
      error: null,
    });

    createClientMock.mockResolvedValue(buildSupabaseMock(queue.take));

    const request = new Request("http://localhost/api/pricing/do-charges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        carrier: "MSC",
        document: 120,
        "20FT": 200,
        "40FT": 300,
        "40HQ": 350,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true });
  });

  it("rejects invalid numeric payload", async () => {
    const request = new Request("http://localhost/api/pricing/do-charges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        carrier: "MSC",
        document: "abc",
        "20FT": 200,
        "40FT": 300,
        "40HQ": 350,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Invalid DO charges payload",
    });
  });

  it("returns 409 on duplicate carrier", async () => {
    const queue = makeQueue();
    queue.enqueue("do_charge_profiles:insertSelectSingle", {
      data: null,
      error: {
        code: "23505",
        message: 'duplicate key value violates unique constraint "do_charge_profiles_workspace_id_carrier_key"',
      },
    });

    createClientMock.mockResolvedValue(buildSupabaseMock(queue.take));

    const request = new Request("http://localhost/api/pricing/do-charges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        carrier: "MSC",
        document: 120,
        "20FT": 200,
        "40FT": 300,
        "40HQ": 350,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: "DO charge for this carrier already exists",
    });
  });

  it("updates DO charge row", async () => {
    const queue = makeQueue();
    queue.enqueue("do_charge_profiles:selectSingle", {
      data: { id: 2 },
      error: null,
    });
    queue.enqueue("do_charge_profiles:update", { data: null, error: null });
    queue.enqueue("v_do_charges_legacy:selectOrder", {
      data: [{ id: 2, carrier: "COSCO", document: 99, "20FT": 180, "40FT": 260, "40HQ": 290 }],
      error: null,
    });

    createClientMock.mockResolvedValue(buildSupabaseMock(queue.take));

    const request = new Request("http://localhost/api/pricing/do-charges", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: 2, document: 99 }),
    });

    const response = await PATCH(request);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true });
  });

  it("returns 404 on missing DO row update", async () => {
    const queue = makeQueue();
    queue.enqueue("do_charge_profiles:selectSingle", {
      data: null,
      error: { code: "PGRST116", message: "No rows" },
    });
    queue.enqueue("do_charges:updateSelectSingle", {
      data: null,
      error: { code: "PGRST116", message: "No rows" },
    });

    createClientMock.mockResolvedValue(buildSupabaseMock(queue.take));

    const request = new Request("http://localhost/api/pricing/do-charges", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: 999, document: 99 }),
    });

    const response = await PATCH(request);
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: "DO charge row not found" });
  });

  it("deletes DO charge row", async () => {
    const queue = makeQueue();
    queue.enqueue("do_charge_profiles:deleteSelect", {
      data: [{ id: 4 }],
      error: null,
    });

    createClientMock.mockResolvedValue(buildSupabaseMock(queue.take));

    const request = new Request("http://localhost/api/pricing/do-charges", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: 4 }),
    });

    const response = await DELETE(request);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
  });
});
