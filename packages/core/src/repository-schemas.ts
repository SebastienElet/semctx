import { z } from "zod";
import { TaskModeSchema } from "./schemas";
import type { RepositoryNode, RepositoryEdge, EvidenceRecord } from "./types/graph";
import type { Claim } from "./types/claim";
import type { TaskFrame } from "./types/task-frame";
import type { ContextPack } from "./types/context-pack";

export const NodeKindSchema = z.enum(["repository", "package", "module", "symbol", "type", "function", "class", "interface", "enum", "test", "migration", "document", "contract", "invariant", "capability", "bounded_context", "decision", "risk", "external_integration"]);
export const EdgeKindSchema = z.enum(["imports", "exports", "calls", "references", "extends", "implements", "declares", "tested_by", "covers", "depends_on", "belongs_to", "implements_capability", "constrained_by", "verifies", "documents", "decides", "changes", "contradicts", "related_to"]);
export const EvidenceSourceKindSchema = z.enum(["code", "test", "document", "git", "runtime", "manual"]);
export const ClaimKindSchema = z.enum(["contract", "invariant", "decision", "capability", "behavior", "risk", "ownership", "deprecation", "assumption"]);
export const VerificationStatusSchema = z.enum(["unverified", "inferred", "documented", "tested", "statically_verified", "runtime_verified", "contradicted", "deprecated"]);
export const QuestionKindSchema = z.enum(["public_api", "persistence", "business_rule", "runtime_behavior", "historical_reason", "style", "security"]);

const StringArraySchema = z.array(z.string());
const UnitIntervalSchema = z.number().finite().min(0).max(1);
const LineNumberSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const MetadataSchema = z.record(z.union([z.string(), z.number().finite(), z.boolean()]));

export const EvidenceRefSchema = z.object({
  filePath: z.string(),
  startLine: LineNumberSchema.optional(),
  endLine: LineNumberSchema.optional(),
  sourceKind: EvidenceSourceKindSchema,
  excerpt: z.string().optional(),
});
export const EvidenceRecordSchema = EvidenceRefSchema.extend({ id: z.string().min(1) }) satisfies z.ZodType<EvidenceRecord>;

export const RepositoryNodeSchema = z.object({
  id: z.string().min(1), kind: NodeKindSchema, name: z.string(),
  filePath: z.string().optional(), boundedContext: z.string().optional(), exported: z.boolean().optional(),
  evidence: z.array(EvidenceRefSchema), tags: StringArraySchema, metadata: MetadataSchema,
}) satisfies z.ZodType<RepositoryNode>;
export const RepositoryEdgeSchema = z.object({
  id: z.string().min(1), kind: EdgeKindSchema, from: z.string().min(1), to: z.string().min(1),
  evidence: z.array(EvidenceRefSchema), metadata: MetadataSchema,
}) satisfies z.ZodType<RepositoryEdge>;
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
