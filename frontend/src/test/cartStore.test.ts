import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCartStore } from '../app/store/cartStore';

vi.mock('../app/utils/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockCart = {
  items: [
    {
      id: 'item-1',
      product_id: 'prod-1',
      quantity: 2,
      product: { id: 'prod-1', name: 'Test Product', price: 10.0 },
    },
  ],
  subtotal: 20.0,
  tax: 1.6,
  total: 21.6,
};

describe('cartStore', () => {
  beforeEach(() => {
    useCartStore.setState({ cart: null, loading: false });
    vi.clearAllMocks();
  });

  it('starts with null cart and not loading', () => {
    const { cart, loading } = useCartStore.getState();
    expect(cart).toBeNull();
    expect(loading).toBe(false);
  });

  it('fetchCart sets cart on success', async () => {
    const { api } = await import('../app/utils/api');
    vi.mocked(api.get).mockResolvedValue(mockCart);

    await useCartStore.getState().fetchCart();

    expect(useCartStore.getState().cart).toEqual(mockCart);
    expect(useCartStore.getState().loading).toBe(false);
  });

  it('fetchCart sets cart to null on error', async () => {
    const { api } = await import('../app/utils/api');
    vi.mocked(api.get).mockRejectedValue(new Error('Network error'));

    await useCartStore.getState().fetchCart();

    expect(useCartStore.getState().cart).toBeNull();
    expect(useCartStore.getState().loading).toBe(false);
  });

  it('addItem calls POST /cart and updates cart', async () => {
    const { api } = await import('../app/utils/api');
    vi.mocked(api.post).mockResolvedValue(mockCart);

    await useCartStore.getState().addItem('prod-1', 2);

    expect(api.post).toHaveBeenCalledWith('/cart', { product_id: 'prod-1', quantity: 2 });
    expect(useCartStore.getState().cart).toEqual(mockCart);
  });

  it('addItem defaults quantity to 1', async () => {
    const { api } = await import('../app/utils/api');
    vi.mocked(api.post).mockResolvedValue(mockCart);

    await useCartStore.getState().addItem('prod-1');

    expect(api.post).toHaveBeenCalledWith('/cart', { product_id: 'prod-1', quantity: 1 });
  });

  it('updateItem calls PATCH /cart/:id and updates cart', async () => {
    const updatedCart = { ...mockCart, items: [{ ...mockCart.items[0], quantity: 5 }] };
    const { api } = await import('../app/utils/api');
    vi.mocked(api.patch).mockResolvedValue(updatedCart);

    await useCartStore.getState().updateItem('item-1', 5);

    expect(api.patch).toHaveBeenCalledWith('/cart/item-1', { quantity: 5 });
    expect(useCartStore.getState().cart?.items[0].quantity).toBe(5);
  });

  it('removeItem calls DELETE /cart/:id and updates cart', async () => {
    const emptyCart = { items: [], subtotal: 0, tax: 0, total: 0 };
    const { api } = await import('../app/utils/api');
    vi.mocked(api.delete).mockResolvedValue(emptyCart);

    await useCartStore.getState().removeItem('item-1');

    expect(api.delete).toHaveBeenCalledWith('/cart/item-1');
    expect(useCartStore.getState().cart?.items).toHaveLength(0);
  });

  it('clearCart sets cart to null', () => {
    useCartStore.setState({ cart: mockCart });
    useCartStore.getState().clearCart();
    expect(useCartStore.getState().cart).toBeNull();
  });
});
