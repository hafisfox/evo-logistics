"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Loader2, Ship } from "lucide-react";

interface ContainerEntry {
  container_type: string;
  qty: number;
}

interface ShipmentEntry {
  pol: string;
  pod: string;
  service_type: string;
  ready_date: string;
  delivery_deadline: string;
  pickup_address: string;
  delivery_address: string;
  containers: ContainerEntry[];
  commodity_description: string;
  hs_code: string;
  incoterms: string;
  is_dangerous_goods: boolean;
  is_reefer: boolean;
  special_requirements: string;
  cargo_weight_kg: string;
  cargo_volume_cbm: string;
}

function emptyShipment(): ShipmentEntry {
  return {
    pol: "",
    pod: "",
    service_type: "port-to-port",
    ready_date: "",
    delivery_deadline: "",
    pickup_address: "",
    delivery_address: "",
    containers: [{ container_type: "40HQ", qty: 1 }],
    commodity_description: "",
    hs_code: "",
    incoterms: "",
    is_dangerous_goods: false,
    is_reefer: false,
    special_requirements: "",
    cargo_weight_kg: "",
    cargo_volume_cbm: "",
  };
}

const CONTAINER_TYPES = ["20FT", "40FT", "40HQ", "45FT", "20OT", "40OT", "20RF", "40RF"];
const SERVICE_TYPES = ["port-to-port", "door-to-port", "port-to-door", "door-to-door"];
const INCOTERMS = ["", "EXW", "FCA", "FAS", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"];

const inputClass =
  "w-full rounded-xl border border-white/20 dark:border-white/10 bg-white/40 dark:bg-black/20 px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const selectClass =
  "w-full rounded-xl border border-white/20 dark:border-white/10 bg-white/40 dark:bg-black/20 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function NewRFQPage() {
  const router = useRouter();
  const [customerEmail, setCustomerEmail] = useState("");
  const [shipments, setShipments] = useState<ShipmentEntry[]>([emptyShipment()]);
  const [submitting, setSubmitting] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const payload = {
        customer_email: customerEmail,
        shipments: shipments.map((s) => ({
          pol: s.pol,
          pod: s.pod,
          service_type: s.service_type,
          ready_date: s.ready_date || null,
          delivery_deadline: s.delivery_deadline || null,
          pickup_address: s.pickup_address || null,
          delivery_address: s.delivery_address || null,
          containers: s.containers,
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
        throw new Error(data.error || "Failed to create RFQ");
      }

      const result = await res.json();
      toast.success("RFQ created successfully");
      router.push(`/rfqs/${result.rfq_id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create RFQ");
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
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="customer@example.com"
                className={inputClass}
              />
            </div>
          </CardContent>
        </Card>

        {shipments.map((shipment, si) => (
          <Card
            key={si}
            className="rounded-3xl border border-white/20 dark:border-white/10 bg-card/60 dark:bg-card/40 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] overflow-hidden"
          >
            <CardHeader className="pb-3 px-6 pt-6">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold">
                  Shipment {si + 1}
                </CardTitle>
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
              {/* Route */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Port of Loading *
                  </label>
                  <input
                    required
                    value={shipment.pol}
                    onChange={(e) => updateShipment(si, { pol: e.target.value })}
                    placeholder="e.g. Jebel Ali"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Port of Discharge *
                  </label>
                  <input
                    required
                    value={shipment.pod}
                    onChange={(e) => updateShipment(si, { pod: e.target.value })}
                    placeholder="e.g. Shanghai"
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
                    {SERVICE_TYPES.map((st) => (
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
                  {(shipment.service_type === "door-to-port" ||
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
                  {(shipment.service_type === "port-to-door" ||
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

              {/* Containers */}
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
                        {CONTAINER_TYPES.map((ct) => (
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
        ))}

        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShipments((prev) => [...prev, emptyShipment()])}
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
