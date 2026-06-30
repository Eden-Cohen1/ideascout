-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "IdeaLifecycleState" AS ENUM ('IDEA', 'RESEARCH', 'REFINE', 'VALIDATE', 'DECISION');

-- CreateEnum
CREATE TYPE "ResearchRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ResearchStep" AS ENUM ('DECOMPOSE', 'MARKET_RESEARCH', 'COMPETITOR_DISCOVERY', 'MOAT_ANALYSIS', 'VERDICT');

-- CreateEnum
CREATE TYPE "Verdict" AS ENUM ('GO', 'NO_GO', 'CONDITIONAL_GO');

-- CreateEnum
CREATE TYPE "ArtifactKind" AS ENUM ('SEARCH_RESULTS', 'FETCHED_PAGE', 'LLM_RAW', 'VERDICT', 'COMPETITOR_MAP', 'MOAT');

-- CreateEnum
CREATE TYPE "RefinementRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "CredentialScope" AS ENUM ('GLOBAL', 'PROJECT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "llmProvider" TEXT,
    "llmModel" TEXT,
    "researchProvider" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Idea" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "state" "IdeaLifecycleState" NOT NULL DEFAULT 'IDEA',
    "currentVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Idea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdeaVersion" (
    "id" TEXT NOT NULL,
    "ideaId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "problem" TEXT NOT NULL,
    "solution" TEXT NOT NULL,
    "targetCustomer" TEXT,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdeaVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchRun" (
    "id" TEXT NOT NULL,
    "ideaId" TEXT NOT NULL,
    "ideaVersionId" TEXT NOT NULL,
    "status" "ResearchRunStatus" NOT NULL DEFAULT 'QUEUED',
    "currentStep" "ResearchStep",
    "progress" INTEGER NOT NULL DEFAULT 0,
    "llmProvider" TEXT NOT NULL,
    "llmModel" TEXT NOT NULL,
    "researchProvider" TEXT NOT NULL,
    "jobId" TEXT,
    "error" TEXT,
    "verdict" "Verdict",
    "verdictScore" INTEGER,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchArtifact" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "step" "ResearchStep" NOT NULL,
    "kind" "ArtifactKind" NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Competitor" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "product" TEXT NOT NULL,
    "customer" TEXT NOT NULL,
    "positioning" TEXT,
    "pricingNotes" TEXT,
    "strengths" JSONB NOT NULL DEFAULT '[]',
    "weaknesses" JSONB NOT NULL DEFAULT '[]',
    "citations" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Competitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoatAnalysis" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "defensibilityScore" INTEGER NOT NULL,
    "dimensions" JSONB NOT NULL DEFAULT '[]',
    "risks" JSONB NOT NULL DEFAULT '[]',
    "citations" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MoatAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefinementMessage" (
    "id" TEXT NOT NULL,
    "ideaId" TEXT NOT NULL,
    "role" "RefinementRole" NOT NULL,
    "content" TEXT NOT NULL,
    "proposedPatch" JSONB,
    "appliedVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefinementMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderCredential" (
    "id" TEXT NOT NULL,
    "scope" "CredentialScope" NOT NULL,
    "ownerId" TEXT,
    "projectId" TEXT,
    "providerId" TEXT NOT NULL,
    "ciphertext" BYTEA NOT NULL,
    "iv" BYTEA NOT NULL,
    "authTag" BYTEA NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Project_ownerId_idx" ON "Project"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Idea_currentVersionId_key" ON "Idea"("currentVersionId");

-- CreateIndex
CREATE INDEX "Idea_projectId_idx" ON "Idea"("projectId");

-- CreateIndex
CREATE INDEX "IdeaVersion_ideaId_idx" ON "IdeaVersion"("ideaId");

-- CreateIndex
CREATE UNIQUE INDEX "IdeaVersion_ideaId_version_key" ON "IdeaVersion"("ideaId", "version");

-- CreateIndex
CREATE INDEX "ResearchRun_ideaId_idx" ON "ResearchRun"("ideaId");

-- CreateIndex
CREATE INDEX "ResearchRun_status_idx" ON "ResearchRun"("status");

-- CreateIndex
CREATE INDEX "ResearchArtifact_runId_step_idx" ON "ResearchArtifact"("runId", "step");

-- CreateIndex
CREATE INDEX "Competitor_runId_idx" ON "Competitor"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "MoatAnalysis_runId_key" ON "MoatAnalysis"("runId");

-- CreateIndex
CREATE INDEX "RefinementMessage_ideaId_idx" ON "RefinementMessage"("ideaId");

-- CreateIndex
CREATE INDEX "ProviderCredential_providerId_idx" ON "ProviderCredential"("providerId");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderCredential_scope_projectId_providerId_key" ON "ProviderCredential"("scope", "projectId", "providerId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Idea" ADD CONSTRAINT "Idea_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Idea" ADD CONSTRAINT "Idea_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "IdeaVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdeaVersion" ADD CONSTRAINT "IdeaVersion_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "Idea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchRun" ADD CONSTRAINT "ResearchRun_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "Idea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchRun" ADD CONSTRAINT "ResearchRun_ideaVersionId_fkey" FOREIGN KEY ("ideaVersionId") REFERENCES "IdeaVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchArtifact" ADD CONSTRAINT "ResearchArtifact_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ResearchRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Competitor" ADD CONSTRAINT "Competitor_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ResearchRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoatAnalysis" ADD CONSTRAINT "MoatAnalysis_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ResearchRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefinementMessage" ADD CONSTRAINT "RefinementMessage_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "Idea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderCredential" ADD CONSTRAINT "ProviderCredential_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderCredential" ADD CONSTRAINT "ProviderCredential_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

