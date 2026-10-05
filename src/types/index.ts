export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  sku: string;
  stock: number;
  barcode: string;
  image?: string;
}

export interface CartItem extends Product {
  quantity: number;
}
