export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  sku: string;
  stock: number;
  barcode: string;
  image?: string;
  variants?: { id: string; name: string; sku: string; barcode?: string; price: number; costPrice?: number }[];
}

export interface CartItem extends Product {
  quantity: number;
}
