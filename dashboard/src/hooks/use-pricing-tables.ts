"use client";

import { useQuery } from "@tanstack/react-query";
import type {
  DOCharge,
  DestinationCharge,
  TransportCharge,
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
