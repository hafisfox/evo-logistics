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
  useLtlClasses,
  useCreateLtlClass,
  useDeleteLtlClass,
  useUpdateLtlClass,
} from "@/hooks/use-pricing-tables";
import { useWorkspaceAccess } from "@/hooks/use-workspace-access";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import type { LtlFreightClass } from "@/types/pricing";

const inputClass =
  "rounded-xl border-black/10 dark:border-white/10 bg-background shadow-sm px-4 h-11 focus-visible:ring-1 focus-visible:ring-primary/50 transition-all";

function optionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return Number(trimmed);
}

const emptyRow = {
  nmfc_class: "",
  description: "",
  min_density: "",
  max_density: "",
  rate_per_100lb_usd: "",
  min_charge_usd: "",
};

export function LtlClassesTab() {
  const { data: classes, isLoading } = useLtlClasses();
  const { canManage, isLoading: accessLoading } = useWorkspaceAccess();
  const createRow = useCreateLtlClass();
  const updateRow = useUpdateLtlClass();
  const deleteRow = useDeleteLtlClass();

  const [newRow, setNewRow] = useState({ ...emptyRow });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingRow, setEditingRow] = useState<LtlFreightClass | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; label: string } | null>(null);

  const disableManageActions = useMemo(
    () => accessLoading || !canManage,
    [accessLoading, canManage]
  );

  const handleCreate = async () => {
    const rate_per_100lb_usd = optionalNumber(newRow.rate_per_100lb_usd);
    const payload = {
      nmfc_class: newRow.nmfc_class.trim(),
      description: newRow.description.trim(),
      min_density: optionalNumber(newRow.min_density),
      max_density: optionalNumber(newRow.max_density),
      rate_per_100lb_usd: rate_per_100lb_usd ?? 0,
      min_charge_usd: optionalNumber(newRow.min_charge_usd) ?? 0,
    };
    if (!payload.nmfc_class) {
      toast.error("NMFC class is required");
      return;
    }
    if (rate_per_100lb_usd == null || rate_per_100lb_usd < 0) {
      toast.error("Rate per 100 lb must be a valid number");
      return;
    }
    try {
      await createRow.mutateAsync(payload);
      toast.success("LTL class added");
      setNewRow({ ...emptyRow });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add LTL class");
    }
  };

  const handleSave = async () => {
    if (!editingRow || editingId == null) return;
    const payload = {
      id: editingId,
      nmfc_class: editingRow.nmfc_class?.trim(),
      description: editingRow.description?.trim() ?? "",
      min_density: editingRow.min_density,
      max_density: editingRow.max_density,
      rate_per_100lb_usd: editingRow.rate_per_100lb_usd,
      min_charge_usd: editingRow.min_charge_usd,
    };
    if (!payload.nmfc_class) {
      toast.error("NMFC class is required");
      return;
    }
    try {
      await updateRow.mutateAsync(payload);
      toast.success("LTL class updated");
      setEditingId(null);
      setEditingRow(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update LTL class");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteRow.mutateAsync({ id: deleteTarget.id });
      toast.success("LTL class deleted");
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete LTL class");
    }
  };

  return (
    <Card className="rounded-3xl border border-white/20 dark:border-white/10 bg-card/60 dark:bg-card/40 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgba(255,255,255,0.03)] overflow-hidden">
      <CardHeader className="p-6 pb-4">
        <CardTitle className="text-lg font-bold tracking-tight">LTL Freight Classes (NMFC)</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Class-based LTL rates (USD per 100 lb). Density band is informational; LTL pricing uses
          rate × (weight / 100) floored at the min charge.
        </p>
      </CardHeader>
      <CardContent className="px-6 pb-6 pt-2">
        {canManage && (
          <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-7 bg-black/[0.02] dark:bg-white/[0.02] p-4 rounded-2xl border border-black/5 dark:border-white/5">
            <Input value={newRow.nmfc_class} onChange={(e) => setNewRow((c) => ({ ...c, nmfc_class: e.target.value }))} placeholder="Class (70)" disabled={disableManageActions || createRow.isPending} className={`${inputClass} font-mono`} />
            <Input value={newRow.description} onChange={(e) => setNewRow((c) => ({ ...c, description: e.target.value }))} placeholder="Description" disabled={disableManageActions || createRow.isPending} className={`${inputClass} md:col-span-2`} />
            <Input value={newRow.min_density} onChange={(e) => setNewRow((c) => ({ ...c, min_density: e.target.value }))} placeholder="Min density" disabled={disableManageActions || createRow.isPending} className={`${inputClass} font-mono`} />
            <Input value={newRow.max_density} onChange={(e) => setNewRow((c) => ({ ...c, max_density: e.target.value }))} placeholder="Max density" disabled={disableManageActions || createRow.isPending} className={`${inputClass} font-mono`} />
            <Input value={newRow.rate_per_100lb_usd} onChange={(e) => setNewRow((c) => ({ ...c, rate_per_100lb_usd: e.target.value }))} placeholder="$/100lb" disabled={disableManageActions || createRow.isPending} className={`${inputClass} font-mono`} />
            <Button onClick={handleCreate} disabled={disableManageActions || createRow.isPending} className="h-11 rounded-xl bg-primary text-primary-foreground font-semibold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all">
              <Plus className="mr-1.5 h-4 w-4" /> Add
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
                  <TableHead className="font-semibold text-muted-foreground h-12">Class</TableHead>
                  <TableHead className="font-semibold text-muted-foreground h-12">Description</TableHead>
                  <TableHead className="text-right font-semibold text-muted-foreground h-12">Density</TableHead>
                  <TableHead className="text-right font-semibold text-muted-foreground h-12">Rate ($/100lb)</TableHead>
                  <TableHead className="text-right font-semibold text-muted-foreground h-12">Min Charge</TableHead>
                  <TableHead className="text-right font-semibold text-muted-foreground h-12 w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(classes ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                      No LTL classes yet. Add NMFC classes to enable class-based LTL pricing.
                    </TableCell>
                  </TableRow>
                ) : null}
                {classes?.map((row) => (
                  <TableRow key={row.id} className="group border-b border-black/5 dark:border-white/5 hover:bg-black/[0.01] dark:hover:bg-white/[0.01] transition-colors">
                    <TableCell className="font-mono font-semibold text-foreground py-3">
                      {editingId === row.id ? (
                        <Input value={editingRow?.nmfc_class ?? ""} onChange={(e) => setEditingRow((c) => (c ? { ...c, nmfc_class: e.target.value } : c))} disabled={disableManageActions || updateRow.isPending} className="h-9 w-20 rounded-lg font-mono border-black/10 dark:border-white/10" />
                      ) : (
                        row.nmfc_class
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground py-3">
                      {editingId === row.id ? (
                        <Input value={editingRow?.description ?? ""} onChange={(e) => setEditingRow((c) => (c ? { ...c, description: e.target.value } : c))} disabled={disableManageActions || updateRow.isPending} className="h-9 rounded-lg border-black/10 dark:border-white/10" />
                      ) : (
                        row.description || "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-muted-foreground py-3">
                      {row.min_density == null && row.max_density == null
                        ? "—"
                        : `${row.min_density ?? "?"}–${row.max_density ?? "?"}`}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground py-3">
                      {editingId === row.id ? (
                        <Input value={String(editingRow?.rate_per_100lb_usd ?? 0)} onChange={(e) => setEditingRow((c) => (c ? { ...c, rate_per_100lb_usd: Number(e.target.value) } : c))} disabled={disableManageActions || updateRow.isPending} className="h-9 w-24 rounded-lg text-right font-mono border-black/10 dark:border-white/10" />
                      ) : (
                        `$${row.rate_per_100lb_usd}`
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground py-3">
                      {editingId === row.id ? (
                        <Input value={String(editingRow?.min_charge_usd ?? 0)} onChange={(e) => setEditingRow((c) => (c ? { ...c, min_charge_usd: Number(e.target.value) } : c))} disabled={disableManageActions || updateRow.isPending} className="h-9 w-24 rounded-lg text-right font-mono border-black/10 dark:border-white/10" />
                      ) : (
                        `$${row.min_charge_usd}`
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
                          <Button size="icon" variant="ghost" onClick={() => { if (!row.id) return; setEditingId(row.id); setEditingRow({ ...row }); }} disabled={disableManageActions || !row.id} aria-label={`Edit class ${row.nmfc_class}`} className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => row.id && setDeleteTarget({ id: row.id, label: `class ${row.nmfc_class}` })} disabled={disableManageActions || deleteRow.isPending || !row.id} aria-label={`Delete class ${row.nmfc_class}`} className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10">
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
        title={`Delete ${deleteTarget?.label ?? "this class"}?`}
        description="This action cannot be undone. The LTL class will be permanently removed."
        onConfirm={handleDelete}
        isPending={deleteRow.isPending}
      />
    </Card>
  );
}
