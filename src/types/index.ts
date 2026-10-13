export interface Product {
  id: string;
  productId?: string;
  variantId?: string;
  name: string;
  category: string;
  categoryId?: string;
  brandId?: string;
  supplierId?: string;
  costPrice?: number;
  price: number;
  sku: string;
  stock?: number;
  baseUnitName?: string | null;
  baseUnitVariantId?: string | null;
  barcode: string;
  inventories?: { quantity: number; reservedQty?: number; reorderPoint?: number; reorderQty?: number; lot?: { number: string; expiryDate?: string | null; manufacturingDate?: string | null } | null }[];
  image?: string;
  imageUrl?: string;
  variants?: { id: string; name: string; sku: string; barcode?: string; price: number; costPrice?: number; stock?: number; availableStock?: number; unitFactor?: number }[];
  // Medicine / Pharmacy fields
  genericName?: string;
  activeIngredient?: string;
  strength?: string;
  dosageForm?: string;
  manufacturer?: string;
  registrationNumber?: string;
}

export interface CartItem extends Product {
  quantity: number;
  productId?: string;
  variantId?: string;
}
