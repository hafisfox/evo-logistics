"use client";

import { useMemo, useState, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  useCreateDestinationCharge,
  useCreateDOCharge,
  useCreateTransportCharge,
  useDeleteDestinationCharge,
  useDeleteDOCharge,
  useDeleteTransportCharge,
  useDestCharges,
  useDOCharges,
  useTransportCharges,
  useUpdateDestinationCharge,
  useUpdateDOCharge,
  useUpdateTransportCharge,
} from "@/hooks/use-pricing-tables";
import { useWorkspaceAccess } from "@/hooks/use-workspace-access";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import type { DestinationCharge, DOCharge, TransportCharge } from "@/types/pricing";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";

function toNumber(value: string | number) {
  if (typeof value === "number") return value;
  return Number(value.trim());
}

function numberString(value: number | string | undefined) {
  if (value == null) return "";
  return String(value);
}

export default function PricingPage() {
  const { data: doCharges, isLoading: doLoading } = useDOCharges();
  const { data: destCharges, isLoading: destLoading } = useDestCharges();
  const { data: transpCharges, isLoading: transpLoading } = useTransportCharges();
  const { canManage, isLoading: accessLoading } = useWorkspaceAccess();

  const createDo = useCreateDOCharge();
  const updateDo = useUpdateDOCharge();
  const deleteDo = useDeleteDOCharge();

  const createDest = useCreateDestinationCharge();
  const updateDest = useUpdateDestinationCharge();
  const deleteDest = useDeleteDestinationCharge();

  const createTransport = useCreateTransportCharge();
  const updateTransport = useUpdateTransportCharge();
  const deleteTransport = useDeleteTransportCharge();

  const [newDo, setNewDo] = useState({
    carrier: "",
    document: "",
    "20FT": "",
    "40FT": "",
    "40HQ": "",
  });
  const [editingDoId, setEditingDoId] = useState<number | null>(null);
  const [editingDo, setEditingDo] = useState<DOCharge | null>(null);

  const [newDest, setNewDest] = useState({
    "Charge Type": "",
    Basis: "",
    "20FT": "",
    "40FT": "",
  });
  const [editingDestId, setEditingDestId] = useState<number | null>(null);
  const [editingDest, setEditingDest] = useState<DestinationCharge | null>(null);

  const [newTransport, setNewTransport] = useState({ Place: "", Price: "" });
  const [editingTransportId, setEditingTransportId] = useState<number | null>(null);
  const [editingTransport, setEditingTransport] = useState<TransportCharge | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<{
    type: "do" | "dest" | "transport";
    id: number;
    label: string;
  } | null>(null);

  const disableManageActions = useMemo(
    () => accessLoading || !canManage,
    [accessLoading, canManage]
  );

  const handleCreateDo = async () => {
    const payload = {
      carrier: newDo.carrier.trim(),
      document: toNumber(newDo.document),
      "20FT": toNumber(newDo["20FT"]),
      "40FT": toNumber(newDo["40FT"]),
      "40HQ": toNumber(newDo["40HQ"]),
    };

    if (!payload.carrier || Object.values(payload).some((value) => typeof value === "number" && Number.isNaN(value))) {
      toast.error("Fill all DO charge fields with valid values");
      return;
    }

    try {
      await createDo.mutateAsync(payload);
      toast.success("DO charge row added");
      setNewDo({ carrier: "", document: "", "20FT": "", "40FT": "", "40HQ": "" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create DO charge row");
    }
  };

  const handleSaveDo = async () => {
    if (!editingDo || editingDoId == null) return;
    const payload = {
      id: editingDoId,
      carrier: editingDo.carrier?.trim(),
      document: toNumber(numberString(editingDo.document)),
      "20FT": toNumber(numberString(editingDo["20FT"])),
      "40FT": toNumber(numberString(editingDo["40FT"])),
      "40HQ": toNumber(numberString(editingDo["40HQ"])),
    };

    if (!payload.carrier || [payload.document, payload["20FT"], payload["40FT"], payload["40HQ"]].some(Number.isNaN)) {
      toast.error("DO charge row contains invalid values");
      return;
    }

    try {
      await updateDo.mutateAsync(payload);
      toast.success("DO charge row updated");
      setEditingDoId(null);
      setEditingDo(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update DO charge row");
    }
  };

  const handleDeleteDo = async (id: number) => {
    try {
      await deleteDo.mutateAsync({ id });
      toast.success("DO charge row deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete DO charge row");
    }
  };

  const handleCreateDest = async () => {
    const payload = {
      "Charge Type": newDest["Charge Type"].trim(),
      Basis: newDest.Basis.trim(),
      "20FT": toNumber(newDest["20FT"]),
      "40FT": toNumber(newDest["40FT"]),
    };

    if (!payload["Charge Type"] || !payload.Basis || Number.isNaN(payload["20FT"]) || Number.isNaN(payload["40FT"])) {
      toast.error("Fill all destination charge fields with valid values");
      return;
    }

    try {
      await createDest.mutateAsync(payload);
      toast.success("Destination charge row added");
      setNewDest({ "Charge Type": "", Basis: "", "20FT": "", "40FT": "" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create destination charge row");
    }
  };

  const handleSaveDest = async () => {
    if (!editingDest || editingDestId == null) return;
    const payload = {
      id: editingDestId,
      "Charge Type": editingDest["Charge Type"]?.trim(),
      Basis: editingDest.Basis?.trim(),
      "20FT": toNumber(numberString(editingDest["20FT"])),
      "40FT": toNumber(numberString(editingDest["40FT"])),
    };

    if (!payload["Charge Type"] || !payload.Basis || Number.isNaN(payload["20FT"]) || Number.isNaN(payload["40FT"])) {
      toast.error("Destination charge row contains invalid values");
      return;
    }

    try {
      await updateDest.mutateAsync(payload);
      toast.success("Destination charge row updated");
      setEditingDestId(null);
      setEditingDest(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update destination charge row");
    }
  };

  const handleDeleteDest = async (id: number) => {
    try {
      await deleteDest.mutateAsync({ id });
      toast.success("Destination charge row deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete destination charge row");
    }
  };

  const handleCreateTransport = async () => {
    const payload = {
      Place: newTransport.Place.trim(),
      Price: toNumber(newTransport.Price),
    };

    if (!payload.Place || Number.isNaN(payload.Price)) {
      toast.error("Fill all transport charge fields with valid values");
      return;
    }

    try {
      await createTransport.mutateAsync(payload);
      toast.success("Transport charge row added");
      setNewTransport({ Place: "", Price: "" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create transport charge row");
    }
  };

  const handleSaveTransport = async () => {
    if (!editingTransport || editingTransportId == null) return;
    const payload = {
      id: editingTransportId,
      Place: editingTransport.Place?.trim(),
      Price: toNumber(numberString(editingTransport.Price)),
    };

    if (!payload.Place || Number.isNaN(payload.Price)) {
      toast.error("Transport charge row contains invalid values");
      return;
    }

    try {
      await updateTransport.mutateAsync(payload);
      toast.success("Transport charge row updated");
      setEditingTransportId(null);
      setEditingTransport(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update transport charge row");
    }
  };

  const handleDeleteTransport = async (id: number) => {
    try {
      await deleteTransport.mutateAsync({ id });
      toast.success("Transport charge row deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete transport charge row");
    }
  };

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    const { type, id } = deleteTarget;
    if (type === "do") await handleDeleteDo(id);
    else if (type === "dest") await handleDeleteDest(id);
    else if (type === "transport") await handleDeleteTransport(id);
    setDeleteTarget(null);
  }, [deleteTarget]);

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 animate-in fade-in zoom-in-95 duration-700">
      <Tabs defaultValue="do" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto scrollbar-hide py-1 h-auto bg-card/60 backdrop-blur-2xl border border-white/10 dark:border-white/5 rounded-3xl mb-6 p-1.5 shadow-sm">
          <TabsTrigger value="do" className="shrink-0 font-medium tracking-tight rounded-2xl data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-md transition-all px-6 py-2">DO Charges</TabsTrigger>
          <TabsTrigger value="dest" className="shrink-0 font-medium tracking-tight rounded-2xl data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-md transition-all px-6 py-2">Destination Charges</TabsTrigger>
          <TabsTrigger value="transport" className="shrink-0 font-medium tracking-tight rounded-2xl data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-md transition-all px-6 py-2">Transportation</TabsTrigger>
        </TabsList>

        <TabsContent value="do" className="mt-2 focus-visible:outline-none focus-visible:ring-0">
          <Card className="rounded-3xl border border-white/20 dark:border-white/10 bg-card/60 dark:bg-card/40 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgba(255,255,255,0.03)] overflow-hidden">
            <CardHeader className="p-6 pb-4">
              <CardTitle className="text-lg font-bold tracking-tight">DO Charges by Carrier</CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6 pt-2">
              {canManage && (
                <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-6 bg-black/[0.02] dark:bg-white/[0.02] p-4 rounded-2xl border border-black/5 dark:border-white/5">
                  <Input
                    value={newDo.carrier}
                    onChange={(event) => setNewDo((current) => ({ ...current, carrier: event.target.value }))}
                    placeholder="Carrier"
                    disabled={disableManageActions || createDo.isPending}
                    className="rounded-xl border-black/10 dark:border-white/10 bg-background shadow-sm px-4 h-11 focus-visible:ring-1 focus-visible:ring-primary/50 transition-all"
                  />
                  <Input
                    value={newDo.document}
                    onChange={(event) => setNewDo((current) => ({ ...current, document: event.target.value }))}
                    placeholder="Document Fee"
                    disabled={disableManageActions || createDo.isPending}
                    className="rounded-xl border-black/10 dark:border-white/10 bg-background shadow-sm px-4 h-11 focus-visible:ring-1 focus-visible:ring-primary/50 transition-all font-mono"
                  />
                  <Input
                    value={newDo["20FT"]}
                    onChange={(event) => setNewDo((current) => ({ ...current, "20FT": event.target.value }))}
                    placeholder="20FT Rate"
                    disabled={disableManageActions || createDo.isPending}
                    className="rounded-xl border-black/10 dark:border-white/10 bg-background shadow-sm px-4 h-11 focus-visible:ring-1 focus-visible:ring-primary/50 transition-all font-mono"
                  />
                  <Input
                    value={newDo["40FT"]}
                    onChange={(event) => setNewDo((current) => ({ ...current, "40FT": event.target.value }))}
                    placeholder="40FT Rate"
                    disabled={disableManageActions || createDo.isPending}
                    className="rounded-xl border-black/10 dark:border-white/10 bg-background shadow-sm px-4 h-11 focus-visible:ring-1 focus-visible:ring-primary/50 transition-all font-mono"
                  />
                  <Input
                    value={newDo["40HQ"]}
                    onChange={(event) => setNewDo((current) => ({ ...current, "40HQ": event.target.value }))}
                    placeholder="40HQ Rate"
                    disabled={disableManageActions || createDo.isPending}
                    className="rounded-xl border-black/10 dark:border-white/10 bg-background shadow-sm px-4 h-11 focus-visible:ring-1 focus-visible:ring-primary/50 transition-all font-mono"
                  />
                  <Button onClick={handleCreateDo} disabled={disableManageActions || createDo.isPending} className="h-11 rounded-xl bg-primary text-primary-foreground font-semibold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all">
                    <Plus className="mr-1.5 h-4 w-4" /> Add Row
                  </Button>
                </div>
              )}
              {doLoading ? (
                <Skeleton className="h-48" />
              ) : (
                <div className="rounded-2xl border border-black/5 dark:border-white/5 overflow-x-auto scrollbar-hide">
                  <Table className="min-w-[800px]">
                    <TableHeader className="bg-black/[0.02] dark:bg-white/[0.02]">
                      <TableRow className="border-b border-black/5 dark:border-white/5 hover:bg-transparent">
                        <TableHead className="font-semibold text-muted-foreground h-12">Carrier</TableHead>
                        <TableHead className="text-right font-semibold text-muted-foreground h-12">Document Fee (AED)</TableHead>
                        <TableHead className="text-right font-semibold text-muted-foreground h-12">20FT (AED)</TableHead>
                        <TableHead className="text-right font-semibold text-muted-foreground h-12">40FT (AED)</TableHead>
                        <TableHead className="text-right font-semibold text-muted-foreground h-12">40HQ (AED)</TableHead>
                        <TableHead className="text-right font-semibold text-muted-foreground h-12 w-[120px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {doCharges?.map((row) => (
                        <TableRow key={row.id ?? row.carrier} className="group border-b border-black/5 dark:border-white/5 hover:bg-black/[0.01] dark:hover:bg-white/[0.01] transition-colors">
                          <TableCell className="font-semibold text-foreground py-3">
                            {editingDoId === row.id ? (
                              <Input
                                value={editingDo?.carrier ?? ""}
                                onChange={(event) =>
                                  setEditingDo((current) =>
                                    current ? { ...current, carrier: event.target.value } : current
                                  )
                                }
                                disabled={disableManageActions || updateDo.isPending}
                                className="h-9 rounded-lg border-black/10 dark:border-white/10"
                              />
                            ) : (
                              row.carrier
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium text-muted-foreground py-3 opacity-90 group-hover:opacity-100 transition-opacity">
                            {editingDoId === row.id ? (
                              <Input
                                value={numberString(editingDo?.document)}
                                onChange={(event) =>
                                  setEditingDo((current) =>
                                    current ? { ...current, document: Number(event.target.value) } : current
                                  )
                                }
                                disabled={disableManageActions || updateDo.isPending}
                                className="h-9 rounded-lg text-right font-mono border-black/10 dark:border-white/10"
                              />
                            ) : (
                              <span className="bg-black/5 dark:bg-white/5 px-2 py-1 rounded-md">{formatCurrency(row.document)}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium text-muted-foreground py-3 opacity-90 group-hover:opacity-100 transition-opacity">
                            {editingDoId === row.id ? (
                              <Input
                                value={numberString(editingDo?.["20FT"])}
                                onChange={(event) =>
                                  setEditingDo((current) =>
                                    current ? { ...current, "20FT": Number(event.target.value) } : current
                                  )
                                }
                                disabled={disableManageActions || updateDo.isPending}
                                className="h-9 rounded-lg text-right font-mono border-black/10 dark:border-white/10"
                              />
                            ) : (
                              <span className="bg-black/5 dark:bg-white/5 px-2 py-1 rounded-md">{formatCurrency(row["20FT"])}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium text-muted-foreground py-3 opacity-90 group-hover:opacity-100 transition-opacity">
                            {editingDoId === row.id ? (
                              <Input
                                value={numberString(editingDo?.["40FT"])}
                                onChange={(event) =>
                                  setEditingDo((current) =>
                                    current ? { ...current, "40FT": Number(event.target.value) } : current
                                  )
                                }
                                disabled={disableManageActions || updateDo.isPending}
                                className="h-9 rounded-lg text-right font-mono border-black/10 dark:border-white/10"
                              />
                            ) : (
                              <span className="bg-black/5 dark:bg-white/5 px-2 py-1 rounded-md">{formatCurrency(row["40FT"])}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium text-muted-foreground py-3 opacity-90 group-hover:opacity-100 transition-opacity">
                            {editingDoId === row.id ? (
                              <Input
                                value={numberString(editingDo?.["40HQ"])}
                                onChange={(event) =>
                                  setEditingDo((current) =>
                                    current ? { ...current, "40HQ": Number(event.target.value) } : current
                                  )
                                }
                                disabled={disableManageActions || updateDo.isPending}
                                className="h-9 rounded-lg text-right font-mono border-black/10 dark:border-white/10"
                              />
                            ) : (
                              <span className="bg-black/5 dark:bg-white/5 px-2 py-1 rounded-md">{formatCurrency(row["40HQ"])}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right py-3">
                            {!canManage ? (
                              <span className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">Owner Only</span>
                            ) : editingDoId === row.id ? (
                              <div className="flex justify-end gap-1.5">
                                <Button size="sm" onClick={handleSaveDo} disabled={updateDo.isPending} className="h-8 rounded-lg bg-primary text-primary-foreground">Save</Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingDoId(null);
                                    setEditingDo(null);
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
                                    setEditingDoId(row.id);
                                    setEditingDo({ ...row });
                                  }}
                                  disabled={disableManageActions || !row.id}
                                  aria-label={`Edit DO ${row.carrier}`}
                                  className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => row.id && setDeleteTarget({ type: "do", id: row.id, label: `DO charge "${row.carrier}"` })}
                                  disabled={disableManageActions || deleteDo.isPending || !row.id}
                                  aria-label={`Delete DO ${row.carrier}`}
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
          </Card>
        </TabsContent>

        <TabsContent value="dest" className="mt-2 focus-visible:outline-none focus-visible:ring-0">
          <Card className="rounded-3xl border border-white/20 dark:border-white/10 bg-card/60 dark:bg-card/40 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgba(255,255,255,0.03)] overflow-hidden">
            <CardHeader className="p-6 pb-4">
              <CardTitle className="text-lg font-bold tracking-tight">UAE Destination Charges</CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6 pt-2">
              {canManage && (
                <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-5 bg-black/[0.02] dark:bg-white/[0.02] p-4 rounded-2xl border border-black/5 dark:border-white/5">
                  <Input
                    value={newDest["Charge Type"]}
                    onChange={(event) =>
                      setNewDest((current) => ({ ...current, "Charge Type": event.target.value }))
                    }
                    placeholder="Charge Type"
                    disabled={disableManageActions || createDest.isPending}
                    className="rounded-xl border-black/10 dark:border-white/10 bg-background shadow-sm px-4 h-11 focus-visible:ring-1 focus-visible:ring-primary/50 transition-all"
                  />
                  <Input
                    value={newDest.Basis}
                    onChange={(event) => setNewDest((current) => ({ ...current, Basis: event.target.value }))}
                    placeholder="Basis (e.g., Per B/L)"
                    disabled={disableManageActions || createDest.isPending}
                    className="rounded-xl border-black/10 dark:border-white/10 bg-background shadow-sm px-4 h-11 focus-visible:ring-1 focus-visible:ring-primary/50 transition-all"
                  />
                  <Input
                    value={newDest["20FT"]}
                    onChange={(event) => setNewDest((current) => ({ ...current, "20FT": event.target.value }))}
                    placeholder="20FT Check"
                    disabled={disableManageActions || createDest.isPending}
                    className="rounded-xl border-black/10 dark:border-white/10 bg-background shadow-sm px-4 h-11 focus-visible:ring-1 focus-visible:ring-primary/50 transition-all font-mono"
                  />
                  <Input
                    value={newDest["40FT"]}
                    onChange={(event) => setNewDest((current) => ({ ...current, "40FT": event.target.value }))}
                    placeholder="40FT / HQ Check"
                    disabled={disableManageActions || createDest.isPending}
                    className="rounded-xl border-black/10 dark:border-white/10 bg-background shadow-sm px-4 h-11 focus-visible:ring-1 focus-visible:ring-primary/50 transition-all font-mono"
                  />
                  <Button onClick={handleCreateDest} disabled={disableManageActions || createDest.isPending} className="h-11 rounded-xl bg-primary text-primary-foreground font-semibold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all">
                    <Plus className="mr-1.5 h-4 w-4" /> Add Row
                  </Button>
                </div>
              )}
              {destLoading ? (
                <Skeleton className="h-48" />
              ) : (
                <div className="rounded-2xl border border-black/5 dark:border-white/5 overflow-x-auto scrollbar-hide">
                  <Table className="min-w-[700px]">
                    <TableHeader className="bg-black/[0.02] dark:bg-white/[0.02]">
                      <TableRow className="border-b border-black/5 dark:border-white/5 hover:bg-transparent">
                        <TableHead className="font-semibold text-muted-foreground h-12">Charge Type</TableHead>
                        <TableHead className="font-semibold text-muted-foreground h-12">Basis</TableHead>
                        <TableHead className="text-right font-semibold text-muted-foreground h-12">20FT (AED)</TableHead>
                        <TableHead className="text-right font-semibold text-muted-foreground h-12">40FT/HQ (AED)</TableHead>
                        <TableHead className="text-right font-semibold text-muted-foreground h-12 w-[120px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {destCharges?.map((row) => (
                        <TableRow key={row.id ?? row["Charge Type"]} className="group border-b border-black/5 dark:border-white/5 hover:bg-black/[0.01] dark:hover:bg-white/[0.01] transition-colors">
                          <TableCell className="font-semibold text-foreground py-3">
                            {editingDestId === row.id ? (
                              <Input
                                value={editingDest?.["Charge Type"] ?? ""}
                                onChange={(event) =>
                                  setEditingDest((current) =>
                                    current
                                      ? { ...current, "Charge Type": event.target.value }
                                      : current
                                  )
                                }
                                disabled={disableManageActions || updateDest.isPending}
                                className="h-9 rounded-lg border-black/10 dark:border-white/10"
                              />
                            ) : (
                              row["Charge Type"]
                            )}
                          </TableCell>
                          <TableCell className="text-sm font-medium text-muted-foreground py-3">
                            {editingDestId === row.id ? (
                              <Input
                                value={editingDest?.Basis ?? ""}
                                onChange={(event) =>
                                  setEditingDest((current) =>
                                    current ? { ...current, Basis: event.target.value } : current
                                  )
                                }
                                disabled={disableManageActions || updateDest.isPending}
                                className="h-9 rounded-lg border-black/10 dark:border-white/10"
                              />
                            ) : (
                              <span className="bg-black/5 dark:bg-white/5 px-2 py-1 rounded-md text-[11px] uppercase tracking-wider">{row.Basis}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium text-muted-foreground py-3 opacity-90 group-hover:opacity-100 transition-opacity">
                            {editingDestId === row.id ? (
                              <Input
                                value={numberString(editingDest?.["20FT"])}
                                onChange={(event) =>
                                  setEditingDest((current) =>
                                    current ? { ...current, "20FT": Number(event.target.value) } : current
                                  )
                                }
                                disabled={disableManageActions || updateDest.isPending}
                                className="h-9 rounded-lg text-right font-mono border-black/10 dark:border-white/10"
                              />
                            ) : (
                              <span className="bg-black/5 dark:bg-white/5 px-2 py-1 rounded-md">{formatCurrency(row["20FT"])}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium text-muted-foreground py-3 opacity-90 group-hover:opacity-100 transition-opacity">
                            {editingDestId === row.id ? (
                              <Input
                                value={numberString(editingDest?.["40FT"])}
                                onChange={(event) =>
                                  setEditingDest((current) =>
                                    current ? { ...current, "40FT": Number(event.target.value) } : current
                                  )
                                }
                                disabled={disableManageActions || updateDest.isPending}
                                className="h-9 rounded-lg text-right font-mono border-black/10 dark:border-white/10"
                              />
                            ) : (
                              <span className="bg-black/5 dark:bg-white/5 px-2 py-1 rounded-md">{formatCurrency(row["40FT"])}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right py-3">
                            {!canManage ? (
                              <span className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">Owner Only</span>
                            ) : editingDestId === row.id ? (
                              <div className="flex justify-end gap-1.5">
                                <Button size="sm" onClick={handleSaveDest} disabled={updateDest.isPending} className="h-8 rounded-lg bg-primary text-primary-foreground">Save</Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingDestId(null);
                                    setEditingDest(null);
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
                                    setEditingDestId(row.id);
                                    setEditingDest({ ...row });
                                  }}
                                  disabled={disableManageActions || !row.id}
                                  aria-label={`Edit destination ${row["Charge Type"]}`}
                                  className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => row.id && setDeleteTarget({ type: "dest", id: row.id, label: `destination charge "${row["Charge Type"]}"` })}
                                  disabled={disableManageActions || deleteDest.isPending || !row.id}
                                  aria-label={`Delete destination ${row["Charge Type"]}`}
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
          </Card>
        </TabsContent>

        <TabsContent value="transport" className="mt-2 focus-visible:outline-none focus-visible:ring-0">
          <Card className="rounded-3xl border border-white/20 dark:border-white/10 bg-card/60 dark:bg-card/40 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgba(255,255,255,0.03)] overflow-hidden">
            <CardHeader className="p-6 pb-4">
              <CardTitle className="text-lg font-bold tracking-tight">
                Transportation Charges by Location
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6 pt-2">
              {canManage && (
                <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3 bg-black/[0.02] dark:bg-white/[0.02] p-4 rounded-2xl border border-black/5 dark:border-white/5">
                  <Input
                    value={newTransport.Place}
                    onChange={(event) =>
                      setNewTransport((current) => ({ ...current, Place: event.target.value }))
                    }
                    placeholder="Location / Place"
                    disabled={disableManageActions || createTransport.isPending}
                    className="rounded-xl border-black/10 dark:border-white/10 bg-background shadow-sm px-4 h-11 focus-visible:ring-1 focus-visible:ring-primary/50 transition-all"
                  />
                  <Input
                    value={newTransport.Price}
                    onChange={(event) =>
                      setNewTransport((current) => ({ ...current, Price: event.target.value }))
                    }
                    placeholder="Price (AED)"
                    disabled={disableManageActions || createTransport.isPending}
                    className="rounded-xl border-black/10 dark:border-white/10 bg-background shadow-sm px-4 h-11 focus-visible:ring-1 focus-visible:ring-primary/50 transition-all font-mono"
                  />
                  <Button
                    onClick={handleCreateTransport}
                    disabled={disableManageActions || createTransport.isPending}
                    className="h-11 rounded-xl bg-primary text-primary-foreground font-semibold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all"
                  >
                    <Plus className="mr-1.5 h-4 w-4" /> Add Location
                  </Button>
                </div>
              )}
              {transpLoading ? (
                <Skeleton className="h-48" />
              ) : (
                <div className="rounded-2xl border border-black/5 dark:border-white/5 overflow-x-auto scrollbar-hide">
                  <Table className="min-w-[560px]">
                    <TableHeader className="bg-black/[0.02] dark:bg-white/[0.02]">
                      <TableRow className="border-b border-black/5 dark:border-white/5 hover:bg-transparent">
                        <TableHead className="font-semibold text-muted-foreground h-12">Place</TableHead>
                        <TableHead className="text-right font-semibold text-muted-foreground h-12">Price (AED)</TableHead>
                        <TableHead className="text-right font-semibold text-muted-foreground h-12 w-[120px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transpCharges?.map((row) => (
                        <TableRow key={row.id ?? row.Place} className="group border-b border-black/5 dark:border-white/5 hover:bg-black/[0.01] dark:hover:bg-white/[0.01] transition-colors">
                          <TableCell className="font-semibold text-foreground py-4">
                            {editingTransportId === row.id ? (
                              <Input
                                value={editingTransport?.Place ?? ""}
                                onChange={(event) =>
                                  setEditingTransport((current) =>
                                    current ? { ...current, Place: event.target.value } : current
                                  )
                                }
                                disabled={disableManageActions || updateTransport.isPending}
                                className="h-9 rounded-lg border-black/10 dark:border-white/10"
                              />
                            ) : (
                              row.Place
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium text-muted-foreground py-4 opacity-90 group-hover:opacity-100 transition-opacity">
                            {editingTransportId === row.id ? (
                              <Input
                                value={numberString(editingTransport?.Price)}
                                onChange={(event) =>
                                  setEditingTransport((current) =>
                                    current ? { ...current, Price: Number(event.target.value) } : current
                                  )
                                }
                                disabled={disableManageActions || updateTransport.isPending}
                                className="h-9 rounded-lg text-right font-mono border-black/10 dark:border-white/10"
                              />
                            ) : (
                              <span className="bg-black/5 dark:bg-white/5 px-2 py-1 rounded-md">{formatCurrency(row.Price)}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right py-4">
                            {!canManage ? (
                              <span className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">Owner Only</span>
                            ) : editingTransportId === row.id ? (
                              <div className="flex justify-end gap-1.5">
                                <Button size="sm" onClick={handleSaveTransport} disabled={updateTransport.isPending} className="h-8 rounded-lg bg-primary text-primary-foreground">
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingTransportId(null);
                                    setEditingTransport(null);
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
                                    setEditingTransportId(row.id);
                                    setEditingTransport({ ...row });
                                  }}
                                  disabled={disableManageActions || !row.id}
                                  aria-label={`Edit transport ${row.Place}`}
                                  className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => row.id && setDeleteTarget({ type: "transport", id: row.id, label: `transport charge "${row.Place}"` })}
                                  disabled={disableManageActions || deleteTransport.isPending || !row.id}
                                  aria-label={`Delete transport ${row.Place}`}
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
          </Card>
        </TabsContent>
      </Tabs>
      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title={`Delete ${deleteTarget?.label ?? "this row"}?`}
        description="This action cannot be undone. The pricing row will be permanently removed."
        onConfirm={handleConfirmDelete}
        isPending={deleteDo.isPending || deleteDest.isPending || deleteTransport.isPending}
      />
    </div>
  );
}
