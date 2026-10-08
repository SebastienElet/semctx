import { z } from "zod";
import { TaskModeSchema } from "./schemas";
import type { RepositoryNode, RepositoryEdge, EvidenceRecord, EvidenceRef } from "./types/graph";
import type { Claim } from "./types/claim";
import type { TaskFrame } from "./types/task-frame";
import type { ContextPack } from "./types/context-pack";

const NodeKindValues = ["repository", "package", "module", "symbol", "type", "function", "class", "interface", "enum", "test", "migration", "document", "contract", "invariant", "capability", "bounded_context", "decision", "risk", "external_integration"] as const;
export const NodeKindSchema = z.enum(NodeKindValues);
const EdgeKindValues = ["imports", "exports", "calls", "references", "extends", "implements", "declares", "tested_by", "covers", "depends_on", "belongs_to", "implements_capability", "constrained_by", "verifies", "documents", "decides", "changes", "contradicts", "related_to"] as const;
export const EdgeKindSchema = z.enum(EdgeKindValues);
const EvidenceSourceKindValues = ["code", "test", "document", "git", "runtime", "manual"] as const;
export const EvidenceSourceKindSchema = z.enum(EvidenceSourceKindValues);
export const ClaimKindSchema = z.enum(["contract", "invariant", "decision", "capability", "behavior", "risk", "ownership", "deprecation", "assumption"]);
export const VerificationStatusSchema = z.enum(["unverified", "inferred", "documented", "tested", "statically_verified", "runtime_verified", "contradicted", "deprecated"]);
export const QuestionKindSchema = z.enum(["public_api", "persistence", "business_rule", "runtime_behavior", "historical_reason", "style", "security"]);

const StringArraySchema = z.array(z.string());
const UnitIntervalSchema = z.number().finite().min(0).max(1);
// Canonical runtime checks for the persisted graph's non-transforming data format.
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && !(value instanceof Date) && !(value instanceof Map) && !(value instanceof Set)
    && !(value instanceof Promise);
}
function member(options: readonly string[], value: unknown): boolean {
  return typeof value === "string" && options.includes(value);
}
function nonempty(value: unknown): value is string { return typeof value === "string" && value.length > 0; }
function optionalString(value: unknown): value is string | undefined { return value === undefined || typeof value === "string"; }
function optionalLine(value: unknown): value is number | undefined {
  return value === undefined || (typeof value === "number" && Number.isSafeInteger(value) && value > 0);
}
function arrayOf<T>(value: unknown, check: (item: unknown) => item is T): value is T[] {
  if (!Array.isArray(value)) return false;
  // A for-of loop visits sparse slots as undefined rather than silently skipping them.
  for (const item of value) if (!check(item)) return false;
  return true;
}
function string(value: unknown): value is string { return typeof value === "string"; }
function metadata(value: unknown): value is RepositoryNode["metadata"] {
  if (!record(value)) return false;
  for (const key in value) {
    const item = value[key];
    if (typeof item !== "string" && typeof item !== "boolean"
      && !(typeof item === "number" && Number.isFinite(item))) return false;
  }
  return true;
}
function evidenceRef(value: unknown): value is EvidenceRef {
  return record(value) && string(value["filePath"])
    && member(EvidenceSourceKindValues, value["sourceKind"])
    && optionalLine(value["startLine"]) && optionalLine(value["endLine"])
    && optionalString(value["excerpt"]);
}
function evidenceRecord(value: unknown): value is EvidenceRecord {
  return evidenceRef(value) && "id" in value && nonempty(value.id);
}
function repositoryNode(value: unknown): value is RepositoryNode {
  return record(value) && nonempty(value["id"])
    && member(NodeKindValues, value["kind"]) && string(value["name"])
    && optionalString(value["filePath"]) && optionalString(value["boundedContext"])
    && (value["exported"] === undefined || typeof value["exported"] === "boolean")
    && arrayOf(value["evidence"], evidenceRef) && arrayOf(value["tags"], string) && metadata(value["metadata"]);
}
function repositoryEdge(value: unknown): value is RepositoryEdge {
  return record(value) && nonempty(value["id"])
    && member(EdgeKindValues, value["kind"])
    && nonempty(value["from"]) && nonempty(value["to"])
    && arrayOf(value["evidence"], evidenceRef) && metadata(value["metadata"]);
}

export const EvidenceRefSchema = z.custom<EvidenceRef>(evidenceRef);
export const EvidenceRecordSchema = z.custom<EvidenceRecord>(evidenceRecord);
export const RepositoryNodeSchema = z.custom<RepositoryNode>(repositoryNode);
export const RepositoryEdgeSchema = z.custom<RepositoryEdge>(repositoryEdge);
// Only for rows freshly assembled by repository-store from owned SQLite/JSON values.
// These invoke the same canonical predicate; invalid input retains schema diagnostics.
export const OwnedRepositoryNodeRowParser = {
  parse(value: unknown): RepositoryNode {
    return repositoryNode(value) ? value : RepositoryNodeSchema.parse(value);
  },
};
export const OwnedRepositoryEdgeRowParser = {
  parse(value: unknown): RepositoryEdge {
    return repositoryEdge(value) ? value : RepositoryEdgeSchema.parse(value);
  },
};
export const RepositoryGraphSchema = z.object({ nodes: z.array(RepositoryNodeSchema), edges: z.array(RepositoryEdgeSchema) });

export const ClaimSchema = z.object({
  id: z.string().min(1), kind: ClaimKindSchema, statement: z.string(), subjectNodeIds: StringArraySchema, evidenceIds: StringArraySchema,
  authority: UnitIntervalSchema, freshness: UnitIntervalSchema, confidence: UnitIntervalSchema, verificationStatus: VerificationStatusSchema,
  validFrom: z.string().optional(), validUntil: z.string().optional(), tags: StringArraySchema,
}) satisfies z.ZodType<Claim>;

export const TaskFrameSchema = z.object({
  id: z.string(), rawTask: z.string(), mode: TaskModeSchema, capabilities: StringArraySchema,
  observedBehavior: StringArraySchema, expectedBehavior: StringArraySchema, boundedContexts: StringArraySchema,
  hardInvariants: StringArraySchema, softConstraints: StringArraySchema, acceptanceEvidence: StringArraySchema, nonGoals: StringArraySchema, riskSurfaces: StringArraySchema,
  hypotheses: z.array(z.object({
    id: z.string(), statement: z.string(), confidence: UnitIntervalSchema, evidenceIds: StringArraySchema,
    status: z.enum(["unverified", "supported", "rejected"]),
  })),
  createdAt: z.string(),
}) satisfies z.ZodType<TaskFrame>;

export const ContextPackSchema = z.object({
  taskFrame: TaskFrameSchema,
  hardConstraints: z.array(ClaimSchema), authoritativeClaims: z.array(ClaimSchema),
  primaryNodes: z.array(RepositoryNodeSchema), secondaryNodes: z.array(RepositoryNodeSchema),
  impactPaths: z.array(z.object({ nodeIds: StringArraySchema, edgeKinds: z.array(EdgeKindSchema), description: z.string() })),
  relevantTests: z.array(RepositoryNodeSchema), contradictions: z.array(ClaimSchema), unknowns: StringArraySchema,
  recommendedReads: z.array(z.object({
    path: z.string(), reason: z.string(), priority: z.enum(["critical", "high", "medium"]), evidenceIds: StringArraySchema,
  })),
  verificationPlan: z.object({
    steps: z.array(z.object({
      description: z.string(), kind: z.enum(["run_test", "static_check", "manual_review", "reproduce"]),
      command: z.string().optional(), targetNodeIds: StringArraySchema, evidenceIds: StringArraySchema,
    })),
    requiredTests: StringArraySchema, notes: StringArraySchema,
  }),
  generatedAt: z.string(), evidence: z.array(EvidenceRecordSchema),
  priorityExplanations: z.array(z.object({
    targetId: z.string(), targetKind: z.enum(["node", "claim"]), score: z.number().finite(), eligible: z.boolean(),
    roleMatch: z.number().finite(), authority: z.number().finite(), graphReachability: z.number().finite(),
    verificationStrength: z.number().finite(), freshness: z.number().finite(), contradictionPenalty: z.number().finite(),
    gates: z.array(z.object({ name: z.string(), passed: z.boolean(), reason: z.string() })), explanation: StringArraySchema,
  })),
  meta: z.object({
    taskId: z.string(), questionKind: QuestionKindSchema, deterministic: z.boolean(), generator: z.string(),
    candidateProviders: StringArraySchema, warnings: StringArraySchema,
  }),
}) satisfies z.ZodType<ContextPack>;
