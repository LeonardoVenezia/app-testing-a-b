import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool as any);
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.store.create({
    data: {
      user_id: 12345,
      access_token: "test_token"
    }
  });
  console.log("Store created");
}

main().catch(console.error).finally(() => prisma.$disconnect());
