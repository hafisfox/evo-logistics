"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  DOCharge,
  DestinationCharge,
  TransportCharge,
  AirCarrierProfile,
  AirChargeRate,
  TruckCarrierProfile,
  TruckLaneRate,
  LtlFreightClass,
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

// --- Land freight: truck carrier profiles, FTL lane rates, LTL freight classes ---

type TruckCarrierCreatePayload = Omit<TruckCarrierProfile, "id">;
type TruckCarrierUpdatePayload = { id: number } & Partial<Omit<TruckCarrierProfile, "id">>;
type TruckLaneRateCreatePayload = Omit<TruckLaneRate, "id">;
type TruckLaneRateUpdatePayload = { id: number } & Partial<Omit<TruckLaneRate, "id">>;
type LtlClassCreatePayload = Omit<LtlFreightClass, "id">;
type LtlClassUpdatePayload = { id: number } & Partial<Omit<LtlFreightClass, "id">>;

export function useTruckCarriers() {
  return useQuery<TruckCarrierProfile[]>({
    queryKey: ["pricing", "land-carriers"],
    queryFn: async () => {
      const res = await fetch("/api/pricing/land-carriers");
      if (!res.ok) throw new Error("Failed to fetch truck carriers");
      return res.json();
    },
    refetchInterval: 600_000,
  });
}

export function useCreateTruckCarrier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: TruckCarrierCreatePayload) => {
      const res = await fetch("/api/pricing/land-carriers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await parseError(res, "Failed to create truck carrier"));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pricing", "land-carriers"] });
    },
  });
}

export function useUpdateTruckCarrier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: TruckCarrierUpdatePayload) => {
      const res = await fetch("/api/pricing/land-carriers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await parseError(res, "Failed to update truck carrier"));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pricing", "land-carriers"] });
    },
  });
}

export function useDeleteTruckCarrier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: IdPayload) => {
      const res = await fetch("/api/pricing/land-carriers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await parseError(res, "Failed to delete truck carrier"));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pricing", "land-carriers"] });
    },
  });
}

export function useTruckLaneRates() {
  return useQuery<TruckLaneRate[]>({
    queryKey: ["pricing", "land-rates"],
    queryFn: async () => {
      const res = await fetch("/api/pricing/land-rates");
      if (!res.ok) throw new Error("Failed to fetch lane rates");
      return res.json();
    },
    refetchInterval: 600_000,
  });
}

export function useCreateTruckLaneRate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: TruckLaneRateCreatePayload) => {
      const res = await fetch("/api/pricing/land-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await parseError(res, "Failed to create lane rate"));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pricing", "land-rates"] });
    },
  });
}

export function useUpdateTruckLaneRate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: TruckLaneRateUpdatePayload) => {
      const res = await fetch("/api/pricing/land-rates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await parseError(res, "Failed to update lane rate"));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pricing", "land-rates"] });
    },
  });
}

export function useDeleteTruckLaneRate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: IdPayload) => {
      const res = await fetch("/api/pricing/land-rates", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await parseError(res, "Failed to delete lane rate"));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pricing", "land-rates"] });
    },
  });
}

export function useLtlClasses() {
  return useQuery<LtlFreightClass[]>({
    queryKey: ["pricing", "ltl-classes"],
    queryFn: async () => {
      const res = await fetch("/api/pricing/ltl-classes");
      if (!res.ok) throw new Error("Failed to fetch LTL classes");
      return res.json();
    },
    refetchInterval: 600_000,
  });
}

export function useCreateLtlClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: LtlClassCreatePayload) => {
      const res = await fetch("/api/pricing/ltl-classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await parseError(res, "Failed to create LTL class"));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pricing", "ltl-classes"] });
    },
  });
}

export function useUpdateLtlClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: LtlClassUpdatePayload) => {
      const res = await fetch("/api/pricing/ltl-classes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await parseError(res, "Failed to update LTL class"));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pricing", "ltl-classes"] });
    },
  });
}

export function useDeleteLtlClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: IdPayload) => {
      const res = await fetch("/api/pricing/ltl-classes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await parseError(res, "Failed to delete LTL class"));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pricing", "ltl-classes"] });
    },
  });
}
