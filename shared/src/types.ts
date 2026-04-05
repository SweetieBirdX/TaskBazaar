export interface Agent {
  agentId: string;
  owner: string;
  endpoint: string;
  category: string;
  pricePerCall: number; // in stroops (USDC 7 decimals)
  stakeAmount: number;
  faultScore: number;
  status: "Active" | "Suspended";
  registeredAt: number;
}

export interface Escrow {
  taskId: string;
  orchestrator: string;
  agentId: string;
  amount: number;
  deadline: number;
  released: boolean;
}

export interface TaskRequest {
  goal: string;
  maxBudget: number; // in USDC (e.g. 0.50)
}

export interface PlanStep {
  agentId: string;
  category: string;
  estimatedCost: number; // in USDC
  endpoint: string;
}

export interface TaskPlan {
  steps: PlanStep[];
  totalCost: number;
  orchestratorFee: number;
  budget: number;
}

export type LiveEventType =
  | "planning"
  | "escrow_created"
  | "payment_sent"
  | "escrow_released"
  | "agent_response"
  | "task_complete"
  | "error";

export interface LiveEvent {
  type: LiveEventType;
  data: any;
  timestamp: number;
  taskId: string;
}

export interface BudgetSummary {
  totalBudget: number;
  totalSpent: number;
  orchestratorFee: number;
  transactions: { agentId: string; amount: number; txHash: string }[];
}

export interface TaskResult {
  taskId: string;
  report: string;
  budgetSummary: BudgetSummary;
  events: LiveEvent[];
}
