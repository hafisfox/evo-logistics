"use client";

import { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import {
  useTruckLaneRates,
  useCreateTruckLaneRate,
  useDeleteTruckLaneRate,
  useUpdateTruckLaneRate,
} from "@/hooks/use-pricing-tables";
import { useWorkspaceAccess } from "@/hooks/use-workspace-access";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import type { TruckLaneRate } from "@/types/pricing";

const inputClass =
  "rounded-xl border-black/10 dark:border-white/10 bg-background shadow-sm px-4 h-11 focus-visible:ring-1 focus-visible:ring-primary/50 transition-all";

function optionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function requiredNumber(value: string): number {
  const n = Number(value.trim());
  return Number.isFinite(n) ? n : 0;
}

function hasInvalidNumber(value: string): boolean {
  const trimmed = value.trim();
  return trimmed !== "" && !Number.isFinite(Number(trimmed));
}

function display(value: number | null | undefined, prefix = "") {
  if (value == null) return "—";
  return `${prefix}${value}`;
}

const emptyRow = {
  carrier: "",
  origin_zip: "",
  destination_zip: "",
  equipment_type: "DRY VAN",
  rate_per_mile_usd: "",
  flat_rate_usd: "",
  min_charge_usd: "",
  fuel_surcharge_pct: "",
};

export function LandRatesTab() {
  const { data: rates, isLoading } = useTruckLaneRates();
  const { canManage, isLoading: accessLoading } = useWorkspaceAccess();
  const createRow = useCreateTruckLaneRate();
  const updateRow = useUpdateTruckLaneRate();
  const deleteRow = useDeleteTruckLaneRate();

  const [newRow, setNewRow] = useState({ ...emptyRow });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingRow, setEditingRow] = useState<TruckLaneRate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; label: string } | null>(null);

  const disableManageActions = useMemo(
    () => accessLoading || !canManage,
    [accessLoading, canManage]
  );

  const handleCreate = async () => {
    const invalidField = (
      [
        ["Per-mile rate", newRow.rate_per_mile_usd],
        ["Flat rate", newRow.flat_rate_usd],
        ["Min charge", newRow.min_charge_usd],
        ["Fuel surcharge", newRow.fuel_surcharge_pct],
      ] as const
    ).find(([, value]) => hasInvalidNumber(value));
    if (invalidField) {
      toast.error(`${invalidField[0]} must be a valid number`);
      return;
    }
    const rate_per_mile_usd = optionalNumber(newRow.rate_per_mile_usd);
    const flat_rate_usd = optionalNumber(newRow.flat_rate_usd);
    const payload = {
      carrier: newRow.carrier.trim(),
      origin_zip: newRow.origin_zip.trim(),
      destination_zip: newRow.destination_zip.trim(),
      equipment_type: newRow.equipment_type.trim() || "DRY VAN",
      rate_per_mile_usd,
      flat_rate_usd,
      min_charge_usd: optionalNumber(newRow.min_charge_usd) ?? 0,
      fuel_surcharge_pct: optionalNumber(newRow.fuel_surcharge_pct) ?? 0,
    };
    if (!payload.carrier || !payload.origin_zip || !payload.destination_zip) {
      toast.error("Carrier, origin and destination ZIP are required");
      return;
    }
    if (rate_per_mile_usd == null && flat_rate_usd == null) {
      toast.error("Provide a per-mile rate or a flat rate");
      return;
    }
    try {
      await createRow.mutateAsync(payload);
      toast.success("Lane rate added");
      setNewRow({ ...emptyRow });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add lane rate");
    }
  };

  const handleSave = async () => {
    if (!editingRow || editingId == null) return;
    const payload = {
      id: editingId,
      carrier: editingRow.carrier?.trim(),
      origin_zip: editingRow.origin_zip?.trim(),
      destination_zip: editingRow.destination_zip?.trim(),
      equipment_type: editingRow.equipment_type?.trim() || "DRY VAN",
      rate_per_mile_usd: editingRow.rate_per_mile_usd,
      flat_rate_usd: editingRow.flat_rate_usd,
      min_charge_usd: editingRow.min_charge_usd,
      fuel_surcharge_pct: editingRow.fuel_surcharge_pct,
    };
    if (!payload.carrier || !payload.origin_zip || !payload.destination_zip) {
      toast.error("Carrier, origin and destination ZIP are required");
      return;
    }
    try {
      await updateRow.mutateAsync(payload);
      toast.success("Lane rate updated");
      setEditingId(null);
      setEditingRow(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update lane rate");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteRow.mutateAsync({ id: deleteTarget.id });
      toast.success("Lane rate deleted");
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete lane rate");
    }
  };

  return (
    <Card className="rounded-3xl border border-white/20 dark:border-white/10 bg-card/60 dark:bg-card/40 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgba(255,255,255,0.03)] overflow-hidden">
      <CardHeader className="p-6 pb-4">
        <CardTitle className="text-lg font-bold tracking-tight">FTL Lane Rates (USD)</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Per-mile or flat lane rates by origin/destination ZIP + equipment. Fuel surcharge is a
          percent of linehaul; min charge is the floor. Used as a land pricing fallback.
        </p>
      </CardHeader>
      <CardContent className="px-6 pb-6 pt-2">
        {canManage && (
          <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-9 bg-black/[0.02] dark:bg-white/[0.02] p-4 rounded-2xl border border-black/5 dark:border-white/5">
            <Input value={newRow.carrier} onChange={(e) => setNewRow((c) => ({ ...c, carrier: e.target.value }))} placeholder="Carrier" disabled={disableManageActions || createRow.isPending} className={`${inputClass} uppercase`} />
            <Input value={newRow.origin_zip} onChange={(e) => setNewRow((c) => ({ ...c, origin_zip: e.target.value }))} placeholder="From ZIP" disabled={disableManageActions || createRow.isPending} className={`${inputClass} font-mono uppercase`} />
            <Input value={newRow.destination_zip} onChange={(e) => setNewRow((c) => ({ ...c, destination_zip: e.target.value }))} placeholder="To ZIP" disabled={disableManageActions || createRow.isPending} className={`${inputClass} font-mono uppercase`} />
            <Input value={newRow.equipment_type} onChange={(e) => setNewRow((c) => ({ ...c, equipment_type: e.target.value }))} placeholder="Equipment" disabled={disableManageActions || createRow.isPending} className={`${inputClass} uppercase`} />
            <Input value={newRow.rate_per_mile_usd} onChange={(e) => setNewRow((c) => ({ ...c, rate_per_mile_usd: e.target.value }))} placeholder="$/mi" disabled={disableManageActions || createRow.isPending} className={`${inputClass} font-mono`} />
            <Input value={newRow.flat_rate_usd} onChange={(e) => setNewRow((c) => ({ ...c, flat_rate_usd: e.target.value }))} placeholder="Flat $" disabled={disableManageActions || createRow.isPending} className={`${inputClass} font-mono`} />
            <Input value={newRow.min_charge_usd} onChange={(e) => setNewRow((c) => ({ ...c, min_charge_usd: e.target.value }))} placeholder="Min $" disabled={disableManageActions || createRow.isPending} className={`${inputClass} font-mono`} />
            <Input value={newRow.fuel_surcharge_pct} onChange={(e) => setNewRow((c) => ({ ...c, fuel_surcharge_pct: e.target.value }))} placeholder="Fuel %" disabled={disableManageActions || createRow.isPending} className={`${inputClass} font-mono`} />
            <Button onClick={handleCreate} disabled={disableManageActions || createRow.isPending} className="h-11 rounded-xl bg-primary text-primary-foreground font-semibold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all">
              <Plus className="mr-1.5 h-4 w-4" /> Add
            </Button>
          </div>
        )}
        {isLoading ? (
          <Skeleton className="h-48" />
        ) : (
          <div className="rounded-2xl border border-black/5 dark:border-white/5 overflow-x-auto scrollbar-hide">
            <Table className="min-w-[860px]">
              <TableHeader className="bg-black/[0.02] dark:bg-white/[0.02]">
                <TableRow className="border-b border-black/5 dark:border-white/5 hover:bg-transparent">
                  <TableHead className="font-semibold text-muted-foreground h-12">Carrier</TableHead>
                  <TableHead className="font-semibold text-muted-foreground h-12">Lane</TableHead>
                  <TableHead className="font-semibold text-muted-foreground h-12">Equipment</TableHead>
                  <TableHead className="text-right font-semibold text-muted-foreground h-12">$/mi</TableHead>
                  <TableHead className="text-right font-semibold text-muted-foreground h-12">Flat $</TableHead>
                  <TableHead className="text-right font-semibold text-muted-foreground h-12">Min $</TableHead>
                  <TableHead className="text-right font-semibold text-muted-foreground h-12">Fuel %</TableHead>
                  <TableHead className="text-right font-semibold text-muted-foreground h-12 w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(rates ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                      No lane rates yet. Add per-mile or flat lane rates to enable FTL pricing fallbacks.
                    </TableCell>
                  </TableRow>
                ) : null}
                {rates?.map((row) => (
                  <TableRow key={row.id} className="group border-b border-black/5 dark:border-white/5 hover:bg-black/[0.01] dark:hover:bg-white/[0.01] transition-colors">
                    <TableCell className="font-semibold text-foreground py-3">
                      {editingId === row.id ? (
                        <Input value={editingRow?.carrier ?? ""} onChange={(e) => setEditingRow((c) => (c ? { ...c, carrier: e.target.value } : c))} disabled={disableManageActions || updateRow.isPending} className="h-9 rounded-lg uppercase border-black/10 dark:border-white/10" />
                      ) : (
                        row.carrier
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground py-3">
                      {editingId === row.id ? (
                        <div className="flex items-center gap-1">
                          <Input value={editingRow?.origin_zip ?? ""} onChange={(e) => setEditingRow((c) => (c ? { ...c, origin_zip: e.target.value } : c))} disabled={disableManageActions || updateRow.isPending} className="h-9 w-20 rounded-lg font-mono uppercase border-black/10 dark:border-white/10" />
                          <span>→</span>
                          <Input value={editingRow?.destination_zip ?? ""} onChange={(e) => setEditingRow((c) => (c ? { ...c, destination_zip: e.target.value } : c))} disabled={disableManageActions || updateRow.isPending} className="h-9 w-20 rounded-lg font-mono uppercase border-black/10 dark:border-white/10" />
                        </div>
                      ) : (
                        `${row.origin_zip} → ${row.destination_zip}`
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground py-3">
                      {editingId === row.id ? (
                        <Input value={editingRow?.equipment_type ?? ""} onChange={(e) => setEditingRow((c) => (c ? { ...c, equipment_type: e.target.value } : c))} disabled={disableManageActions || updateRow.isPending} className="h-9 w-28 rounded-lg uppercase border-black/10 dark:border-white/10" />
                      ) : (
                        row.equipment_type
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground py-3">
                      {editingId === row.id ? (
                        <Input value={row.rate_per_mile_usd == null ? "" : String(editingRow?.rate_per_mile_usd ?? "")} onChange={(e) => setEditingRow((c) => (c ? { ...c, rate_per_mile_usd: optionalNumber(e.target.value) } : c))} disabled={disableManageActions || updateRow.isPending} className="h-9 w-16 rounded-lg text-right font-mono border-black/10 dark:border-white/10" />
                      ) : (
                        display(row.rate_per_mile_usd, "$")
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground py-3">
                      {editingId === row.id ? (
                        <Input value={row.flat_rate_usd == null ? "" : String(editingRow?.flat_rate_usd ?? "")} onChange={(e) => setEditingRow((c) => (c ? { ...c, flat_rate_usd: optionalNumber(e.target.value) } : c))} disabled={disableManageActions || updateRow.isPending} className="h-9 w-20 rounded-lg text-right font-mono border-black/10 dark:border-white/10" />
                      ) : (
                        display(row.flat_rate_usd, "$")
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground py-3">
                      {editingId === row.id ? (
                        <Input value={String(editingRow?.min_charge_usd ?? 0)} onChange={(e) => setEditingRow((c) => (c ? { ...c, min_charge_usd: requiredNumber(e.target.value) } : c))} disabled={disableManageActions || updateRow.isPending} className="h-9 w-20 rounded-lg text-right font-mono border-black/10 dark:border-white/10" />
                      ) : (
                        `$${row.min_charge_usd}`
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground py-3">
                      {editingId === row.id ? (
                        <Input value={String(editingRow?.fuel_surcharge_pct ?? 0)} onChange={(e) => setEditingRow((c) => (c ? { ...c, fuel_surcharge_pct: requiredNumber(e.target.value) } : c))} disabled={disableManageActions || updateRow.isPending} className="h-9 w-16 rounded-lg text-right font-mono border-black/10 dark:border-white/10" />
                      ) : (
                        `${row.fuel_surcharge_pct}%`
                      )}
                    </TableCell>
                    <TableCell className="text-right py-3">
                      {!canManage ? (
                        <span className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">Owner Only</span>
                      ) : editingId === row.id ? (
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" onClick={handleSave} disabled={updateRow.isPending} className="h-8 rounded-lg bg-primary text-primary-foreground">Save</Button>
                          <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setEditingRow(null); }} className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5">
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="icon" variant="ghost" onClick={() => { if (!row.id) return; setEditingId(row.id); setEditingRow({ ...row }); }} disabled={disableManageActions || !row.id} aria-label={`Edit lane ${row.carrier} ${row.origin_zip}-${row.destination_zip}`} className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => row.id && setDeleteTarget({ id: row.id, label: `lane ${row.carrier} ${row.origin_zip}→${row.destination_zip}` })} disabled={disableManageActions || deleteRow.isPending || !row.id} aria-label={`Delete lane ${row.carrier} ${row.origin_zip}-${row.destination_zip}`} className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title={`Delete ${deleteTarget?.label ?? "this lane"}?`}
        description="This action cannot be undone. The lane rate will be permanently removed."
        onConfirm={handleDelete}
        isPending={deleteRow.isPending}
      />
    </Card>
  );
}
