"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  DOCharge,
  DestinationCharge,
  TransportCharge,
  AirCarrierProfile,
  AirChargeRate,
} from "@/types/pricing";

export function useDOCharges() {
  return useQuery<DOCharge[]>({
    queryKey: ["pricing", "do-charges"],
    queryFn: async () => {
      const res = await fetch("/api/pricing/do-charges");
      if (!res.ok) throw new Error("Failed to fetch DO charges");
      return res.json();
    },
    refetchInterval: 600_000,
  });
}

export function useDestCharges() {
  return useQuery<DestinationCharge[]>({
    queryKey: ["pricing", "dest-charges"],
    queryFn: async () => {
      const res = await fetch("/api/pricing/dest-charges");
      if (!res.ok) throw new Error("Failed to fetch destination charges");
      return res.json();
    },
    refetchInterval: 600_000,
  });
}

export function useTransportCharges() {
  return useQuery<TransportCharge[]>({
    queryKey: ["pricing", "transport"],
    queryFn: async () => {
      const res = await fetch("/api/pricing/transport");
      if (!res.ok) throw new Error("Failed to fetch transport charges");
      return res.json();
    },
    refetchInterval: 600_000,
  });
}

type DoChargeCreatePayload = Omit<DOCharge, "id">;
type DoChargeUpdatePayload = {
  id: number;
  carrier?: string;
  document?: number;
  "20FT"?: number;
  "40FT"?: number;
  "40HQ"?: number;
};

type DestinationChargeCreatePayload = Omit<DestinationCharge, "id">;
type DestinationChargeUpdatePayload = {
  id: number;
  "Charge Type"?: string;
  Basis?: string;
  "20FT"?: number;
  "40FT"?: number;
};

type TransportChargeCreatePayload = Omit<TransportCharge, "id">;
type TransportChargeUpdatePayload = {
  id: number;
  Place?: string;
  Price?: number;
};

interface IdPayload {
  id: number;
}

async function parseError(res: Response, fallback: string) {
  try {
    const payload = (await res.json()) as { error?: string; details?: string[] };
    if (payload.details?.length) {
      return `${payload.error || fallback}: ${payload.details.join(" ")}`;
    }
    return payload.error || fallback;
  } catch {
    return fallback;
  }
}

export function useCreateDOCharge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: DoChargeCreatePayload) => {
      const res = await fetch("/api/pricing/do-charges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await parseError(res, "Failed to create DO charge"));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pricing", "do-charges"] });
    },
  });
}

export function useUpdateDOCharge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: DoChargeUpdatePayload) => {
      const res = await fetch("/api/pricing/do-charges", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await parseError(res, "Failed to update DO charge"));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pricing", "do-charges"] });
    },
  });
}

export function useDeleteDOCharge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: IdPayload) => {
      const res = await fetch("/api/pricing/do-charges", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await parseError(res, "Failed to delete DO charge"));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pricing", "do-charges"] });
    },
  });
}

export function useCreateDestinationCharge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: DestinationChargeCreatePayload) => {
      const res = await fetch("/api/pricing/dest-charges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await parseError(res, "Failed to create destination charge"));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pricing", "dest-charges"] });
    },
  });
}

export function useUpdateDestinationCharge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: DestinationChargeUpdatePayload) => {
      const res = await fetch("/api/pricing/dest-charges", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await parseError(res, "Failed to update destination charge"));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pricing", "dest-charges"] });
    },
  });
}

export function useDeleteDestinationCharge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: IdPayload) => {
      const res = await fetch("/api/pricing/dest-charges", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await parseError(res, "Failed to delete destination charge"));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pricing", "dest-charges"] });
    },
  });
}

export function useCreateTransportCharge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: TransportChargeCreatePayload) => {
      const res = await fetch("/api/pricing/transport", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await parseError(res, "Failed to create transport charge"));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pricing", "transport"] });
    },
  });
}

export function useUpdateTransportCharge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: TransportChargeUpdatePayload) => {
      const res = await fetch("/api/pricing/transport", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await parseError(res, "Failed to update transport charge"));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pricing", "transport"] });
    },
  });
}

export function useDeleteTransportCharge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: IdPayload) => {
      const res = await fetch("/api/pricing/transport", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await parseError(res, "Failed to delete transport charge"));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pricing", "transport"] });
    },
  });
}

// --- Air freight: carrier profiles + weight-tier rates ---

type AirCarrierCreatePayload = Omit<AirCarrierProfile, "id">;
type AirCarrierUpdatePayload = { id: number } & Partial<Omit<AirCarrierProfile, "id">>;
type AirRateCreatePayload = Omit<AirChargeRate, "id">;
type AirRateUpdatePayload = { id: number } & Partial<Omit<AirChargeRate, "id">>;

export function useAirCarriers() {
  return useQuery<AirCarrierProfile[]>({
    queryKey: ["pricing", "air-carriers"],
    queryFn: async () => {
      const res = await fetch("/api/pricing/air-carriers");
      if (!res.ok) throw new Error("Failed to fetch air carriers");
      return res.json();
    },
    refetchInterval: 600_000,
  });
}

export function useCreateAirCarrier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: AirCarrierCreatePayload) => {
      const res = await fetch("/api/pricing/air-carriers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await parseError(res, "Failed to create air carrier"));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pricing", "air-carriers"] });
    },
  });
}

export function useUpdateAirCarrier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: AirCarrierUpdatePayload) => {
      const res = await fetch("/api/pricing/air-carriers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await parseError(res, "Failed to update air carrier"));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pricing", "air-carriers"] });
    },
  });
}

export function useDeleteAirCarrier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: IdPayload) => {
      const res = await fetch("/api/pricing/air-carriers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await parseError(res, "Failed to delete air carrier"));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pricing", "air-carriers"] });
    },
  });
}

export function useAirRates() {
  return useQuery<AirChargeRate[]>({
    queryKey: ["pricing", "air-rates"],
    queryFn: async () => {
      const res = await fetch("/api/pricing/air-rates");
      if (!res.ok) throw new Error("Failed to fetch air rates");
      return res.json();
    },
    refetchInterval: 600_000,
  });
}

export function useCreateAirRate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: AirRateCreatePayload) => {
      const res = await fetch("/api/pricing/air-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await parseError(res, "Failed to create air rate"));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pricing", "air-rates"] });
    },
  });
}

export function useUpdateAirRate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: AirRateUpdatePayload) => {
      const res = await fetch("/api/pricing/air-rates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await parseError(res, "Failed to update air rate"));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pricing", "air-rates"] });
    },
  });
}

export function useDeleteAirRate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: IdPayload) => {
      const res = await fetch("/api/pricing/air-rates", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await parseError(res, "Failed to delete air rate"));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pricing", "air-rates"] });
    },
  });
}
