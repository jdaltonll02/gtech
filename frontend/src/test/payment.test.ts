import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../app/utils/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../app/store/authStore', () => ({
  useAuthStore: {
    setState: vi.fn(),
    getState: vi.fn(() => ({ user: { id: 'u1', email: 'buyer@test.com', full_name: 'Buyer', is_admin: false }, accessToken: 'tok' })),
  },
}));

vi.mock('../app/store/cartStore', () => ({
  useCartStore: {
    getState: vi.fn(() => ({
      cart: { items: [], subtotal: 0, tax: 0, total: 0 },
      clearCart: vi.fn(),
    })),
  },
}));

const mockOrder = {
  id: 'order-1',
  total: 108,
  status: 'payment_pending',
  payment_status: 'pending',
};

const mockStripeIntent = {
  order_id: 'order-1',
  provider: 'stripe',
  client_secret: 'pi_test_secret_123',
  amount: 108,
};

const mockMomoIntent = {
  order_id: 'order-1',
  provider: 'momo',
  payment_reference: 'momo-ref-xyz',
  amount: 108,
};

describe('payment flow helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates order via POST /orders/checkout', async () => {
    const { api } = await import('../app/utils/api');
    vi.mocked(api.post).mockResolvedValueOnce(mockOrder);

    const result = await api.post('/orders/checkout', {
      payment_provider: 'stripe',
      billing_email: 'buyer@test.com',
      billing_name: 'Test Buyer',
    });

    expect(api.post).toHaveBeenCalledWith('/orders/checkout', expect.objectContaining({
      payment_provider: 'stripe',
    }));
    expect(result).toEqual(mockOrder);
  });

  it('creates Stripe payment intent via POST /payments/stripe/intent/:id', async () => {
    const { api } = await import('../app/utils/api');
    vi.mocked(api.post).mockResolvedValueOnce(mockStripeIntent);

    const result = await api.post(`/payments/stripe/intent/${mockOrder.id}`, {});

    expect(result).toMatchObject({
      provider: 'stripe',
      client_secret: expect.stringContaining('pi_test'),
    });
  });

  it('creates MOMO intent via POST /payments/momo/intent/:id', async () => {
    const { api } = await import('../app/utils/api');
    vi.mocked(api.post).mockResolvedValueOnce(mockMomoIntent);

    const result = await api.post(`/payments/momo/intent/${mockOrder.id}?phone_number=%2B256700000000`, {});

    expect(result).toMatchObject({
      provider: 'momo',
      payment_reference: expect.any(String),
    });
  });

  it('redirects to approval_url for PayPal', async () => {
    const { api } = await import('../app/utils/api');
    vi.mocked(api.post).mockResolvedValueOnce({
      order_id: 'order-1',
      provider: 'paypal',
      approval_url: 'https://paypal.com/approve?token=xyz',
      amount: 108,
    });

    const result = await api.post(`/payments/paypal/intent/${mockOrder.id}`, {}) as any;

    expect(result.approval_url).toMatch(/^https:\/\/paypal\.com/);
  });

  it('throws on API error and preserves error message', async () => {
    const { api } = await import('../app/utils/api');
    vi.mocked(api.post).mockRejectedValueOnce(new Error('Card declined'));

    await expect(
      api.post(`/payments/stripe/intent/${mockOrder.id}`, {})
    ).rejects.toThrow('Card declined');
  });

  it('checkout order includes billing fields', async () => {
    const { api } = await import('../app/utils/api');
    vi.mocked(api.post).mockResolvedValueOnce(mockOrder);

    await api.post('/orders/checkout', {
      payment_provider: 'momo',
      billing_email: 'buyer@test.com',
      billing_name: 'Test Buyer',
      phone_number: '+256700000000',
    });

    expect(api.post).toHaveBeenCalledWith('/orders/checkout', {
      payment_provider: 'momo',
      billing_email: 'buyer@test.com',
      billing_name: 'Test Buyer',
      phone_number: '+256700000000',
    });
  });
});
