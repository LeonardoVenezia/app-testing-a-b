import prisma from "../../config/prisma";
import { AbTest, TestStatus } from "@prisma/client";
import { HttpErrorException } from "@utils";

class AbTestRepository {
  async create(data: Omit<AbTest, "id" | "created_at" | "updated_at">): Promise<AbTest> {
    return prisma.abTest.create({
      data,
    });
  }

  async findAllByStore(store_id: number): Promise<AbTest[]> {
    return prisma.abTest.findMany({
      where: { store_id, deleted_at: null },
      orderBy: { created_at: "desc" },
    });
  }

  async findDeletedByStore(store_id: number): Promise<AbTest[]> {
    return prisma.abTest.findMany({
      where: { store_id, deleted_at: { not: null } },
      orderBy: { deleted_at: "desc" },
    });
  }

  async findOne(store_id: number, test_id: string): Promise<AbTest> {
    const test = await prisma.abTest.findFirst({
      where: { id: test_id, store_id },
    });

    if (!test) {
      throw new HttpErrorException("A/B test not found").setStatusCode(404);
    }
    return test;
  }

  async updateStatus(test_id: string, status: TestStatus): Promise<AbTest> {
    return prisma.abTest.update({
      where: { id: test_id },
      data: { status },
    });
  }

  async softDelete(test_id: string): Promise<void> {
    await prisma.abTest.update({
      where: { id: test_id },
      data: { deleted_at: new Date(), status: "FINISHED" },
    });
  }

  async findActiveByProductId(store_id: number, product_id: number): Promise<AbTest | null> {
    return prisma.abTest.findFirst({
      where: {
        store_id,
        status: "ACTIVE",
        deleted_at: null,
        OR: [
          { original_product_id: product_id },
          { variant_product_id: product_id },
        ],
      },
    });
  }

  async findActiveByName(store_id: number, name: string): Promise<AbTest | null> {
    return prisma.abTest.findFirst({
      where: {
        store_id,
        status: "ACTIVE",
        deleted_at: null,
        name: { equals: name.trim(), mode: "insensitive" },
      },
    });
  }
}

export default new AbTestRepository();
