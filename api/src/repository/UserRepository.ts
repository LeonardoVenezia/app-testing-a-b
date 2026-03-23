import prisma from "../config/prisma";
import { Store } from "@prisma/client";
import { TiendanubeAuthInterface } from "@features/auth";
import { HttpErrorException } from "@utils";

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
