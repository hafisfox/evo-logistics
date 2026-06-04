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
  useTruckCarriers,
  useCreateTruckCarrier,
  useDeleteTruckCarrier,
  useUpdateTruckCarrier,
} from "@/hooks/use-pricing-tables";
import { useWorkspaceAccess } from "@/hooks/use-workspace-access";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import type { TruckCarrierProfile } from "@/types/pricing";

const inputClass =
  "rounded-xl border-black/10 dark:border-white/10 bg-background shadow-sm px-4 h-11 focus-visible:ring-1 focus-visible:ring-primary/50 transition-all";

const emptyRow = { name: "", mc_number: "", dot_number: "", equipment_types: "", active: true };

export function LandCarriersTab() {
  const { data: carriers, isLoading } = useTruckCarriers();
  const { canManage, isLoading: accessLoading } = useWorkspaceAccess();
  const createRow = useCreateTruckCarrier();
  const updateRow = useUpdateTruckCarrier();
  const deleteRow = useDeleteTruckCarrier();

  const [newRow, setNewRow] = useState({ ...emptyRow });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingRow, setEditingRow] = useState<TruckCarrierProfile | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; label: string } | null>(null);

  const disableManageActions = useMemo(
    () => accessLoading || !canManage,
    [accessLoading, canManage]
  );

  const handleCreate = async () => {
    const payload = {
      name: newRow.name.trim(),
      mc_number: newRow.mc_number.trim(),
      dot_number: newRow.dot_number.trim(),
      equipment_types: newRow.equipment_types.trim(),
      active: newRow.active,
    };
    if (!payload.name) {
      toast.error("Carrier name is required");
      return;
    }
    try {
      await createRow.mutateAsync(payload);
      toast.success("Truck carrier added");
      setNewRow({ ...emptyRow });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add truck carrier");
    }
  };

  const handleSave = async () => {
    if (!editingRow || editingId == null) return;
    const payload = {
      id: editingId,
      name: editingRow.name?.trim(),
      mc_number: editingRow.mc_number?.trim() ?? "",
      dot_number: editingRow.dot_number?.trim() ?? "",
      equipment_types: editingRow.equipment_types?.trim() ?? "",
      active: editingRow.active,
    };
    if (!payload.name) {
      toast.error("Carrier name is required");
      return;
    }
    try {
      await updateRow.mutateAsync(payload);
      toast.success("Truck carrier updated");
      setEditingId(null);
      setEditingRow(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update truck carrier");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteRow.mutateAsync({ id: deleteTarget.id });
      toast.success("Truck carrier deleted");
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete truck carrier");
    }
  };

  return (
    <Card className="rounded-3xl border border-white/20 dark:border-white/10 bg-card/60 dark:bg-card/40 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgba(255,255,255,0.03)] overflow-hidden">
      <CardHeader className="p-6 pb-4">
        <CardTitle className="text-lg font-bold tracking-tight">Trucking Carriers</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Carrier master data (MC#, DOT#, equipment) used to normalize land quotes and rate lookups.
        </p>
      </CardHeader>
      <CardContent className="px-6 pb-6 pt-2">
        {canManage && (
          <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-6 bg-black/[0.02] dark:bg-white/[0.02] p-4 rounded-2xl border border-black/5 dark:border-white/5">
            <Input value={newRow.name} onChange={(e) => setNewRow((c) => ({ ...c, name: e.target.value }))} placeholder="Carrier name" disabled={disableManageActions || createRow.isPending} className={`${inputClass} uppercase`} />
            <Input value={newRow.mc_number} onChange={(e) => setNewRow((c) => ({ ...c, mc_number: e.target.value }))} placeholder="MC#" disabled={disableManageActions || createRow.isPending} className={`${inputClass} font-mono`} />
            <Input value={newRow.dot_number} onChange={(e) => setNewRow((c) => ({ ...c, dot_number: e.target.value }))} placeholder="DOT#" disabled={disableManageActions || createRow.isPending} className={`${inputClass} font-mono`} />
            <Input value={newRow.equipment_types} onChange={(e) => setNewRow((c) => ({ ...c, equipment_types: e.target.value }))} placeholder="Equipment (dry van, reefer)" disabled={disableManageActions || createRow.isPending} className={`${inputClass} md:col-span-2`} />
            <Button onClick={handleCreate} disabled={disableManageActions || createRow.isPending} className="h-11 rounded-xl bg-primary text-primary-foreground font-semibold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all">
              <Plus className="mr-1.5 h-4 w-4" /> Add Carrier
            </Button>
          </div>
        )}
        {isLoading ? (
          <Skeleton className="h-48" />
        ) : (
          <div className="rounded-2xl border border-black/5 dark:border-white/5 overflow-x-auto scrollbar-hide">
            <Table className="min-w-[720px]">
              <TableHeader className="bg-black/[0.02] dark:bg-white/[0.02]">
                <TableRow className="border-b border-black/5 dark:border-white/5 hover:bg-transparent">
                  <TableHead className="font-semibold text-muted-foreground h-12">Carrier</TableHead>
                  <TableHead className="font-semibold text-muted-foreground h-12">MC#</TableHead>
                  <TableHead className="font-semibold text-muted-foreground h-12">DOT#</TableHead>
                  <TableHead className="font-semibold text-muted-foreground h-12">Equipment</TableHead>
                  <TableHead className="text-right font-semibold text-muted-foreground h-12 w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(carriers ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                      No trucking carriers yet. Add carriers to normalize land quotes.
                    </TableCell>
                  </TableRow>
                ) : null}
                {carriers?.map((row) => (
                  <TableRow key={row.id} className="group border-b border-black/5 dark:border-white/5 hover:bg-black/[0.01] dark:hover:bg-white/[0.01] transition-colors">
                    <TableCell className="font-semibold text-foreground py-3">
                      {editingId === row.id ? (
                        <Input value={editingRow?.name ?? ""} onChange={(e) => setEditingRow((c) => (c ? { ...c, name: e.target.value } : c))} disabled={disableManageActions || updateRow.isPending} className="h-9 rounded-lg uppercase border-black/10 dark:border-white/10" />
                      ) : (
                        row.name
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground py-3">
                      {editingId === row.id ? (
                        <Input value={editingRow?.mc_number ?? ""} onChange={(e) => setEditingRow((c) => (c ? { ...c, mc_number: e.target.value } : c))} disabled={disableManageActions || updateRow.isPending} className="h-9 w-24 rounded-lg font-mono border-black/10 dark:border-white/10" />
                      ) : (
                        row.mc_number || "—"
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground py-3">
                      {editingId === row.id ? (
                        <Input value={editingRow?.dot_number ?? ""} onChange={(e) => setEditingRow((c) => (c ? { ...c, dot_number: e.target.value } : c))} disabled={disableManageActions || updateRow.isPending} className="h-9 w-24 rounded-lg font-mono border-black/10 dark:border-white/10" />
                      ) : (
                        row.dot_number || "—"
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground py-3">
                      {editingId === row.id ? (
                        <Input value={editingRow?.equipment_types ?? ""} onChange={(e) => setEditingRow((c) => (c ? { ...c, equipment_types: e.target.value } : c))} disabled={disableManageActions || updateRow.isPending} className="h-9 rounded-lg border-black/10 dark:border-white/10" />
                      ) : (
                        row.equipment_types || "—"
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
                          <Button size="icon" variant="ghost" onClick={() => { if (!row.id) return; setEditingId(row.id); setEditingRow({ ...row }); }} disabled={disableManageActions || !row.id} aria-label={`Edit carrier ${row.name}`} className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => row.id && setDeleteTarget({ id: row.id, label: `carrier ${row.name}` })} disabled={disableManageActions || deleteRow.isPending || !row.id} aria-label={`Delete carrier ${row.name}`} className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10">
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
        title={`Delete ${deleteTarget?.label ?? "this carrier"}?`}
        description="This action cannot be undone. The truck carrier will be permanently removed."
        onConfirm={handleDelete}
        isPending={deleteRow.isPending}
      />
    </Card>
  );
}
