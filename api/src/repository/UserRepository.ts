import { PrismaClient, Store } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { TiendanubeAuthInterface } from "@features/auth";
import { HttpErrorException } from "@utils";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool as any);
const prisma = new PrismaClient({ adapter });

class UserRepository {
  async save(credential: TiendanubeAuthInterface): Promise<Store> {
    return this.createOrUpdate(credential);
  }

  async findOne(user_id: number): Promise<Store> {
    const numericUserId = Number(user_id);
    const store = await prisma.store.findUnique({
      where: { user_id: numericUserId },
    });

    if (!store) {
      throw new HttpErrorException(
        "Read our documentation on how to authenticate your app"
      ).setStatusCode(404);
    }

    return store;
  }

  async findFirst(): Promise<Store | null> {
    return prisma.store.findFirst();
  }

  private async createOrUpdate(data: TiendanubeAuthInterface): Promise<Store> {
    const numericUserId = Number(data.user_id);
    return prisma.store.upsert({
      where: { user_id: numericUserId },
      create: {
        user_id: numericUserId,
        access_token: data.access_token,
        token_type: data.token_type,
        scope: data.scope,
        error: data.error,
        error_description: data.error_description,
      },
      update: {
        access_token: data.access_token,
        token_type: data.token_type,
        scope: data.scope,
        error: data.error,
        error_description: data.error_description,
      },
    });
  }
}

export default new UserRepository();
