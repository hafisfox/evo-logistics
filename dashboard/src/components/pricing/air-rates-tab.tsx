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
  useAirRates,
  useCreateAirRate,
  useDeleteAirRate,
  useUpdateAirRate,
} from "@/hooks/use-pricing-tables";
import { useWorkspaceAccess } from "@/hooks/use-workspace-access";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import type { AirChargeRate } from "@/types/pricing";

const inputClass =
  "rounded-xl border-black/10 dark:border-white/10 bg-background shadow-sm px-4 h-11 focus-visible:ring-1 focus-visible:ring-primary/50 transition-all";

function toNumber(value: string | number) {
  if (typeof value === "number") return value;
  return Number(value.trim());
}

function numberString(value: number | string | undefined) {
  if (value == null) return "";
  return String(value);
}

const emptyRow = {
  carrier: "",
  origin: "",
  destination: "",
  min_weight_kg: "",
  rate_per_kg_usd: "",
  min_charge_usd: "",
};

export function AirRatesTab() {
  const { data: rates, isLoading } = useAirRates();
  const { canManage, isLoading: accessLoading } = useWorkspaceAccess();
  const createRow = useCreateAirRate();
  const updateRow = useUpdateAirRate();
  const deleteRow = useDeleteAirRate();

  const [newRow, setNewRow] = useState({ ...emptyRow });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingRow, setEditingRow] = useState<AirChargeRate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; label: string } | null>(null);

  const disableManageActions = useMemo(
    () => accessLoading || !canManage,
    [accessLoading, canManage]
  );

  const handleCreate = async () => {
    const payload = {
      carrier: newRow.carrier.trim(),
      origin: newRow.origin.trim(),
      destination: newRow.destination.trim(),
      min_weight_kg: toNumber(newRow.min_weight_kg || "0"),
      rate_per_kg_usd: toNumber(newRow.rate_per_kg_usd),
      min_charge_usd: toNumber(newRow.min_charge_usd || "0"),
    };
    if (!payload.carrier || !payload.origin || !payload.destination) {
      toast.error("Carrier, origin and destination are required");
      return;
    }
    if ([payload.min_weight_kg, payload.rate_per_kg_usd, payload.min_charge_usd].some(Number.isNaN)) {
      toast.error("Weight, rate and min charge must be valid numbers");
      return;
    }
    if (payload.rate_per_kg_usd <= 0) {
      toast.error("Rate per kg must be greater than 0");
      return;
    }
    try {
      await createRow.mutateAsync(payload);
      toast.success("Air rate added");
      setNewRow({ ...emptyRow });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add air rate");
    }
  };

  const handleSave = async () => {
    if (!editingRow || editingId == null) return;
    const payload = {
      id: editingId,
      carrier: editingRow.carrier?.trim(),
      origin: editingRow.origin?.trim(),
      destination: editingRow.destination?.trim(),
      min_weight_kg: toNumber(numberString(editingRow.min_weight_kg)),
      rate_per_kg_usd: toNumber(numberString(editingRow.rate_per_kg_usd)),
      min_charge_usd: toNumber(numberString(editingRow.min_charge_usd)),
    };
    if (!payload.carrier || !payload.origin || !payload.destination) {
      toast.error("Carrier, origin and destination are required");
      return;
    }
    if ([payload.min_weight_kg, payload.rate_per_kg_usd, payload.min_charge_usd].some(Number.isNaN)) {
      toast.error("Weight, rate and min charge must be valid numbers");
      return;
    }
    if (payload.rate_per_kg_usd <= 0) {
      toast.error("Rate per kg must be greater than 0");
      return;
    }
    try {
      await updateRow.mutateAsync(payload);
      toast.success("Air rate updated");
      setEditingId(null);
      setEditingRow(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update air rate");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteRow.mutateAsync({ id: deleteTarget.id });
      toast.success("Air rate deleted");
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete air rate");
    }
  };

  return (
    <Card className="rounded-3xl border border-white/20 dark:border-white/10 bg-card/60 dark:bg-card/40 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgba(255,255,255,0.03)] overflow-hidden">
      <CardHeader className="p-6 pb-4">
        <CardTitle className="text-lg font-bold tracking-tight">Air Weight-Tier Rates (USD/kg)</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          One row per lane and IATA weight break (0, +45, +100, +300, +500, +1000 kg). The pricing
          engine picks the highest break at or below the chargeable weight.
        </p>
      </CardHeader>
      <CardContent className="px-6 pb-6 pt-2">
        {canManage && (
          <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-7 bg-black/[0.02] dark:bg-white/[0.02] p-4 rounded-2xl border border-black/5 dark:border-white/5">
            <Input value={newRow.carrier} onChange={(e) => setNewRow((c) => ({ ...c, carrier: e.target.value }))} placeholder="Carrier" disabled={disableManageActions || createRow.isPending} className={`${inputClass} uppercase`} />
            <Input value={newRow.origin} onChange={(e) => setNewRow((c) => ({ ...c, origin: e.target.value }))} placeholder="Origin (DXB)" disabled={disableManageActions || createRow.isPending} className={`${inputClass} font-mono uppercase`} />
            <Input value={newRow.destination} onChange={(e) => setNewRow((c) => ({ ...c, destination: e.target.value }))} placeholder="Dest (LHR)" disabled={disableManageActions || createRow.isPending} className={`${inputClass} font-mono uppercase`} />
            <Input value={newRow.min_weight_kg} onChange={(e) => setNewRow((c) => ({ ...c, min_weight_kg: e.target.value }))} placeholder="Min kg" disabled={disableManageActions || createRow.isPending} className={`${inputClass} font-mono`} />
            <Input value={newRow.rate_per_kg_usd} onChange={(e) => setNewRow((c) => ({ ...c, rate_per_kg_usd: e.target.value }))} placeholder="USD/kg" disabled={disableManageActions || createRow.isPending} className={`${inputClass} font-mono`} />
            <Input value={newRow.min_charge_usd} onChange={(e) => setNewRow((c) => ({ ...c, min_charge_usd: e.target.value }))} placeholder="Min USD" disabled={disableManageActions || createRow.isPending} className={`${inputClass} font-mono`} />
            <Button onClick={handleCreate} disabled={disableManageActions || createRow.isPending} className="h-11 rounded-xl bg-primary text-primary-foreground font-semibold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all">
              <Plus className="mr-1.5 h-4 w-4" /> Add Rate
            </Button>
          </div>
        )}
        {isLoading ? (
          <Skeleton className="h-48" />
        ) : (
          <div className="rounded-2xl border border-black/5 dark:border-white/5 overflow-x-auto scrollbar-hide">
            <Table className="min-w-[760px]">
              <TableHeader className="bg-black/[0.02] dark:bg-white/[0.02]">
                <TableRow className="border-b border-black/5 dark:border-white/5 hover:bg-transparent">
                  <TableHead className="font-semibold text-muted-foreground h-12">Carrier</TableHead>
                  <TableHead className="font-semibold text-muted-foreground h-12">Lane</TableHead>
                  <TableHead className="text-right font-semibold text-muted-foreground h-12">Min Weight (kg)</TableHead>
                  <TableHead className="text-right font-semibold text-muted-foreground h-12">Rate (USD/kg)</TableHead>
                  <TableHead className="text-right font-semibold text-muted-foreground h-12">Min Charge (USD)</TableHead>
                  <TableHead className="text-right font-semibold text-muted-foreground h-12 w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(rates ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                      No air rates yet. Add weight-tier rates per lane to enable air pricing fallbacks.
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
                          <Input value={editingRow?.origin ?? ""} onChange={(e) => setEditingRow((c) => (c ? { ...c, origin: e.target.value } : c))} disabled={disableManageActions || updateRow.isPending} className="h-9 w-20 rounded-lg font-mono uppercase border-black/10 dark:border-white/10" />
                          <span>→</span>
                          <Input value={editingRow?.destination ?? ""} onChange={(e) => setEditingRow((c) => (c ? { ...c, destination: e.target.value } : c))} disabled={disableManageActions || updateRow.isPending} className="h-9 w-20 rounded-lg font-mono uppercase border-black/10 dark:border-white/10" />
                        </div>
                      ) : (
                        `${row.origin} → ${row.destination}`
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium text-muted-foreground py-3">
                      {editingId === row.id ? (
                        <Input value={numberString(editingRow?.min_weight_kg)} onChange={(e) => setEditingRow((c) => (c ? { ...c, min_weight_kg: Number(e.target.value) } : c))} disabled={disableManageActions || updateRow.isPending} className="h-9 rounded-lg text-right font-mono border-black/10 dark:border-white/10" />
                      ) : (
                        <span className="bg-black/5 dark:bg-white/5 px-2 py-1 rounded-md">{row.min_weight_kg}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium text-muted-foreground py-3">
                      {editingId === row.id ? (
                        <Input value={numberString(editingRow?.rate_per_kg_usd)} onChange={(e) => setEditingRow((c) => (c ? { ...c, rate_per_kg_usd: Number(e.target.value) } : c))} disabled={disableManageActions || updateRow.isPending} className="h-9 rounded-lg text-right font-mono border-black/10 dark:border-white/10" />
                      ) : (
                        <span className="bg-black/5 dark:bg-white/5 px-2 py-1 rounded-md">${row.rate_per_kg_usd}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium text-muted-foreground py-3">
                      {editingId === row.id ? (
                        <Input value={numberString(editingRow?.min_charge_usd)} onChange={(e) => setEditingRow((c) => (c ? { ...c, min_charge_usd: Number(e.target.value) } : c))} disabled={disableManageActions || updateRow.isPending} className="h-9 rounded-lg text-right font-mono border-black/10 dark:border-white/10" />
                      ) : (
                        <span className="bg-black/5 dark:bg-white/5 px-2 py-1 rounded-md">${row.min_charge_usd}</span>
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
                          <Button size="icon" variant="ghost" onClick={() => { if (!row.id) return; setEditingId(row.id); setEditingRow({ ...row }); }} disabled={disableManageActions || !row.id} aria-label={`Edit rate ${row.carrier} ${row.origin}-${row.destination}`} className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => row.id && setDeleteTarget({ id: row.id, label: `rate ${row.carrier} ${row.origin}→${row.destination}` })} disabled={disableManageActions || deleteRow.isPending || !row.id} aria-label={`Delete rate ${row.carrier} ${row.origin}-${row.destination}`} className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10">
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
        title={`Delete ${deleteTarget?.label ?? "this rate"}?`}
        description="This action cannot be undone. The air rate will be permanently removed."
        onConfirm={handleDelete}
        isPending={deleteRow.isPending}
      />
    </Card>
  );
}
