import abTestRepository from "./ab-test.repository";
import { ICreateAbTestRequest } from "./ab-test.interfaces";
import { AbTest, TestStatus } from "@prisma/client";
import { tiendanubeApiClient } from "@config";
import { HttpErrorException } from "@utils";

class AbTestService {
  async create(store_id: number, data: ICreateAbTestRequest): Promise<AbTest> {
    // 1. Fetch original product from Tiendanube
    let originalProduct: any;
    try {
      originalProduct = await tiendanubeApiClient.get(
        `${store_id}/products/${data.original_product_id}`
      );
    } catch (e) {
      throw new HttpErrorException("Original product not found in Tiendanube").setStatusCode(404);
    }

    // 2. Clone and modify
    // Remove fields that shouldn't be copied or are auto-generated
    const {
      id,
      created_at,
      updated_at,
      handle,
      permalink,
      variants, // Ignoring variants cloning for the MVP to keep it simple, or we can just send them without IDs
      ...productData
    } = originalProduct as any;

    // Deep clone variants to remove their IDs if they exist
    const clonedVariants = variants ? variants.map((v: any) => {
      const { id, product_id, created_at, updated_at, ...vData } = v;
      return vData;
    }) : [];

    const clonedProduct = {
      ...productData,
      variants: clonedVariants,
      name: data.variant_modifications.name || `${originalProduct.name} (Variant B)`,
      description: data.variant_modifications.description || originalProduct.description,
      tags: originalProduct.tags ? `${originalProduct.tags}, ab-test-variant` : "ab-test-variant",
      published: true, // Needs to be published to be visible to group B
    };

    // 3. Create the variant product in Tiendanube
    let createdVariant: any;
    try {
      createdVariant = await tiendanubeApiClient.post(
        `${store_id}/products`,
        clonedProduct
      );
    } catch (e: any) {
      console.error("Error creating variant product in Tiendanube:", e.response?.data || e.message);
      throw new HttpErrorException("Failed to create variant product in Tiendanube").setStatusCode(500);
    }

    // 4. Persist in database
    const newTest = await abTestRepository.create({
      store_id,
      name: data.name,
      status: TestStatus.ACTIVE,
      original_product_id: data.original_product_id,
      variant_product_id: createdVariant.id,
      original_views: 0,
      variant_views: 0,
      original_sales: 0,
      variant_sales: 0,
    });

    // 5. Register webhooks if not already registered (best effort)
    const appUrl = process.env.APP_URL;
    if (appUrl) {
      try {
        await tiendanubeApiClient.post(`${store_id}/webhooks`, {
          event: "order/created",
          url: `${appUrl}/webhooks/order-created`
        });
        await tiendanubeApiClient.post(`${store_id}/webhooks`, {
          event: "order/cancelled",
          url: `${appUrl}/webhooks/order-cancelled`
        });
      } catch (e: any) {
        // Ignored. Conflicts just mean they are already registered.
      }
    }

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

    // Delete the variant product from Tiendanube API
    try {
      await tiendanubeApiClient.delete(`${store_id}/products/${test.variant_product_id}`);
    } catch (e: any) {
      console.warn("Failed to delete variant product in Tiendanube, it might have been already deleted:", e.message);
    }

    await abTestRepository.delete(test_id);
  }
}

export default new AbTestService();
