"use client";

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
import { useAgents } from "@/hooks/use-agents";
import { Users } from "lucide-react";

export default function AgentsPage() {
  const { data: agents, isLoading } = useAgents();

  return (
    <div>
      <Header
        title="Agent Directory"
        description="10 fixed China freight agents"
      />
      <div className="p-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Active Agents</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agent Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agents?.map((agent) => (
                      <TableRow key={agent.email}>
                        <TableCell className="font-medium">
                          {agent.agent_name}
                        </TableCell>
                        <TableCell className="text-sm">
                          {agent.email}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={
                              agent.status === "active"
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800"
                            }
                          >
                            {agent.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!agents || agents.length === 0) && (
                      <TableRow>
                        <TableCell
                          colSpan={3}
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
