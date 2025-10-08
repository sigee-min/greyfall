export type PlanOutput = {
  action: string;
  checks?: string[];
  hazards?: string[];
  targets?: string[];
  item?: string;
  meta?: { reason?: string };
};

export type PlanValidation = {
  ok: boolean;
  fixed?: PlanOutput;
  error?: string;
};

