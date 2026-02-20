export interface Agent {
  agent_name: string;
  email: string;
  status: "active" | "inactive";
}

export interface AgentWithMetrics extends Agent {
  total_rfqs_sent: number;
  total_quotes_received: number;
  response_rate: number;
  average_price: number | null;
  win_count: number;
  win_rate: number;
}
