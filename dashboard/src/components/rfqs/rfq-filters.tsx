"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KANBAN_COLUMNS } from "@/lib/constants";
import { Search } from "lucide-react";

interface RFQFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  serviceFilter: string;
  onServiceFilterChange: (value: string) => void;
}

export function RFQFilters({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  serviceFilter,
  onServiceFilterChange,
}: RFQFiltersProps) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search RFQ ID, customer email, route..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
      <Select value={statusFilter} onValueChange={onStatusFilterChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All Statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          {KANBAN_COLUMNS.map((s) => (
            <SelectItem key={s} value={s}>
              {s.replace(/_/g, " ")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={serviceFilter} onValueChange={onServiceFilterChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All Services" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Services</SelectItem>
          <SelectItem value="port-to-port">Port to Port</SelectItem>
          <SelectItem value="door-to-port">Door to Port</SelectItem>
          <SelectItem value="port-to-door">Port to Door</SelectItem>
          <SelectItem value="door-to-door">Door to Door</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
