
import { createPrisma, resetDemoData } from "./demo-data.mjs";
const prisma = createPrisma();

async function main() {
  await resetDemoData(prisma);
  console.log("Demo reset kész. Csak a fix demo UUID-k rekordjai lettek törölve.");
}

main().catch(e=>{console.error("Demo reset hiba:",e);process.exitCode=1;})
.finally(async()=>{await prisma.$disconnect();});
