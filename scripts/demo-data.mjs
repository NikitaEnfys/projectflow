
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

export const DEMO_IDS = {
  organization:"00000000-0000-4000-8000-000000000901",
  clientGreen:"00000000-0000-4000-8000-000000000911",
  clientBlue:"00000000-0000-4000-8000-000000000912",
  projectGreen:"00000000-0000-4000-8000-000000000921",
  projectBlue:"00000000-0000-4000-8000-000000000922",
  admin:"00000000-0000-4000-8000-000000000931",
  pm:"00000000-0000-4000-8000-000000000932",
  member:"00000000-0000-4000-8000-000000000933",
  contractor:"00000000-0000-4000-8000-000000000934",
  clientUser:"00000000-0000-4000-8000-000000000935",
  contactGreen:"00000000-0000-4000-8000-000000000941",
  contactGreen2:"00000000-0000-4000-8000-000000000942",
  contactBlue:"00000000-0000-4000-8000-000000000943",
  milestone1:"00000000-0000-4000-8000-000000000951",
  milestone2:"00000000-0000-4000-8000-000000000952",
  taskTodo:"00000000-0000-4000-8000-000000000961",
  taskProgress:"00000000-0000-4000-8000-000000000962",
  taskReview:"00000000-0000-4000-8000-000000000963",
  taskApproval:"00000000-0000-4000-8000-000000000964",
  taskBlocked:"00000000-0000-4000-8000-000000000965",
  taskDone:"00000000-0000-4000-8000-000000000966",
};

export const DEMO_USER_IDS = [
  DEMO_IDS.admin, DEMO_IDS.pm, DEMO_IDS.member,
  DEMO_IDS.contractor, DEMO_IDS.clientUser,
];

export function createPrisma() {
  if (!process.env.DATABASE_URL) throw new Error("Hiányzik a DATABASE_URL.");
  if (process.env.NODE_ENV === "production") {
    throw new Error("Demo seed/reset production környezetben nem futtatható.");
  }
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export async function resetDemoData(prisma) {
  await prisma.project.deleteMany({ where:{ id:{ in:[DEMO_IDS.projectGreen, DEMO_IDS.projectBlue] } } });
  await prisma.client.deleteMany({ where:{ id:{ in:[DEMO_IDS.clientGreen, DEMO_IDS.clientBlue] } } });
  await prisma.organization.deleteMany({ where:{ id:DEMO_IDS.organization } });
  await prisma.user.deleteMany({ where:{ id:{ in:DEMO_USER_IDS } } });
}

export function daysFromNow(days) {
  const d = new Date();
  d.setHours(12,0,0,0);
  d.setDate(d.getDate()+days);
  return d;
}
