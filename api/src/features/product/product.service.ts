import { generateProductMock } from "@features/product/__mock__/product.mock";
import { tiendanubeApiClient } from "@config";
import { IProductRequest, IProductResponse } from "@features/product";
import prisma from "../../config/prisma";

class ProductService {
  async create(user_id: number): Promise<IProductResponse> {
    const randomProduct: IProductRequest = generateProductMock();
    const data: IProductResponse = await tiendanubeApiClient.post(
      `${user_id}/products`,
      randomProduct
    );

    return {
      id: data.id,
      ...randomProduct,
    } as IProductResponse;
  }

  async delete(user_id: number, productId: string): Promise<any> {
    return await tiendanubeApiClient.delete(`${user_id}/products/${productId}`);
  }

  async findAll(user_id: number): Promise<IProductResponse[]> {
    const [products, variantIds] = await Promise.all([
      this.findAllFromApi(user_id),
      this.getKnownVariantProductIds(user_id),
    ]);
    // Hide products created by the app as A/B variants. Identified by either
    // being referenced as variant_product_id in our DB (any status, including
    // soft-deleted) or by carrying the `ab-test-variant` tag we set on creation.
    return products.filter((p: any) => {
      const idNum = Number(p.id);
      if (!Number.isNaN(idNum) && variantIds.has(idNum)) return false;
      if (this.hasVariantTag(p.tags)) return false;
      return true;
    });
  }

  private hasVariantTag(rawTags: unknown): boolean {
    // Tiendanube returns tags as CSV string ("tag1, tag2"), but some endpoints
    // / API versions return them as an array. Handle both.
    const tagList: string[] = Array.isArray(rawTags)
      ? rawTags.map((t) => String(t))
      : typeof rawTags === "string"
        ? rawTags.split(",")
        : [];
    return tagList.map((t) => t.trim().toLowerCase()).includes("ab-test-variant");
  }

  async findAllCount(user_id: number): Promise<{ total: number }> {
    return {
      total: (await this.findAll(user_id)).length,
    };
  }

  private async findAllFromApi(user_id: number): Promise<IProductResponse[]> {
    return (await tiendanubeApiClient.get(
      `${user_id}/products`
    )) as IProductResponse[];
  }

  private async getKnownVariantProductIds(store_id: number): Promise<Set<number>> {
    const rows = await prisma.abTest.findMany({
      where: { store_id },
      select: { variant_product_id: true },
    });
    return new Set(rows.map((r) => r.variant_product_id));
  }
}

export default new ProductService();
