
import { createPrisma, daysFromNow, DEMO_IDS, resetDemoData } from "./demo-data.mjs";
const prisma = createPrisma();

async function main() {
  const ownerEmail = process.env.DEMO_OWNER_EMAIL?.trim().toLowerCase();
  if (!ownerEmail) throw new Error('$env:DEMO_OWNER_EMAIL="sajat@email.hu" beállítása szükséges.');

  const owner = await prisma.user.findUnique({ where:{ email:ownerEmail } });
  if (!owner) throw new Error(`Nincs ProjectFlow User ehhez az emailhez: ${ownerEmail}`);

  await resetDemoData(prisma);

  const demoUsers = [
    {id:DEMO_IDS.admin,name:"Dóra Admin",email:"demo.admin@projectflow.demo"},
    {id:DEMO_IDS.pm,name:"Péter Projektvezető",email:"demo.pm@projectflow.demo"},
    {id:DEMO_IDS.member,name:"Márk Fejlesztő",email:"demo.member@projectflow.demo"},
    {id:DEMO_IDS.contractor,name:"Kata Alvállalkozó",email:"demo.contractor@projectflow.demo"},
    {id:DEMO_IDS.clientUser,name:"Anna Ügyfél",email:"demo.client@projectflow.demo"},
  ];
  for (const u of demoUsers) await prisma.user.create({data:u});

  await prisma.organization.create({data:{
    id:DEMO_IDS.organization,name:"ProjectFlow Demo Studio",
    members:{create:[
      {userId:owner.id,role:"OWNER"},
      {userId:DEMO_IDS.admin,role:"ADMIN"},
      {userId:DEMO_IDS.pm,role:"PROJECT_MANAGER"},
      {userId:DEMO_IDS.member,role:"MEMBER"},
      {userId:DEMO_IDS.contractor,role:"CONTRACTOR"},
      {userId:DEMO_IDS.clientUser,role:"CLIENT"},
    ]}
  }});

  await prisma.client.create({data:{
    id:DEMO_IDS.clientGreen,name:"GreenLeaf Kft.",organizationId:DEMO_IDS.organization,
    contacts:{create:[
      {id:DEMO_IDS.contactGreen,userId:DEMO_IDS.clientUser,name:"Anna Ügyfél",email:"demo.client@projectflow.demo",position:"Marketingvezető"},
      {id:DEMO_IDS.contactGreen2,name:"Bence Kapcsolattartó",email:"bence@greenleaf.demo",position:"Ügyvezető"},
    ]}
  }});
  await prisma.client.create({data:{
    id:DEMO_IDS.clientBlue,name:"BluePeak Studio",organizationId:DEMO_IDS.organization,
    contacts:{create:{id:DEMO_IDS.contactBlue,name:"Júlia Kapcsolattartó",email:"julia@bluepeak.demo",position:"Projektkoordinátor"}}
  }});

  await prisma.project.create({data:{
    id:DEMO_IDS.projectGreen,name:"GreenLeaf – új weboldal",
    description:"Bemutató projekt teljes Kanban, ügyfélkommunikáció és jóváhagyási folyamattal.",
    status:"ACTIVE",priority:"HIGH",progress:17,startDate:daysFromNow(-21),dueDate:daysFromNow(35),
    clientId:DEMO_IDS.clientGreen,ownerId:DEMO_IDS.pm,organizationId:DEMO_IDS.organization,
    members:{create:[
      {userId:DEMO_IDS.pm,role:"PROJECT_MANAGER"},
      {userId:DEMO_IDS.member,role:"MEMBER"},
      {userId:DEMO_IDS.contractor,role:"CONTRACTOR"},
    ]},
    clientContacts:{create:[
      {clientContactId:DEMO_IDS.contactGreen,isPrimary:true},
      {clientContactId:DEMO_IDS.contactGreen2,isPrimary:false},
    ]},
    milestones:{create:[
      {id:DEMO_IDS.milestone1,name:"Tervezés lezárása",status:"COMPLETED",dueDate:daysFromNow(-7)},
      {id:DEMO_IDS.milestone2,name:"Éles indulás",status:"IN_PROGRESS",dueDate:daysFromNow(30)},
    ]}
  }});

  await prisma.project.create({data:{
    id:DEMO_IDS.projectBlue,name:"BluePeak – ügyfélportál",
    description:"Második minta projekt a projekt-specifikus hozzáférés bemutatására.",
    status:"PLANNING",priority:"MEDIUM",progress:0,startDate:daysFromNow(5),dueDate:daysFromNow(65),
    clientId:DEMO_IDS.clientBlue,ownerId:owner.id,organizationId:DEMO_IDS.organization,
    members:{create:{userId:owner.id,role:"PROJECT_MANAGER"}}
  }});

  const tasks = [
    [DEMO_IDS.taskTodo,"Kapcsolati oldal tartalmának véglegesítése","TODO","MEDIUM",true,DEMO_IDS.member],
    [DEMO_IDS.taskProgress,"Reszponzív frontend implementáció","IN_PROGRESS","HIGH",false,DEMO_IDS.member],
    [DEMO_IDS.taskReview,"Kapcsolati űrlap backend","REVIEW","HIGH",false,DEMO_IDS.contractor],
    [DEMO_IDS.taskApproval,"Kezdőoldal vizuális jóváhagyása","AWAITING_APPROVAL","URGENT",true,DEMO_IDS.member],
    [DEMO_IDS.taskBlocked,"Analitika bekötése","BLOCKED","LOW",true,DEMO_IDS.contractor],
    [DEMO_IDS.taskDone,"Wireframe-ek elkészítése","DONE","MEDIUM",true,DEMO_IDS.pm],
  ];
  for (const [id,title,status,priority,clientVisible,assigneeId] of tasks) {
    await prisma.task.create({data:{
      id,title,status,priority,clientVisible,assigneeId,
      requiresApproval:id===DEMO_IDS.taskApproval,
      projectId:DEMO_IDS.projectGreen,creatorId:DEMO_IDS.pm,
      milestoneId: status==="DONE" ? DEMO_IDS.milestone1 : DEMO_IDS.milestone2,
      dueDate:daysFromNow(status==="DONE"?-10:10),
    }});
  }

  await prisma.taskComment.createMany({data:[
    {taskId:DEMO_IDS.taskApproval,authorId:DEMO_IDS.pm,content:"A legutóbbi módosítások elkészültek, kérjük az ügyfél jóváhagyását.",visibility:"CLIENT_VISIBLE"},
    {taskId:DEMO_IDS.taskApproval,authorId:DEMO_IDS.member,content:"Belső megjegyzés: a mobil fejlécet még érdemes figyelni.",visibility:"INTERNAL"},
    {taskId:DEMO_IDS.taskBlocked,authorId:DEMO_IDS.clientUser,content:"Az analitikai hozzáférést várhatóan holnap küldjük.",visibility:"CLIENT_VISIBLE"},
  ]});
  await prisma.taskApproval.create({data:{taskId:DEMO_IDS.taskApproval,approverId:DEMO_IDS.clientUser,decision:"PENDING"}});
  await prisma.activityLog.createMany({data:[
    {projectId:DEMO_IDS.projectGreen,userId:DEMO_IDS.pm,action:"DEMO_PROJECT_CREATED",entityType:"Project",entityId:DEMO_IDS.projectGreen,message:"A bemutató projekt létrejött.",clientVisible:true},
    {projectId:DEMO_IDS.projectGreen,taskId:DEMO_IDS.taskApproval,userId:DEMO_IDS.pm,action:"TASK_APPROVAL_REQUESTED",entityType:"Task",entityId:DEMO_IDS.taskApproval,message:"A kezdőoldal vizuális jóváhagyása feladat jóváhagyásra vár.",clientVisible:true},
  ]});

  console.log("Demo seed kész.");
  console.log(`OWNER: ${owner.name} <${owner.email}>`);
  console.log("Szervezet: ProjectFlow Demo Studio");
}

main().catch(e=>{console.error("Demo seed hiba:",e);process.exitCode=1;})
.finally(async()=>{await prisma.$disconnect();});
