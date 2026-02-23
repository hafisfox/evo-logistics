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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAgents,
  useCreateAgent,
  useDeleteAgent,
  useUpdateAgent,
} from "@/hooks/use-agents";
import { useWorkspaceAccess } from "@/hooks/use-workspace-access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, Users, X } from "lucide-react";

type DraftAgent = {
  agent_name: string;
  email: string;
  status: "active" | "inactive";
};

export default function AgentsPage() {
  const { data: agents, isLoading } = useAgents();
  const { canManage, isLoading: accessLoading } = useWorkspaceAccess();
  const createMutation = useCreateAgent();
  const updateMutation = useUpdateAgent();
  const deleteMutation = useDeleteAgent();

  const [newAgent, setNewAgent] = useState<DraftAgent>({
    agent_name: "",
    email: "",
    status: "active",
  });
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingAgent, setEditingAgent] = useState<DraftAgent | null>(null);

  const disableManageActions = useMemo(
    () => accessLoading || !canManage,
    [accessLoading, canManage]
  );

  const startEditing = (agent: DraftAgent) => {
    setEditingKey(agent.agent_name);
    setEditingAgent({ ...agent });
  };

  const cancelEditing = () => {
    setEditingKey(null);
    setEditingAgent(null);
  };

  const createAgent = async () => {
    try {
      await createMutation.mutateAsync(newAgent);
      toast.success("Agent added");
      setNewAgent({ agent_name: "", email: "", status: "active" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add agent");
    }
  };

  const saveAgent = async () => {
    if (!editingKey || !editingAgent) return;
    try {
      await updateMutation.mutateAsync({
        current_agent_name: editingKey,
        ...editingAgent,
      });
      toast.success("Agent updated");
      cancelEditing();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update agent");
    }
  };

  const deleteAgent = async (agentName: string) => {
    const confirmed = window.confirm(`Delete agent \"${agentName}\"?`);
    if (!confirmed) return;

    try {
      await deleteMutation.mutateAsync({ agent_name: agentName });
      toast.success("Agent deleted");
      if (editingKey === agentName) cancelEditing();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete agent");
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 animate-in fade-in zoom-in-95 duration-700">
      <Card className="rounded-3xl border border-white/20 dark:border-white/10 bg-card/60 dark:bg-card/40 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgba(255,255,255,0.03)] overflow-hidden">
        <CardHeader className="p-6 pb-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg font-bold tracking-tight">Agents Directory</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="px-6 pb-6 pt-2">
          {canManage && (
            <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-4 bg-black/[0.02] dark:bg-white/[0.02] p-4 rounded-2xl border border-black/5 dark:border-white/5">
              <Input
                value={newAgent.agent_name}
                onChange={(event) =>
                  setNewAgent((current) => ({
                    ...current,
                    agent_name: event.target.value,
                  }))
                }
                placeholder="Agent Name"
                disabled={createMutation.isPending}
                className="rounded-xl border-black/10 dark:border-white/10 bg-background shadow-sm px-4 h-11 focus-visible:ring-1 focus-visible:ring-primary/50 transition-all font-medium"
              />
              <Input
                value={newAgent.email}
                onChange={(event) =>
                  setNewAgent((current) => ({ ...current, email: event.target.value }))
                }
                placeholder="Agent Email Address"
                disabled={createMutation.isPending}
                className="rounded-xl border-black/10 dark:border-white/10 bg-background shadow-sm px-4 h-11 focus-visible:ring-1 focus-visible:ring-primary/50 transition-all"
              />
              <Select
                value={newAgent.status}
                onValueChange={(value) =>
                  setNewAgent((current) => ({
                    ...current,
                    status: value as "active" | "inactive",
                  }))
                }
                disabled={createMutation.isPending}
              >
                <SelectTrigger className="rounded-xl border-black/10 dark:border-white/10 bg-background shadow-sm px-4 h-11 focus-visible:ring-1 focus-visible:ring-primary/50 transition-all font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-2xl shadow-xl border-black/5 dark:border-white/10 backdrop-blur-xl bg-background/95">
                  <SelectItem value="active" className="rounded-xl cursor-pointer py-2">active</SelectItem>
                  <SelectItem value="inactive" className="rounded-xl cursor-pointer py-2">inactive</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={createAgent}
                disabled={
                  createMutation.isPending ||
                  !newAgent.agent_name.trim() ||
                  !newAgent.email.trim()
                }
                className="h-11 rounded-xl bg-primary text-primary-foreground font-semibold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all w-full"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add New Agent
              </Button>
            </div>
          )}
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-black/5 dark:border-white/5 overflow-x-auto scrollbar-hide">
              <Table className="min-w-[600px]">
                <TableHeader className="bg-black/[0.02] dark:bg-white/[0.02]">
                  <TableRow className="border-b border-black/5 dark:border-white/5 hover:bg-transparent">
                    <TableHead className="font-semibold text-muted-foreground h-12">Agent Name</TableHead>
                    <TableHead className="font-semibold text-muted-foreground h-12">Email Address</TableHead>
                    <TableHead className="font-semibold text-muted-foreground h-12">Status</TableHead>
                    <TableHead className="text-right font-semibold text-muted-foreground h-12 w-[120px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agents?.map((agent) => (
                    <TableRow key={agent.email} className="group border-b border-black/5 dark:border-white/5 hover:bg-black/[0.015] dark:hover:bg-white/[0.015] transition-colors cursor-pointer">
                      <TableCell className="font-semibold text-foreground py-4">
                        {editingKey === agent.agent_name ? (
                          <Input
                            value={editingAgent?.agent_name ?? ""}
                            onChange={(event) =>
                              setEditingAgent((current) =>
                                current
                                  ? { ...current, agent_name: event.target.value }
                                  : current
                              )
                            }
                            disabled={disableManageActions || updateMutation.isPending}
                            className="h-9 rounded-lg border-black/10 dark:border-white/10 w-full font-medium"
                          />
                        ) : (
                          agent.agent_name
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground font-medium py-4">
                        {editingKey === agent.agent_name ? (
                          <Input
                            value={editingAgent?.email ?? ""}
                            onChange={(event) =>
                              setEditingAgent((current) =>
                                current ? { ...current, email: event.target.value } : current
                              )
                            }
                            disabled={disableManageActions || updateMutation.isPending}
                            className="h-9 rounded-lg border-black/10 dark:border-white/10 w-full"
                          />
                        ) : (
                          agent.email
                        )}
                      </TableCell>
                      <TableCell className="py-4">
                        {editingKey === agent.agent_name ? (
                          <Select
                            value={editingAgent?.status ?? "active"}
                            onValueChange={(value) =>
                              setEditingAgent((current) =>
                                current
                                  ? { ...current, status: value as "active" | "inactive" }
                                  : current
                              )
                            }
                            disabled={disableManageActions || updateMutation.isPending}
                          >
                            <SelectTrigger className="h-9 w-[120px] rounded-lg border-black/10 dark:border-white/10 font-medium">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl shadow-xl border-black/5 dark:border-white/10 backdrop-blur-xl bg-background/95">
                              <SelectItem value="active" className="rounded-xl cursor-pointer py-2">active</SelectItem>
                              <SelectItem value="inactive" className="rounded-xl cursor-pointer py-2">inactive</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge
                            variant="outline"
                            className={
                              agent.status === "active"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-medium rounded-full px-2.5 py-0.5 shadow-sm"
                                : "bg-muted text-muted-foreground border-border/50 font-medium rounded-full px-2.5 py-0.5"
                            }
                          >
                            {agent.status}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right py-4 cursor-default">
                        {!canManage ? (
                          <span className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">Owner Only</span>
                        ) : editingKey === agent.agent_name ? (
                          <div className="flex justify-end gap-1.5">
                            <Button
                              size="sm"
                              onClick={saveAgent}
                              disabled={updateMutation.isPending || disableManageActions}
                              className="h-8 rounded-lg bg-primary text-primary-foreground"
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={cancelEditing}
                              disabled={updateMutation.isPending}
                              className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditing({
                                  agent_name: agent.agent_name,
                                  email: agent.email,
                                  status: agent.status,
                                });
                              }}
                              disabled={disableManageActions}
                              aria-label={`Edit ${agent.agent_name}`}
                              title={`Edit ${agent.agent_name}`}
                              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteAgent(agent.agent_name);
                              }}
                              disabled={disableManageActions || deleteMutation.isPending}
                              aria-label={`Delete ${agent.agent_name}`}
                              title={`Delete ${agent.agent_name}`}
                              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!agents || agents.length === 0) && (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="h-32 text-center text-muted-foreground/60 font-medium"
                      >
                        No agents found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
