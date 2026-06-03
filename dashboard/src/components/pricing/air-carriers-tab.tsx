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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import {
  useAirCarriers,
  useCreateAirCarrier,
  useDeleteAirCarrier,
  useUpdateAirCarrier,
} from "@/hooks/use-pricing-tables";
import { useWorkspaceAccess } from "@/hooks/use-workspace-access";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import type { AirCarrierProfile } from "@/types/pricing";

const inputClass =
  "rounded-xl border-black/10 dark:border-white/10 bg-background shadow-sm px-4 h-11 focus-visible:ring-1 focus-visible:ring-primary/50 transition-all";

export function AirCarriersTab() {
  const { data: carriers, isLoading } = useAirCarriers();
  const { canManage, isLoading: accessLoading } = useWorkspaceAccess();
  const createRow = useCreateAirCarrier();
  const updateRow = useUpdateAirCarrier();
  const deleteRow = useDeleteAirCarrier();

  const [newRow, setNewRow] = useState({ iata_code: "", name: "", cargo_types: "", active: true });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingRow, setEditingRow] = useState<AirCarrierProfile | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; label: string } | null>(null);

  const disableManageActions = useMemo(
    () => accessLoading || !canManage,
    [accessLoading, canManage]
  );

  const handleCreate = async () => {
    const payload = {
      iata_code: newRow.iata_code.trim(),
      name: newRow.name.trim(),
      cargo_types: newRow.cargo_types.trim(),
      active: newRow.active,
    };
    if (!payload.iata_code || !payload.name) {
      toast.error("IATA code and name are required");
      return;
    }
    try {
      await createRow.mutateAsync(payload);
      toast.success("Air carrier added");
      setNewRow({ iata_code: "", name: "", cargo_types: "", active: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add air carrier");
    }
  };

  const handleSave = async () => {
    if (!editingRow || editingId == null) return;
    const payload = {
      id: editingId,
      iata_code: editingRow.iata_code?.trim(),
      name: editingRow.name?.trim(),
      cargo_types: editingRow.cargo_types?.trim() ?? "",
      active: editingRow.active,
    };
    if (!payload.iata_code || !payload.name) {
      toast.error("IATA code and name are required");
      return;
    }
    try {
      await updateRow.mutateAsync(payload);
      toast.success("Air carrier updated");
      setEditingId(null);
      setEditingRow(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update air carrier");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteRow.mutateAsync({ id: deleteTarget.id });
      toast.success("Air carrier deleted");
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete air carrier");
    }
  };

  return (
    <Card className="rounded-3xl border border-white/20 dark:border-white/10 bg-card/60 dark:bg-card/40 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgba(255,255,255,0.03)] overflow-hidden">
      <CardHeader className="p-6 pb-4">
        <CardTitle className="text-lg font-bold tracking-tight">Airlines (Air Carriers)</CardTitle>
      </CardHeader>
      <CardContent className="px-6 pb-6 pt-2">
        {canManage && (
          <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-5 bg-black/[0.02] dark:bg-white/[0.02] p-4 rounded-2xl border border-black/5 dark:border-white/5">
            <Input
              value={newRow.iata_code}
              onChange={(e) => setNewRow((c) => ({ ...c, iata_code: e.target.value }))}
              placeholder="IATA (e.g. EK)"
              disabled={disableManageActions || createRow.isPending}
              className={`${inputClass} font-mono uppercase`}
            />
            <Input
              value={newRow.name}
              onChange={(e) => setNewRow((c) => ({ ...c, name: e.target.value }))}
              placeholder="Airline Name"
              disabled={disableManageActions || createRow.isPending}
              className={inputClass}
            />
            <Input
              value={newRow.cargo_types}
              onChange={(e) => setNewRow((c) => ({ ...c, cargo_types: e.target.value }))}
              placeholder="Cargo types"
              disabled={disableManageActions || createRow.isPending}
              className={inputClass}
            />
            <Select
              value={newRow.active ? "active" : "inactive"}
              onValueChange={(v) => setNewRow((c) => ({ ...c, active: v === "active" }))}
              disabled={disableManageActions || createRow.isPending}
            >
              <SelectTrigger className="h-11 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={handleCreate}
              disabled={disableManageActions || createRow.isPending}
              className="h-11 rounded-xl bg-primary text-primary-foreground font-semibold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all"
            >
              <Plus className="mr-1.5 h-4 w-4" /> Add Airline
            </Button>
          </div>
        )}
        {isLoading ? (
          <Skeleton className="h-48" />
        ) : (
          <div className="rounded-2xl border border-black/5 dark:border-white/5 overflow-x-auto scrollbar-hide">
            <Table className="min-w-[640px]">
              <TableHeader className="bg-black/[0.02] dark:bg-white/[0.02]">
                <TableRow className="border-b border-black/5 dark:border-white/5 hover:bg-transparent">
                  <TableHead className="font-semibold text-muted-foreground h-12">IATA</TableHead>
                  <TableHead className="font-semibold text-muted-foreground h-12">Airline</TableHead>
                  <TableHead className="font-semibold text-muted-foreground h-12">Cargo Types</TableHead>
                  <TableHead className="font-semibold text-muted-foreground h-12">Status</TableHead>
                  <TableHead className="text-right font-semibold text-muted-foreground h-12 w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(carriers ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                      No airlines yet. Add one above to build your air rate book.
                    </TableCell>
                  </TableRow>
                ) : null}
                {carriers?.map((row) => (
                  <TableRow key={row.id} className="group border-b border-black/5 dark:border-white/5 hover:bg-black/[0.01] dark:hover:bg-white/[0.01] transition-colors">
                    <TableCell className="font-mono font-semibold text-foreground py-3">
                      {editingId === row.id ? (
                        <Input
                          value={editingRow?.iata_code ?? ""}
                          onChange={(e) => setEditingRow((c) => (c ? { ...c, iata_code: e.target.value } : c))}
                          disabled={disableManageActions || updateRow.isPending}
                          className="h-9 rounded-lg font-mono uppercase border-black/10 dark:border-white/10"
                        />
                      ) : (
                        row.iata_code
                      )}
                    </TableCell>
                    <TableCell className="font-medium text-foreground py-3">
                      {editingId === row.id ? (
                        <Input
                          value={editingRow?.name ?? ""}
                          onChange={(e) => setEditingRow((c) => (c ? { ...c, name: e.target.value } : c))}
                          disabled={disableManageActions || updateRow.isPending}
                          className="h-9 rounded-lg border-black/10 dark:border-white/10"
                        />
                      ) : (
                        row.name
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground py-3">
                      {editingId === row.id ? (
                        <Input
                          value={editingRow?.cargo_types ?? ""}
                          onChange={(e) => setEditingRow((c) => (c ? { ...c, cargo_types: e.target.value } : c))}
                          disabled={disableManageActions || updateRow.isPending}
                          className="h-9 rounded-lg border-black/10 dark:border-white/10"
                        />
                      ) : (
                        row.cargo_types || "—"
                      )}
                    </TableCell>
                    <TableCell className="py-3">
                      {editingId === row.id ? (
                        <Select
                          value={editingRow?.active ? "active" : "inactive"}
                          onValueChange={(v) => setEditingRow((c) => (c ? { ...c, active: v === "active" } : c))}
                          disabled={disableManageActions || updateRow.isPending}
                        >
                          <SelectTrigger className="h-9 rounded-lg w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span
                          className={`inline-block rounded-md px-2 py-0.5 text-xs font-bold ${
                            row.active
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                              : "bg-gray-100 text-gray-500 dark:bg-white/5"
                          }`}
                        >
                          {row.active ? "Active" : "Inactive"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right py-3">
                      {!canManage ? (
                        <span className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">Owner Only</span>
                      ) : editingId === row.id ? (
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" onClick={handleSave} disabled={updateRow.isPending} className="h-8 rounded-lg bg-primary text-primary-foreground">Save</Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingId(null);
                              setEditingRow(null);
                            }}
                            className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              if (!row.id) return;
                              setEditingId(row.id);
                              setEditingRow({ ...row });
                            }}
                            disabled={disableManageActions || !row.id}
                            aria-label={`Edit airline ${row.iata_code}`}
                            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => row.id && setDeleteTarget({ id: row.id, label: `airline "${row.iata_code}"` })}
                            disabled={disableManageActions || deleteRow.isPending || !row.id}
                            aria-label={`Delete airline ${row.iata_code}`}
                            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          >
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
        title={`Delete ${deleteTarget?.label ?? "this airline"}?`}
        description="This action cannot be undone. The airline will be permanently removed."
        onConfirm={handleDelete}
        isPending={deleteRow.isPending}
      />
    </Card>
  );
}
