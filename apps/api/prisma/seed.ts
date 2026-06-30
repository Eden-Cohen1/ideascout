import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Idempotent seed: a demo user with a sample project + idea so a fresh DB is usable. */
async function seed(): Promise<void> {
  const user = await prisma.user.upsert({
    where: { email: 'demo@ideascout.local' },
    update: {},
    create: {
      email: 'demo@ideascout.local',
      displayName: 'Demo Founder',
      // Placeholder — the auth milestone replaces this with a real argon2 hash.
      passwordHash: 'seed-placeholder-not-a-real-hash',
    },
  });

  let project = await prisma.project.findFirst({
    where: { ownerId: user.id, name: 'Demo Project' },
  });
  project ??= await prisma.project.create({
    data: {
      ownerId: user.id,
      name: 'Demo Project',
      description: 'A sample project to explore ideascout.',
    },
  });

  const existing = await prisma.idea.findFirst({
    where: { projectId: project.id, title: 'AI-assisted onboarding for B2B SaaS' },
  });
  if (!existing) {
    const idea = await prisma.idea.create({
      data: { projectId: project.id, title: 'AI-assisted onboarding for B2B SaaS' },
    });
    const version = await prisma.ideaVersion.create({
      data: {
        ideaId: idea.id,
        version: 1,
        problem: 'New B2B SaaS users churn during a slow, manual onboarding.',
        solution: 'An AI copilot that configures the product for each customer automatically.',
        targetCustomer: 'Mid-market B2B SaaS teams',
      },
    });
    await prisma.idea.update({
      where: { id: idea.id },
      data: { currentVersionId: version.id },
    });
  }

  console.log(`Seed complete: user=${user.email}, project="${project.name}"`);
}

seed()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
