import { describe, expect, it } from "vitest";
import {
  validateAgentCreateBody,
  validateAgentDeleteBody,
  validateAgentUpdateBody,
  validateDOChargeCreateBody,
  validateDOChargeUpdateBody,
  validateDestinationChargeCreateBody,
  validateDestinationChargeUpdateBody,
  validateTransportChargeCreateBody,
  validateTransportChargeUpdateBody,
  validateIdDeleteBody,
} from "@/lib/validation";

describe("CRUD validation", () => {
  it("accepts valid agent create payload", () => {
    const result = validateAgentCreateBody({
      agent_name: "  Alpha Logistics  ",
      email: "Ops@Alpha.com",
      status: "active",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({
      agent_name: "Alpha Logistics",
      email: "ops@alpha.com",
      status: "active",
    });
  });

  it("rejects invalid agent email", () => {
    const result = validateAgentCreateBody({
      agent_name: "Agent",
      email: "invalid-email",
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toBe("Invalid agent payload");
    expect(result.details.some((detail) => detail.includes("email"))).toBe(true);
  });

  it("requires current_agent_name and at least one update field", () => {
    const result = validateAgentUpdateBody({ current_agent_name: "Agent A" });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toBe("Invalid agent payload");
    expect(
      result.details.some((detail) =>
        detail.includes("At least one updatable field")
      )
    ).toBe(true);
  });

  it("accepts valid agent delete payload", () => {
    const result = validateAgentDeleteBody({ agent_name: "  Agent A " });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({ agent_name: "Agent A" });
  });

  it("parses DO charge numeric values", () => {
    const result = validateDOChargeCreateBody({
      carrier: "MSC",
      document: "120",
      "20FT": "200",
      "40FT": 300,
      "40HQ": "400",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({
      carrier: "MSC",
      document: 120,
      "20FT": 200,
      "40FT": 300,
      "40HQ": 400,
    });
  });

  it("rejects invalid DO update numeric value", () => {
    const result = validateDOChargeUpdateBody({
      id: 12,
      document: "not-a-number",
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toBe("Invalid DO charges payload");
  });

  it("validates destination charge create payload", () => {
    const result = validateDestinationChargeCreateBody({
      "Charge Type": "THC",
      Basis: "per container",
      "20FT": "150",
      "40FT": "300",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({
      charge_type: "THC",
      basis: "per container",
      "20FT": 150,
      "40FT": 300,
    });
  });

  it("requires update fields for destination charge update", () => {
    const result = validateDestinationChargeUpdateBody({ id: 1 });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toBe("Invalid destination charges payload");
  });

  it("validates transport charge payload", () => {
    const result = validateTransportChargeCreateBody({
      Place: "Jebel Ali",
      Price: "575",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({
      place: "Jebel Ali",
      price: 575,
    });
  });

  it("requires update fields for transport update", () => {
    const result = validateTransportChargeUpdateBody({ id: 1 });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toBe("Invalid transport charges payload");
  });

  it("validates shared id delete payload", () => {
    const result = validateIdDeleteBody({ id: "7" }, "transport charges");

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({ id: 7 });
  });
});
