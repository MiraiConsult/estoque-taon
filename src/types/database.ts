export interface Casa {
  id: string;
  name: string;
  created_at: string;
}

export interface Insumo {
  id: string;
  code: string;
  name: string;
  unit: string;
  package_qty: number;
  package_price: number;
  unit_cost: number;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  type: 'drink' | 'product';
  sale_price: number;
  cost: number;
  markup: number;
  margin: number;
  casa_id: string;
  casa?: Casa;
  created_at: string;
}

export interface DrinkRecipe {
  id: string;
  product_id: string;
  product?: Product;
  created_at: string;
}

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  insumo_id: string;
  insumo?: Insumo;
  quantity: number;
  unit: string;
  ingredient_cost: number;
}

export interface StockItem {
  id: string;
  casa_id: string;
  casa?: Casa;
  product_id: string | null;
  insumo_id: string | null;
  product?: Product;
  insumo?: Insumo;
  quantity: number;
  minimum: number;
  unit: string;
  updated_at: string;
}

export interface StockMovement {
  id: string;
  casa_id: string;
  casa?: Casa;
  product_id: string | null;
  insumo_id: string | null;
  product?: Product;
  insumo?: Insumo;
  movement_type: 'entrada' | 'saida' | 'transferencia' | 'ajuste' | 'venda';
  quantity: number;
  reference: string | null;
  notes: string | null;
  created_at: string;
}

export interface Transfer {
  id: string;
  from_casa_id: string;
  to_casa_id: string;
  from_casa?: Casa;
  to_casa?: Casa;
  product_id: string | null;
  insumo_id: string | null;
  product?: Product;
  insumo?: Insumo;
  quantity: number;
  notes: string | null;
  created_at: string;
}

export interface Sale {
  id: string;
  casa_id: string;
  casa?: Casa;
  event_date: string;
  event_name: string | null;
  product_id: string;
  product?: Product;
  quantity: number;
  total_value: number;
  ticket_medio: number;
  created_at: string;
}

export interface SaleImport {
  id: string;
  casa_id: string;
  event_date: string;
  event_name: string | null;
  file_name: string;
  total_items: number;
  total_value: number;
  created_at: string;
}
