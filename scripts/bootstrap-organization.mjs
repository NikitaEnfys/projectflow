import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

if (!process.env.DATABASE_URL) {
  console.error("Hiányzik a DATABASE_URL környezeti változó.");
  process.exit(1);
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  let organization = await prisma.organization.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (!organization) {
    organization = await prisma.organization.create({
      data: { name: "ProjectFlow Workspace" },
    });
    console.log(`Létrehozva: ${organization.name}`);
  } else {
    console.log(`Meglévő szervezet használata: ${organization.name}`);
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
  });

  for (const [index, user] of users.entries()) {
    await prisma.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId: organization.id,
          userId: user.id,
        },
      },
      create: {
        organizationId: organization.id,
        userId: user.id,
        role: index === 0 ? "OWNER" : "MEMBER",
      },
      update: {},
    });
  }

  const clients = await prisma.client.updateMany({
    where: { organizationId: null },
    data: { organizationId: organization.id },
  });

  const projects = await prisma.project.updateMany({
    where: { organizationId: null },
    data: { organizationId: organization.id },
  });

  const allProjects = await prisma.project.findMany({
    where: { organizationId: organization.id },
    select: { id: true, ownerId: true },
  });

  for (const project of allProjects) {
    await prisma.projectMember.upsert({
      where: {
        projectId_userId: {
          projectId: project.id,
          userId: project.ownerId,
        },
      },
      create: {
        projectId: project.id,
        userId: project.ownerId,
        role: "PROJECT_MANAGER",
      },
      update: {
        role: "PROJECT_MANAGER",
      },
    });
  }

  console.log(`Felhasználók hozzárendelve: ${users.length}`);
  console.log(`Ügyfelek hozzárendelve: ${clients.count}`);
  console.log(`Projektek hozzárendelve: ${projects.count}`);
  console.log(`Projektvezetői tagságok biztosítva: ${allProjects.length}`);
  console.log("Bootstrap kész.");
}

main()
  .catch((error) => {
    console.error("Bootstrap hiba:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
