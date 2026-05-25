import { z } from "zod";

// Numeric string used by Tiendanube for prices: "1234.56". Empty string is
// allowed for `promotional_price` to clear a previously-set promo.
const priceString = z
  .string()
  .trim()
  .refine((s) => s === "" || /^\d+(\.\d{1,4})?$/.test(s), {
    message: "Price must be a non-negative decimal (max 4 decimals).",
  });

const imageItem = z
  .object({
    src: z.string().url().optional(),
    attachment: z.string().optional(),
    filename: z.string().max(255).optional(),
  })
  .refine((img) => !!img.src || (!!img.attachment && !!img.filename), {
    message: "Each image needs either `src` (URL) or `attachment` + `filename`.",
  });

const variantModifications = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  // Description comes from a rich-text editor; allow generous size but cap it.
  description: z.string().max(50_000).optional(),
  price: priceString.optional(),
  promotional_price: priceString.optional(),
  images: z.array(imageItem).max(50).optional(),
  video_url: z.string().url().max(500).optional().or(z.literal("")),
});

export const createAbTestSchema = z.object({
  name: z
    .string({ message: "El nombre del test es obligatorio." })
    .trim()
    .min(1, "El nombre del test es obligatorio.")
    .max(100, "El nombre no puede superar los 100 caracteres."),
  original_product_id: z
    .number({ message: "original_product_id debe ser numérico." })
    .int()
    .positive(),
  variant_modifications: variantModifications,
});

export type CreateAbTestInput = z.infer<typeof createAbTestSchema>;

export const updateAbTestStatusSchema = z.object({
  status: z.enum(["ACTIVE", "PAUSED", "FINISHED"]),
});

export type UpdateAbTestStatusInput = z.infer<typeof updateAbTestStatusSchema>;
