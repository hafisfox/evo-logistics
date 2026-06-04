"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Loader2, Ship, Plane, Truck, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FreightMode } from "@/types/rfq";
import {
  EQUIPMENT_BY_MODE,
  SERVICE_TYPES_BY_MODE,
  FEATURE_AIR_FREIGHT_ENABLED,
  FEATURE_LAND_FREIGHT_ENABLED,
} from "@/lib/constants";

interface ContainerEntry {
  container_type: string;
  qty: number;
}

interface PieceEntry {
  count: string;
  length_cm: string;
  width_cm: string;
  height_cm: string;
  weight_kg: string;
  packaging_type: string;
}

interface ShipmentEntry {
  freight_mode: FreightMode;
  pol: string;
  pod: string;
  service_type: string;
  ready_date: string;
  delivery_deadline: string;
  pickup_address: string;
  delivery_address: string;
  containers: ContainerEntry[];
  pieces: PieceEntry[];
  commodity_description: string;
  hs_code: string;
  incoterms: string;
  is_dangerous_goods: boolean;
  is_reefer: boolean;
  special_requirements: string;
  cargo_weight_kg: string;
  cargo_volume_cbm: string;
  // Land/trucking fields
  load_type: string;
  equipment_type: string;
  weight_lbs: string;
  nmfc_class: string;
  origin_zip: string;
  destination_zip: string;
}

function emptyPiece(): PieceEntry {
  return { count: "1", length_cm: "", width_cm: "", height_cm: "", weight_kg: "", packaging_type: "PALLET" };
}

function emptyShipment(mode: FreightMode = "ocean"): ShipmentEntry {
  return {
    freight_mode: mode,
    pol: "",
    pod: "",
    service_type: SERVICE_TYPES_BY_MODE[mode][0],
    ready_date: "",
    delivery_deadline: "",
    pickup_address: "",
    delivery_address: "",
    containers: mode === "ocean" ? [{ container_type: "40HQ", qty: 1 }] : [],
    pieces: mode === "air" ? [emptyPiece()] : [],
    commodity_description: "",
    hs_code: "",
    incoterms: "",
    is_dangerous_goods: false,
    is_reefer: false,
    special_requirements: "",
    cargo_weight_kg: "",
    cargo_volume_cbm: "",
    load_type: mode === "land" ? "FTL" : "",
    equipment_type: mode === "land" ? EQUIPMENT_BY_MODE.land[0] : "",
    weight_lbs: "",
    nmfc_class: "",
    origin_zip: "",
    destination_zip: "",
  };
}

const INCOTERMS = ["", "EXW", "FCA", "FAS", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"];

const inputClass =
  "w-full rounded-xl border border-white/20 dark:border-white/10 bg-white/40 dark:bg-black/20 px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const selectClass =
  "w-full rounded-xl border border-white/20 dark:border-white/10 bg-white/40 dark:bg-black/20 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const MODE_LABELS: Record<FreightMode, { origin: string; destination: string; originPlaceholder: string; destPlaceholder: string }> = {
  ocean: { origin: "Port of Loading *", destination: "Port of Discharge *", originPlaceholder: "e.g. Jebel Ali", destPlaceholder: "e.g. Shanghai" },
  air: { origin: "Origin Airport *", destination: "Destination Airport *", originPlaceholder: "e.g. DXB", destPlaceholder: "e.g. LHR" },
  land: { origin: "Origin City / ZIP *", destination: "Destination City / ZIP *", originPlaceholder: "e.g. Dubai", destPlaceholder: "e.g. Riyadh" },
};

const MODE_ICON: Record<FreightMode, typeof Ship> = { ocean: Ship, air: Plane, land: Truck };

export default function NewRFQPage() {
  const router = useRouter();
  const [customerEmail, setCustomerEmail] = useState("");
  const [shipments, setShipments] = useState<ShipmentEntry[]>([emptyShipment()]);
  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<string[]>([]);

  const hasEmailError = formErrors.some((d) => d.toLowerCase().includes("customer_email"));

  const updateShipment = (index: number, updates: Partial<ShipmentEntry>) => {
    setShipments((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...updates } : s))
    );
  };

  const addContainer = (shipmentIndex: number) => {
    setShipments((prev) =>
      prev.map((s, i) =>
        i === shipmentIndex
          ? { ...s, containers: [...s.containers, { container_type: "40HQ", qty: 1 }] }
          : s
      )
    );
  };

  const removeContainer = (shipmentIndex: number, containerIndex: number) => {
    setShipments((prev) =>
      prev.map((s, i) =>
        i === shipmentIndex
          ? { ...s, containers: s.containers.filter((_, ci) => ci !== containerIndex) }
          : s
      )
    );
  };

  const updateContainer = (
    shipmentIndex: number,
    containerIndex: number,
    updates: Partial<ContainerEntry>
  ) => {
    setShipments((prev) =>
      prev.map((s, i) =>
        i === shipmentIndex
          ? {
              ...s,
              containers: s.containers.map((c, ci) =>
                ci === containerIndex ? { ...c, ...updates } : c
              ),
            }
          : s
      )
    );
  };

  const addPiece = (shipmentIndex: number) => {
    setShipments((prev) =>
      prev.map((s, i) =>
        i === shipmentIndex
          ? { ...s, pieces: [...s.pieces, emptyPiece()] }
          : s
      )
    );
  };

  const removePiece = (shipmentIndex: number, pieceIndex: number) => {
    setShipments((prev) =>
      prev.map((s, i) =>
        i === shipmentIndex
          ? { ...s, pieces: s.pieces.filter((_, pi) => pi !== pieceIndex) }
          : s
      )
    );
  };

  const updatePiece = (
    shipmentIndex: number,
    pieceIndex: number,
    updates: Partial<PieceEntry>
  ) => {
    setShipments((prev) =>
      prev.map((s, i) =>
        i === shipmentIndex
          ? {
              ...s,
              pieces: s.pieces.map((p, pi) =>
                pi === pieceIndex ? { ...p, ...updates } : p
              ),
            }
          : s
      )
    );
  };

  const handleModeChange = (shipmentIndex: number, newMode: FreightMode) => {
    updateShipment(shipmentIndex, {
      freight_mode: newMode,
      service_type: SERVICE_TYPES_BY_MODE[newMode][0],
      containers: newMode === "ocean" ? [{ container_type: "40HQ", qty: 1 }] : [],
      pieces: newMode === "air" ? [emptyPiece()] : [],
      load_type: newMode === "land" ? "FTL" : "",
      equipment_type: newMode === "land" ? EQUIPMENT_BY_MODE.land[0] : "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormErrors([]);

    try {
      const payload = {
        customer_email: customerEmail,
        shipments: shipments.map((s) => ({
          freight_mode: s.freight_mode,
          pol: s.pol,
          pod: s.pod,
          service_type: s.service_type,
          ready_date: s.ready_date || null,
          delivery_deadline: s.delivery_deadline || null,
          pickup_address: s.pickup_address || null,
          delivery_address: s.delivery_address || null,
          containers: s.freight_mode === "ocean" ? s.containers : [],
          pieces:
            s.freight_mode === "air"
              ? s.pieces.map((p) => ({
                  count: p.count ? parseInt(p.count, 10) : null,
                  length_cm: p.length_cm ? parseFloat(p.length_cm) : null,
                  width_cm: p.width_cm ? parseFloat(p.width_cm) : null,
                  height_cm: p.height_cm ? parseFloat(p.height_cm) : null,
                  weight_kg: p.weight_kg ? parseFloat(p.weight_kg) : null,
                  packaging_type: p.packaging_type || null,
                }))
              : [],
          truck_detail:
            s.freight_mode === "land"
              ? {
                  load_type: s.load_type || null,
                  equipment_type: s.equipment_type || null,
                  weight_lbs: s.weight_lbs ? parseFloat(s.weight_lbs) : null,
                  nmfc_class: s.nmfc_class || null,
                  origin_zip: s.origin_zip || null,
                  destination_zip: s.destination_zip || null,
                  accessorials: null,
                }
              : null,
          commodity_description: s.commodity_description || null,
          hs_code: s.hs_code || null,
          incoterms: s.incoterms || null,
          is_dangerous_goods: s.is_dangerous_goods,
          is_reefer: s.is_reefer,
          special_requirements: s.special_requirements || null,
          cargo_weight_kg: s.cargo_weight_kg ? parseFloat(s.cargo_weight_kg) : null,
          cargo_volume_cbm: s.cargo_volume_cbm ? parseFloat(s.cargo_volume_cbm) : null,
        })),
      };

      const res = await fetch("/api/rfqs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const details: string[] = Array.isArray(data.details) && data.details.length > 0
          ? data.details
          : [data.error || "Failed to create RFQ"];
        setFormErrors(details);
        toast.error(data.error || "Please fix the highlighted issues");
        // Surface the summary panel at the top of the form.
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      const result = await res.json();
      toast.success("RFQ created successfully");
      router.push(`/rfqs/${result.rfq_id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create RFQ";
      setFormErrors([message]);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const needsDoor = (st: string) => st.includes("door");

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-700 mt-4 md:mt-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild className="h-10 rounded-xl">
          <Link href="/rfqs">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Pipeline
          </Link>
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {formErrors.length > 0 && (
          <div
            role="alert"
            className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 flex items-start gap-3"
          >
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-destructive">
                Please fix the following before submitting:
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-sm text-destructive/90">
                {formErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
        <Card className="rounded-3xl border border-white/20 dark:border-white/10 bg-card/60 dark:bg-card/40 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] overflow-hidden">
          <CardHeader className="pb-4 px-6 pt-6">
            <div className="flex items-center gap-2">
              <Ship className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg font-bold tracking-tight">
                Create Manual RFQ
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6 space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Customer Email *
              </label>
              <input
                type="email"
                required
                aria-invalid={hasEmailError}
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="customer@example.com"
                className={cn(inputClass, hasEmailError && "border-destructive ring-2 ring-destructive/40")}
              />
            </div>
          </CardContent>
        </Card>

        {shipments.map((shipment, si) => {
          const mode = shipment.freight_mode;
          const labels = MODE_LABELS[mode];
          const ModeIcon = MODE_ICON[mode];
          const serviceTypes = SERVICE_TYPES_BY_MODE[mode];
          const equipmentTypes = EQUIPMENT_BY_MODE[mode];

          return (
            <Card
              key={si}
              className="rounded-3xl border border-white/20 dark:border-white/10 bg-card/60 dark:bg-card/40 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] overflow-hidden"
            >
              <CardHeader className="pb-3 px-6 pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ModeIcon className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-base font-bold">
                      Shipment {si + 1}
                    </CardTitle>
                  </div>
                  {shipments.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setShipments((prev) => prev.filter((_, i) => i !== si))
                      }
                      className="h-8 text-red-500 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Remove
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="px-6 pb-6 space-y-4">
                {/* Freight Mode Selector */}
                {(FEATURE_AIR_FREIGHT_ENABLED || FEATURE_LAND_FREIGHT_ENABLED) && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Freight Mode
                    </label>
                    <select
                      value={mode}
                      onChange={(e) => handleModeChange(si, e.target.value as FreightMode)}
                      className={selectClass}
                    >
                      <option value="ocean">Ocean</option>
                      {FEATURE_AIR_FREIGHT_ENABLED && <option value="air">Air</option>}
                      {FEATURE_LAND_FREIGHT_ENABLED && <option value="land">Land</option>}
                    </select>
                  </div>
                )}

                {/* Route */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      {labels.origin}
                    </label>
                    <input
                      required
                      value={shipment.pol}
                      onChange={(e) => updateShipment(si, { pol: e.target.value })}
                      placeholder={labels.originPlaceholder}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      {labels.destination}
                    </label>
                    <input
                      required
                      value={shipment.pod}
                      onChange={(e) => updateShipment(si, { pod: e.target.value })}
                      placeholder={labels.destPlaceholder}
                      className={inputClass}
                    />
                  </div>
                </div>

                {/* Service type + dates */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Service Type
                    </label>
                    <select
                      value={shipment.service_type}
                      onChange={(e) =>
                        updateShipment(si, { service_type: e.target.value })
                      }
                      className={selectClass}
                    >
                      {serviceTypes.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Ready Date
                    </label>
                    <input
                      type="date"
                      value={shipment.ready_date}
                      onChange={(e) =>
                        updateShipment(si, { ready_date: e.target.value })
                      }
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Delivery Deadline
                    </label>
                    <input
                      type="date"
                      value={shipment.delivery_deadline}
                      onChange={(e) =>
                        updateShipment(si, { delivery_deadline: e.target.value })
                      }
                      className={inputClass}
                    />
                  </div>
                </div>

                {/* Addresses (conditional) */}
                {needsDoor(shipment.service_type) && (
                  <div className="grid grid-cols-2 gap-4">
                    {(shipment.service_type.startsWith("door-to") ||
                      shipment.service_type === "door-to-door") && (
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">
                          Pickup Address
                        </label>
                        <input
                          value={shipment.pickup_address}
                          onChange={(e) =>
                            updateShipment(si, { pickup_address: e.target.value })
                          }
                          placeholder="Full pickup address"
                          className={inputClass}
                        />
                      </div>
                    )}
                    {(shipment.service_type.endsWith("-to-door") ||
                      shipment.service_type === "door-to-door") && (
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">
                          Delivery Address
                        </label>
                        <input
                          value={shipment.delivery_address}
                          onChange={(e) =>
                            updateShipment(si, {
                              delivery_address: e.target.value,
                            })
                          }
                          placeholder="Full delivery address"
                          className={inputClass}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Ocean: Containers */}
                {mode === "ocean" && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-2 block">
                      Containers *
                    </label>
                    <div className="space-y-2">
                      {shipment.containers.map((c, ci) => (
                        <div key={ci} className="flex items-center gap-2">
                          <select
                            value={c.container_type}
                            onChange={(e) =>
                              updateContainer(si, ci, {
                                container_type: e.target.value,
                              })
                            }
                            className={selectClass + " flex-1"}
                          >
                            {equipmentTypes.map((ct) => (
                              <option key={ct} value={ct}>
                                {ct}
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min={1}
                            value={c.qty}
                            onChange={(e) =>
                              updateContainer(si, ci, {
                                qty: parseInt(e.target.value, 10) || 1,
                              })
                            }
                            className={inputClass + " w-20"}
                          />
                          {shipment.containers.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeContainer(si, ci)}
                              className="h-8 w-8 p-0 text-red-500"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => addContainer(si)}
                        className="h-8 text-xs"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Container
                      </Button>
                    </div>
                  </div>
                )}

                {/* Air: Pieces */}
                {mode === "air" && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-2 block">
                      Cargo Pieces *
                    </label>
                    <div className="space-y-3">
                      {shipment.pieces.map((p, pi) => (
                        <div
                          key={pi}
                          className="rounded-xl border border-white/10 p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">
                              Piece {pi + 1}
                            </span>
                            {shipment.pieces.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removePiece(si, pi)}
                                className="h-6 w-6 p-0 text-red-500"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                          <div className="grid grid-cols-6 gap-2">
                            <div>
                              <label className="text-[10px] text-muted-foreground">
                                Count
                              </label>
                              <input
                                type="number"
                                min={1}
                                value={p.count}
                                onChange={(e) =>
                                  updatePiece(si, pi, { count: e.target.value })
                                }
                                className={inputClass}
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-muted-foreground">
                                L (cm)
                              </label>
                              <input
                                type="number"
                                step="0.1"
                                value={p.length_cm}
                                onChange={(e) =>
                                  updatePiece(si, pi, { length_cm: e.target.value })
                                }
                                placeholder="0"
                                className={inputClass}
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-muted-foreground">
                                W (cm)
                              </label>
                              <input
                                type="number"
                                step="0.1"
                                value={p.width_cm}
                                onChange={(e) =>
                                  updatePiece(si, pi, { width_cm: e.target.value })
                                }
                                placeholder="0"
                                className={inputClass}
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-muted-foreground">
                                H (cm)
                              </label>
                              <input
                                type="number"
                                step="0.1"
                                value={p.height_cm}
                                onChange={(e) =>
                                  updatePiece(si, pi, { height_cm: e.target.value })
                                }
                                placeholder="0"
                                className={inputClass}
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-muted-foreground">
                                Weight (kg)
                              </label>
                              <input
                                type="number"
                                step="0.1"
                                value={p.weight_kg}
                                onChange={(e) =>
                                  updatePiece(si, pi, { weight_kg: e.target.value })
                                }
                                placeholder="0"
                                className={inputClass}
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-muted-foreground">
                                Packaging
                              </label>
                              <select
                                value={p.packaging_type}
                                onChange={(e) =>
                                  updatePiece(si, pi, {
                                    packaging_type: e.target.value,
                                  })
                                }
                                className={selectClass}
                              >
                                {EQUIPMENT_BY_MODE.air.map((pt) => (
                                  <option key={pt} value={pt}>
                                    {pt}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => addPiece(si)}
                        className="h-8 text-xs"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Piece
                      </Button>
                    </div>
                  </div>
                )}

                {/* Land: FTL/LTL toggle, equipment, weight, NMFC class, ZIP lane */}
                {mode === "land" && (
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">
                        Load Type
                      </label>
                      <select
                        value={shipment.load_type || "FTL"}
                        onChange={(e) => updateShipment(si, { load_type: e.target.value })}
                        className={selectClass}
                      >
                        <option value="FTL">FTL — Full Truckload</option>
                        <option value="LTL">LTL — Less Than Truckload</option>
                        <option value="PTL">PTL — Partial Truckload</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">
                        Equipment Type
                      </label>
                      <select
                        value={shipment.equipment_type || EQUIPMENT_BY_MODE.land[0]}
                        onChange={(e) => updateShipment(si, { equipment_type: e.target.value })}
                        className={selectClass}
                      >
                        {EQUIPMENT_BY_MODE.land.map((eq) => (
                          <option key={eq} value={eq}>
                            {eq}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">
                        Weight (lbs)
                      </label>
                      <input
                        value={shipment.weight_lbs}
                        onChange={(e) => updateShipment(si, { weight_lbs: e.target.value })}
                        placeholder="e.g. 12000"
                        inputMode="decimal"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">
                        Origin ZIP
                      </label>
                      <input
                        value={shipment.origin_zip}
                        onChange={(e) => updateShipment(si, { origin_zip: e.target.value })}
                        placeholder="e.g. 90210"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">
                        Destination ZIP
                      </label>
                      <input
                        value={shipment.destination_zip}
                        onChange={(e) => updateShipment(si, { destination_zip: e.target.value })}
                        placeholder="e.g. 60607"
                        className={inputClass}
                      />
                    </div>
                    {shipment.load_type === "LTL" && (
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">
                          NMFC Class
                        </label>
                        <input
                          value={shipment.nmfc_class}
                          onChange={(e) => updateShipment(si, { nmfc_class: e.target.value })}
                          placeholder="e.g. 70"
                          className={inputClass}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Cargo details */}
                <div className="border-t pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                    Cargo Details (Optional)
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">
                        Commodity
                      </label>
                      <input
                        value={shipment.commodity_description}
                        onChange={(e) =>
                          updateShipment(si, {
                            commodity_description: e.target.value,
                          })
                        }
                        placeholder="e.g. Electronic components"
                        className={inputClass}
                      />
                    </div>
                    {mode === "ocean" && (
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">
                          HS Code
                        </label>
                        <input
                          value={shipment.hs_code}
                          onChange={(e) =>
                            updateShipment(si, { hs_code: e.target.value })
                          }
                          placeholder="e.g. 8542.31"
                          className={inputClass}
                        />
                      </div>
                    )}
                    {mode === "ocean" && (
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">
                          Incoterms
                        </label>
                        <select
                          value={shipment.incoterms}
                          onChange={(e) =>
                            updateShipment(si, { incoterms: e.target.value })
                          }
                          className={selectClass}
                        >
                          {INCOTERMS.map((ic) => (
                            <option key={ic} value={ic}>
                              {ic || "— None —"}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">
                          Weight (kg)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={shipment.cargo_weight_kg}
                          onChange={(e) =>
                            updateShipment(si, {
                              cargo_weight_kg: e.target.value,
                            })
                          }
                          placeholder="0"
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">
                          Volume (CBM)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={shipment.cargo_volume_cbm}
                          onChange={(e) =>
                            updateShipment(si, {
                              cargo_volume_cbm: e.target.value,
                            })
                          }
                          placeholder="0"
                          className={inputClass}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 mt-3">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={shipment.is_dangerous_goods}
                        onChange={(e) =>
                          updateShipment(si, {
                            is_dangerous_goods: e.target.checked,
                          })
                        }
                        className="rounded"
                      />
                      Dangerous Goods
                    </label>
                    {mode === "ocean" && (
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={shipment.is_reefer}
                          onChange={(e) =>
                            updateShipment(si, { is_reefer: e.target.checked })
                          }
                          className="rounded"
                        />
                        Reefer
                      </label>
                    )}
                  </div>

                  <div className="mt-3">
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Special Requirements
                    </label>
                    <textarea
                      value={shipment.special_requirements}
                      onChange={(e) =>
                        updateShipment(si, {
                          special_requirements: e.target.value,
                        })
                      }
                      rows={2}
                      placeholder="Any special handling requirements..."
                      className={inputClass + " resize-none"}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShipments((prev) => [...prev, emptyShipment(prev[prev.length - 1]?.freight_mode)])}
            className="rounded-xl"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Shipment
          </Button>

          <Button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-primary text-primary-foreground font-semibold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Create RFQ"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
