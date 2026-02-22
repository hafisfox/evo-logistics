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
    <div>
      <Header
        title="Agent Directory"
        description="Manage your freight agent contacts"
      />
      <div className="p-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Agents</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {canManage && (
              <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-4">
                <Input
                  value={newAgent.agent_name}
                  onChange={(event) =>
                    setNewAgent((current) => ({
                      ...current,
                      agent_name: event.target.value,
                    }))
                  }
                  placeholder="Agent name"
                  disabled={createMutation.isPending}
                />
                <Input
                  value={newAgent.email}
                  onChange={(event) =>
                    setNewAgent((current) => ({ ...current, email: event.target.value }))
                  }
                  placeholder="Agent email"
                  disabled={createMutation.isPending}
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
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">active</SelectItem>
                    <SelectItem value="inactive">inactive</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={createAgent}
                  disabled={
                    createMutation.isPending ||
                    !newAgent.agent_name.trim() ||
                    !newAgent.email.trim()
                  }
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add Agent
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
              <div className="rounded-md border overflow-x-auto">
                <Table className="min-w-[500px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agent Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agents?.map((agent) => (
                      <TableRow key={agent.email}>
                        <TableCell className="font-medium">
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
                            />
                          ) : (
                            agent.agent_name
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {editingKey === agent.agent_name ? (
                            <Input
                              value={editingAgent?.email ?? ""}
                              onChange={(event) =>
                                setEditingAgent((current) =>
                                  current ? { ...current, email: event.target.value } : current
                                )
                              }
                              disabled={disableManageActions || updateMutation.isPending}
                            />
                          ) : (
                            agent.email
                          )}
                        </TableCell>
                        <TableCell>
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
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="active">active</SelectItem>
                                <SelectItem value="inactive">inactive</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge
                              variant="secondary"
                              className={
                                agent.status === "active"
                                  ? "bg-cyan-500/10 text-cyan-400"
                                  : "bg-white/5 text-slate-400"
                              }
                            >
                              {agent.status}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {!canManage ? (
                            <span className="text-xs text-muted-foreground">Owner/Admin only</span>
                          ) : editingKey === agent.agent_name ? (
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                onClick={saveAgent}
                                disabled={updateMutation.isPending || disableManageActions}
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={cancelEditing}
                                disabled={updateMutation.isPending}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-2">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() =>
                                  startEditing({
                                    agent_name: agent.agent_name,
                                    email: agent.email,
                                    status: agent.status,
                                  })
                                }
                                disabled={disableManageActions}
                                aria-label={`Edit ${agent.agent_name}`}
                                title={`Edit ${agent.agent_name}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => deleteAgent(agent.agent_name)}
                                disabled={disableManageActions || deleteMutation.isPending}
                                aria-label={`Delete ${agent.agent_name}`}
                                title={`Delete ${agent.agent_name}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
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
                          className="text-center text-muted-foreground py-8"
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
    </div>
  );
}
