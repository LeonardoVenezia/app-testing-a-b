import abTestRepository from "./ab-test.repository";
import { ICreateAbTestRequest } from "./ab-test.interfaces";
import { AbTest, TestStatus } from "@prisma/client";
import { tiendanubeApiClient } from "@config";
import { HttpErrorException } from "@utils";

class AbTestService {
  async create(store_id: number, data: ICreateAbTestRequest): Promise<AbTest> {
    // 0. Check no active test exists for this product
    const existing = await abTestRepository.findActiveByProductId(store_id, data.original_product_id);
    if (existing) {
      throw new HttpErrorException("Ya existe un test activo para este producto").setStatusCode(409);
    }

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

    // Deep clone variants to remove their IDs if they exist.
    // If a price override was provided, apply it to every variant.
    const clonedVariants = variants ? variants.map((v: any) => {
      const { id, product_id, created_at, updated_at, ...vData } = v;
      if (data.variant_modifications.price !== undefined && data.variant_modifications.price !== '') {
        vData.price = data.variant_modifications.price;
      }
      if (data.variant_modifications.promotional_price !== undefined) {
        vData.promotional_price = data.variant_modifications.promotional_price || null;
      }
      return vData;
    }) : [];

    // Build the cloned product payload
    const clonedProduct: any = {
      ...productData,
      variants: clonedVariants,
      name: data.variant_modifications.name || `${originalProduct.name} (Variant B)`,
      description: data.variant_modifications.description || originalProduct.description,
      tags: originalProduct.tags ? `${originalProduct.tags}, ab-test-variant` : "ab-test-variant",
      published: true, // Needs to be published to be visible to group B
      ...(data.variant_modifications.video_url !== undefined && { video_url: data.variant_modifications.video_url })
    };

    // If image overrides were provided replace the images array entirely;
    // otherwise the spread from productData already copied the originals.
    if (data.variant_modifications.images && data.variant_modifications.images.length > 0) {
      clonedProduct.images = data.variant_modifications.images;
    }

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
      original_revenue: 0,
      variant_revenue: 0,
      deleted_at: null,
    });

    return newTest;
  }

  async findAll(store_id: number) {
    const tests = await abTestRepository.findAllByStore(store_id);
    return this.enrichWithProductData(store_id, tests);
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
    const test = await abTestRepository.findOne(store_id, test_id);

    // When reactivating, check no other active test exists for this product
    if (status === TestStatus.ACTIVE) {
      const existing = await abTestRepository.findActiveByProductId(store_id, test.original_product_id);
      if (existing && existing.id !== test_id) {
        throw new HttpErrorException("Ya existe otro test activo para este producto").setStatusCode(409);
      }
    }

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

    await abTestRepository.softDelete(test_id);
  }

  async findDeleted(store_id: number) {
    const tests = await abTestRepository.findDeletedByStore(store_id);
    return this.enrichWithProductData(store_id, tests);
  }

  private async enrichWithProductData(store_id: number, tests: AbTest[]) {
    const productIds = [...new Set(tests.map(t => t.original_product_id))];
    const productMap = new Map<number, { image_url: string; product_name: string }>();

    await Promise.allSettled(
      productIds.map(async (pid) => {
        try {
          const product: any = await tiendanubeApiClient.get(`${store_id}/products/${pid}`);
          const name = product.name?.es || product.name?.pt || product.name?.en || '';
          const image = product.images?.[0]?.src || '';
          productMap.set(pid, { image_url: image, product_name: name });
        } catch { /* product may have been deleted */ }
      })
    );

    return tests.map(t => ({
      ...t,
      product_image_url: productMap.get(t.original_product_id)?.image_url || '',
      product_name: productMap.get(t.original_product_id)?.product_name || '',
    }));
  }
}

export default new AbTestService();
