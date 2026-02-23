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

import { DELETE, GET, PATCH, POST } from "@/app/api/pricing/dest-charges/route";

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

describe("/api/pricing/dest-charges route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireWorkspaceApiContextMock.mockResolvedValue({
      context: { workspaceId: "ws-1", userId: "u-1", role: "owner" },
    });
  });

  it("maps GET rows into dashboard format with id", async () => {
    const queue = makeQueue();
    queue.enqueue("v_destination_charges_legacy:selectOrder", {
      data: [{ id: 7, charge_type: "THC", basis: "per container", "20FT": 100, "40FT": 200 }],
      error: null,
    });

    createClientMock.mockResolvedValue(buildSupabaseMock(queue.take));

    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      {
        id: 7,
        "Charge Type": "THC",
        Basis: "per container",
        "20FT": 100,
        "40FT": 200,
      },
    ]);
  });

  it("creates destination charge row", async () => {
    const queue = makeQueue();
    queue.enqueue("destination_charge_items:insertSelectSingle", {
      data: { id: 1 },
      error: null,
    });
    queue.enqueue("destination_charge_rates:upsert", { data: null, error: null });
    queue.enqueue("v_destination_charges_legacy:selectOrder", {
      data: [{ id: 1, charge_type: "THC", basis: "per container", "20FT": 100, "40FT": 200 }],
      error: null,
    });

    createClientMock.mockResolvedValue(buildSupabaseMock(queue.take));

    const request = new Request("http://localhost/api/pricing/dest-charges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        "Charge Type": "THC",
        Basis: "per container",
        "20FT": 100,
        "40FT": 200,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      row: {
        id: 1,
        "Charge Type": "THC",
        Basis: "per container",
      },
    });
  });

  it("updates destination charge row", async () => {
    const queue = makeQueue();
    queue.enqueue("destination_charge_items:selectSingle", {
      data: { id: 2 },
      error: null,
    });
    queue.enqueue("destination_charge_items:update", { data: null, error: null });
    queue.enqueue("v_destination_charges_legacy:selectOrder", {
      data: [{ id: 2, charge_type: "Delivery", basis: "flat", "20FT": 40, "40FT": 60 }],
      error: null,
    });

    createClientMock.mockResolvedValue(buildSupabaseMock(queue.take));

    const request = new Request("http://localhost/api/pricing/dest-charges", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: 2, Basis: "flat" }),
    });

    const response = await PATCH(request);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true });
  });

  it("returns 404 on missing destination charge row", async () => {
    const queue = makeQueue();
    queue.enqueue("destination_charge_items:selectSingle", {
      data: null,
      error: { code: "PGRST116", message: "No rows" },
    });
    queue.enqueue("destination_charges:updateSelectSingle", {
      data: null,
      error: { code: "PGRST116", message: "No rows" },
    });

    createClientMock.mockResolvedValue(buildSupabaseMock(queue.take));

    const request = new Request("http://localhost/api/pricing/dest-charges", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: 999, Basis: "flat" }),
    });

    const response = await PATCH(request);
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: "Destination charge row not found",
    });
  });

  it("deletes destination charge row", async () => {
    const queue = makeQueue();
    queue.enqueue("destination_charge_items:deleteSelect", {
      data: [{ id: 8 }],
      error: null,
    });

    createClientMock.mockResolvedValue(buildSupabaseMock(queue.take));

    const request = new Request("http://localhost/api/pricing/dest-charges", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: 8 }),
    });

    const response = await DELETE(request);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
  });
});
