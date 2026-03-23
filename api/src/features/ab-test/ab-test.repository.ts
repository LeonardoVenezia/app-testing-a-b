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
      where: { store_id },
      orderBy: { created_at: "desc" },
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

  async delete(test_id: string): Promise<void> {
    await prisma.abTest.delete({
      where: { id: test_id },
    });
  }
}

export default new AbTestRepository();
