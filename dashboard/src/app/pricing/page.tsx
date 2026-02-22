"use client";

import { useMemo, useState } from "react";
import { Header } from "@/components/layout/header";
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

  const handleDeleteDo = async (id?: number) => {
    if (!id) return;
    if (!window.confirm("Delete this DO charge row?")) return;

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

  const handleDeleteDest = async (id?: number) => {
    if (!id) return;
    if (!window.confirm("Delete this destination charge row?")) return;

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

  const handleDeleteTransport = async (id?: number) => {
    if (!id) return;
    if (!window.confirm("Delete this transport charge row?")) return;

    try {
      await deleteTransport.mutateAsync({ id });
      toast.success("Transport charge row deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete transport charge row");
    }
  };

  return (
    <div>
      <Header
        title="Pricing Tables"
        description="Lookup tables used in cost calculations"
      />
      <div className="p-6">
        <Tabs defaultValue="do" className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto scrollbar-hide py-1 h-auto">
            <TabsTrigger value="do" className="shrink-0 tracking-tight">DO Charges</TabsTrigger>
            <TabsTrigger value="dest">Destination Charges</TabsTrigger>
            <TabsTrigger value="transport">Transportation</TabsTrigger>
          </TabsList>

          <TabsContent value="do" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">DO Charges by Carrier</CardTitle>
              </CardHeader>
              <CardContent>
                {canManage && (
                  <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-6">
                    <Input
                      value={newDo.carrier}
                      onChange={(event) => setNewDo((current) => ({ ...current, carrier: event.target.value }))}
                      placeholder="Carrier"
                      disabled={disableManageActions || createDo.isPending}
                    />
                    <Input
                      value={newDo.document}
                      onChange={(event) => setNewDo((current) => ({ ...current, document: event.target.value }))}
                      placeholder="Document"
                      disabled={disableManageActions || createDo.isPending}
                    />
                    <Input
                      value={newDo["20FT"]}
                      onChange={(event) => setNewDo((current) => ({ ...current, "20FT": event.target.value }))}
                      placeholder="20FT"
                      disabled={disableManageActions || createDo.isPending}
                    />
                    <Input
                      value={newDo["40FT"]}
                      onChange={(event) => setNewDo((current) => ({ ...current, "40FT": event.target.value }))}
                      placeholder="40FT"
                      disabled={disableManageActions || createDo.isPending}
                    />
                    <Input
                      value={newDo["40HQ"]}
                      onChange={(event) => setNewDo((current) => ({ ...current, "40HQ": event.target.value }))}
                      placeholder="40HQ"
                      disabled={disableManageActions || createDo.isPending}
                    />
                    <Button onClick={handleCreateDo} disabled={disableManageActions || createDo.isPending}>
                      <Plus className="mr-1 h-4 w-4" /> Add
                    </Button>
                  </div>
                )}
                {doLoading ? (
                  <Skeleton className="h-48" />
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table className="min-w-[760px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Carrier</TableHead>
                          <TableHead className="text-right">Document Fee</TableHead>
                          <TableHead className="text-right">20FT</TableHead>
                          <TableHead className="text-right">40FT</TableHead>
                          <TableHead className="text-right">40HQ</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {doCharges?.map((row) => (
                          <TableRow key={row.id ?? row.carrier}>
                            <TableCell className="font-medium">
                              {editingDoId === row.id ? (
                                <Input
                                  value={editingDo?.carrier ?? ""}
                                  onChange={(event) =>
                                    setEditingDo((current) =>
                                      current ? { ...current, carrier: event.target.value } : current
                                    )
                                  }
                                  disabled={disableManageActions || updateDo.isPending}
                                />
                              ) : (
                                row.carrier
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {editingDoId === row.id ? (
                                <Input
                                  value={numberString(editingDo?.document)}
                                  onChange={(event) =>
                                    setEditingDo((current) =>
                                      current ? { ...current, document: Number(event.target.value) } : current
                                    )
                                  }
                                  disabled={disableManageActions || updateDo.isPending}
                                />
                              ) : (
                                formatCurrency(row.document)
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {editingDoId === row.id ? (
                                <Input
                                  value={numberString(editingDo?.["20FT"])}
                                  onChange={(event) =>
                                    setEditingDo((current) =>
                                      current ? { ...current, "20FT": Number(event.target.value) } : current
                                    )
                                  }
                                  disabled={disableManageActions || updateDo.isPending}
                                />
                              ) : (
                                formatCurrency(row["20FT"])
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {editingDoId === row.id ? (
                                <Input
                                  value={numberString(editingDo?.["40FT"])}
                                  onChange={(event) =>
                                    setEditingDo((current) =>
                                      current ? { ...current, "40FT": Number(event.target.value) } : current
                                    )
                                  }
                                  disabled={disableManageActions || updateDo.isPending}
                                />
                              ) : (
                                formatCurrency(row["40FT"])
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {editingDoId === row.id ? (
                                <Input
                                  value={numberString(editingDo?.["40HQ"])}
                                  onChange={(event) =>
                                    setEditingDo((current) =>
                                      current ? { ...current, "40HQ": Number(event.target.value) } : current
                                    )
                                  }
                                  disabled={disableManageActions || updateDo.isPending}
                                />
                              ) : (
                                formatCurrency(row["40HQ"])
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {!canManage ? (
                                <span className="text-xs text-muted-foreground">Owner/Admin only</span>
                              ) : editingDoId === row.id ? (
                                <div className="flex justify-end gap-2">
                                  <Button size="sm" onClick={handleSaveDo} disabled={updateDo.isPending}>Save</Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setEditingDoId(null);
                                      setEditingDo(null);
                                    }}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex justify-end gap-2">
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
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => handleDeleteDo(row.id)}
                                    disabled={disableManageActions || deleteDo.isPending || !row.id}
                                    aria-label={`Delete DO ${row.carrier}`}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
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

          <TabsContent value="dest" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">UAE Destination Charges</CardTitle>
              </CardHeader>
              <CardContent>
                {canManage && (
                  <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-5">
                    <Input
                      value={newDest["Charge Type"]}
                      onChange={(event) =>
                        setNewDest((current) => ({ ...current, "Charge Type": event.target.value }))
                      }
                      placeholder="Charge Type"
                      disabled={disableManageActions || createDest.isPending}
                    />
                    <Input
                      value={newDest.Basis}
                      onChange={(event) => setNewDest((current) => ({ ...current, Basis: event.target.value }))}
                      placeholder="Basis"
                      disabled={disableManageActions || createDest.isPending}
                    />
                    <Input
                      value={newDest["20FT"]}
                      onChange={(event) => setNewDest((current) => ({ ...current, "20FT": event.target.value }))}
                      placeholder="20FT"
                      disabled={disableManageActions || createDest.isPending}
                    />
                    <Input
                      value={newDest["40FT"]}
                      onChange={(event) => setNewDest((current) => ({ ...current, "40FT": event.target.value }))}
                      placeholder="40FT"
                      disabled={disableManageActions || createDest.isPending}
                    />
                    <Button onClick={handleCreateDest} disabled={disableManageActions || createDest.isPending}>
                      <Plus className="mr-1 h-4 w-4" /> Add
                    </Button>
                  </div>
                )}
                {destLoading ? (
                  <Skeleton className="h-48" />
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table className="min-w-[680px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Charge Type</TableHead>
                          <TableHead>Basis</TableHead>
                          <TableHead className="text-right">20FT</TableHead>
                          <TableHead className="text-right">40FT</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {destCharges?.map((row) => (
                          <TableRow key={row.id ?? row["Charge Type"]}>
                            <TableCell className="font-medium">
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
                                />
                              ) : (
                                row["Charge Type"]
                              )}
                            </TableCell>
                            <TableCell className="text-sm">
                              {editingDestId === row.id ? (
                                <Input
                                  value={editingDest?.Basis ?? ""}
                                  onChange={(event) =>
                                    setEditingDest((current) =>
                                      current ? { ...current, Basis: event.target.value } : current
                                    )
                                  }
                                  disabled={disableManageActions || updateDest.isPending}
                                />
                              ) : (
                                row.Basis
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {editingDestId === row.id ? (
                                <Input
                                  value={numberString(editingDest?.["20FT"])}
                                  onChange={(event) =>
                                    setEditingDest((current) =>
                                      current ? { ...current, "20FT": Number(event.target.value) } : current
                                    )
                                  }
                                  disabled={disableManageActions || updateDest.isPending}
                                />
                              ) : (
                                formatCurrency(row["20FT"])
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {editingDestId === row.id ? (
                                <Input
                                  value={numberString(editingDest?.["40FT"])}
                                  onChange={(event) =>
                                    setEditingDest((current) =>
                                      current ? { ...current, "40FT": Number(event.target.value) } : current
                                    )
                                  }
                                  disabled={disableManageActions || updateDest.isPending}
                                />
                              ) : (
                                formatCurrency(row["40FT"])
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {!canManage ? (
                                <span className="text-xs text-muted-foreground">Owner/Admin only</span>
                              ) : editingDestId === row.id ? (
                                <div className="flex justify-end gap-2">
                                  <Button size="sm" onClick={handleSaveDest} disabled={updateDest.isPending}>Save</Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setEditingDestId(null);
                                      setEditingDest(null);
                                    }}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex justify-end gap-2">
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
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => handleDeleteDest(row.id)}
                                    disabled={disableManageActions || deleteDest.isPending || !row.id}
                                    aria-label={`Delete destination ${row["Charge Type"]}`}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
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

          <TabsContent value="transport" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Transportation Charges by Location
                </CardTitle>
              </CardHeader>
              <CardContent>
                {canManage && (
                  <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-3">
                    <Input
                      value={newTransport.Place}
                      onChange={(event) =>
                        setNewTransport((current) => ({ ...current, Place: event.target.value }))
                      }
                      placeholder="Place"
                      disabled={disableManageActions || createTransport.isPending}
                    />
                    <Input
                      value={newTransport.Price}
                      onChange={(event) =>
                        setNewTransport((current) => ({ ...current, Price: event.target.value }))
                      }
                      placeholder="Price"
                      disabled={disableManageActions || createTransport.isPending}
                    />
                    <Button
                      onClick={handleCreateTransport}
                      disabled={disableManageActions || createTransport.isPending}
                    >
                      <Plus className="mr-1 h-4 w-4" /> Add
                    </Button>
                  </div>
                )}
                {transpLoading ? (
                  <Skeleton className="h-48" />
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table className="min-w-[560px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Place</TableHead>
                          <TableHead className="text-right">Price (AED)</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transpCharges?.map((row) => (
                          <TableRow key={row.id ?? row.Place}>
                            <TableCell className="font-medium">
                              {editingTransportId === row.id ? (
                                <Input
                                  value={editingTransport?.Place ?? ""}
                                  onChange={(event) =>
                                    setEditingTransport((current) =>
                                      current ? { ...current, Place: event.target.value } : current
                                    )
                                  }
                                  disabled={disableManageActions || updateTransport.isPending}
                                />
                              ) : (
                                row.Place
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {editingTransportId === row.id ? (
                                <Input
                                  value={numberString(editingTransport?.Price)}
                                  onChange={(event) =>
                                    setEditingTransport((current) =>
                                      current ? { ...current, Price: Number(event.target.value) } : current
                                    )
                                  }
                                  disabled={disableManageActions || updateTransport.isPending}
                                />
                              ) : (
                                formatCurrency(row.Price)
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {!canManage ? (
                                <span className="text-xs text-muted-foreground">Owner/Admin only</span>
                              ) : editingTransportId === row.id ? (
                                <div className="flex justify-end gap-2">
                                  <Button size="sm" onClick={handleSaveTransport} disabled={updateTransport.isPending}>
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setEditingTransportId(null);
                                      setEditingTransport(null);
                                    }}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex justify-end gap-2">
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
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => handleDeleteTransport(row.id)}
                                    disabled={disableManageActions || deleteTransport.isPending || !row.id}
                                    aria-label={`Delete transport ${row.Place}`}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
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
      </div>
    </div>
  );
}
