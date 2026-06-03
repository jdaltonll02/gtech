import { create } from 'zustand';
import { api } from '../utils/api';

export interface CartItem {
  id: string;
  product_id: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    price: number;
    original_price?: number;
    discounted_price?: number;
    image_url?: string;
    image_urls?: string[];
    category?: { name: string };
  };
}

export interface CartData {
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
}

interface CartState {
  cart: CartData | null;
  loading: boolean;
  fetchCart: () => Promise<void>;
  addItem: (productId: string, quantity?: number) => Promise<void>;
  updateItem: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearCart: () => void;
}

export const useCartStore = create<CartState>((set) => ({
  cart: null,
  loading: false,

  fetchCart: async () => {
    set({ loading: true });
    try {
      const cart = await api.get<CartData>('/cart');
      set({ cart });
    } catch {
      set({ cart: null });
    } finally {
      set({ loading: false });
    }
  },

  addItem: async (productId, quantity = 1) => {
    const cart = await api.post<CartData>('/cart', { product_id: productId, quantity });
    set({ cart });
  },

  updateItem: async (itemId, quantity) => {
    const cart = await api.patch<CartData>(`/cart/${itemId}`, { quantity });
    set({ cart });
  },

  removeItem: async (itemId) => {
    const cart = await api.delete<CartData>(`/cart/${itemId}`);
    set({ cart });
  },

  clearCart: () => set({ cart: null }),
}));
