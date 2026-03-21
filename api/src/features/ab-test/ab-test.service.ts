import abTestRepository from "./ab-test.repository";
import { ICreateAbTestRequest } from "./ab-test.interfaces";
import { AbTest, TestStatus } from "@prisma/client";
import { tiendanubeApiClient } from "@config";
import { HttpErrorException } from "@utils";

class AbTestService {
  async create(store_id: number, data: ICreateAbTestRequest): Promise<AbTest> {
    // Phase 3 implementation hook:
    // Here we will fetch the original product, clone it, apply modifications, and create it in Tiendanube.
    // For Phase 2 MVP, we will just mock the variant_product_id.
    
    // MOCK (To be replaced in Phase 3):
    const MOCK_VARIANT_ID = Math.floor(Math.random() * 1000000);

    const newTest = await abTestRepository.create({
      store_id,
      name: data.name,
      status: TestStatus.ACTIVE,
      original_product_id: data.original_product_id,
      variant_product_id: MOCK_VARIANT_ID,
      original_views: 0,
      variant_views: 0,
      original_sales: 0,
      variant_sales: 0,
    });

    return newTest;
  }

  async findAll(store_id: number): Promise<AbTest[]> {
    return abTestRepository.findAllByStore(store_id);
  }

  async findOne(store_id: number, test_id: string): Promise<AbTest> {
    return abTestRepository.findOne(store_id, test_id);
  }

  async updateStatus(
    store_id: number,
    test_id: string,
    status: TestStatus
  ): Promise<AbTest> {
    // Verify ownership first
    await abTestRepository.findOne(store_id, test_id);
    return abTestRepository.updateStatus(test_id, status);
  }

  async delete(store_id: number, test_id: string): Promise<void> {
    // Verify ownership
    const test = await abTestRepository.findOne(store_id, test_id);

    // Phase 3 implementation hook: Delete the variant product from Tiendanube API
    // await tiendanubeApiClient.delete(`${store_id}/products/${test.variant_product_id}`);

    await abTestRepository.delete(test_id);
  }
}

export default new AbTestService();
