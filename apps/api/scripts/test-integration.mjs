import { spawnSync } from "node:child_process";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const normalDatabaseUrl = process.env.DATABASE_URL;

if (!testDatabaseUrl) {
  console.error(["", "TEST_DATABASE_URL nincs beállítva.", "", "Az integration tesztek szándékosan nem futnak a normál DATABASE_URL adatbázison.", "Állíts be külön teszt PostgreSQL adatbázist.", ""].join("\n"));
  process.exit(1);
}

if (normalDatabaseUrl && testDatabaseUrl === normalDatabaseUrl) {
  console.error(["", "BIZTONSÁGI LEÁLLÍTÁS:", "TEST_DATABASE_URL és DATABASE_URL azonos.", "Az integration teszt külön adatbázist igényel.", ""].join("\n"));
  process.exit(1);
}

function run(command, args, extraEnv = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, NODE_ENV: "test", TEST_DATABASE_URL: testDatabaseUrl, ...extraEnv },
  });

  if (result.error) {
    console.error("\nNem sikerült elindítani a tesztfolyamatot:", result.error);
    process.exit(1);
  }
  if (result.signal) {
    console.error(`\nA tesztfolyamat megszakadt (${result.signal}).`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`\nA parancs hibakóddal állt le: ${result.status}.`);
    process.exit(result.status ?? 1);
  }
}

console.log("Integration test database schema frissítése...");
run("npx", ["prisma", "migrate", "deploy"], { DATABASE_URL: testDatabaseUrl });

console.log("Adatbázis integration tesztek futtatása...");
run("npx", ["vitest", "run", "tests/integration"]);
