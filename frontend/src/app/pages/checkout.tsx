import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, Link } from 'react-router';
import { Lock, CreditCard, Smartphone, CheckCircle, ArrowLeft, ArrowRight, ShoppingBag } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { GlassCard } from '../components/glass-card';
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';
import { api } from '../utils/api';
import { cn } from '../components/ui/utils';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? '');

type Step = 'billing' | 'payment' | 'confirm';
type Provider = 'stripe' | 'paypal' | 'momo';

interface OrderResponse {
  id: string;
  total: number;
  status: string;
  payment_status: string;
}

interface PaymentIntentResponse {
  order_id: string;
  provider: Provider;
  client_secret?: string;
  approval_url?: string;
  payment_reference?: string;
  amount: number;
}

const STEPS: { id: Step; label: string }[] = [
  { id: 'billing', label: 'Billing' },
  { id: 'payment', label: 'Payment' },
  { id: 'confirm', label: 'Confirm' },
];

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: '15px',
      color: '#1a1a1a',
      fontFamily: 'inherit',
      '::placeholder': { color: '#9ca3af' },
    },
    invalid: { color: '#ef4444' },
  },
};

function CheckoutInner() {
  const navigate = useNavigate();
  const { cart, fetchCart, clearCart } = useCartStore();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());

  const stripe = useStripe();
  const elements = useElements();

  const [step, setStep] = useState<Step>('billing');
  const [provider, setProvider] = useState<Provider>('stripe');
  const [billing, setBilling] = useState({
    email: user?.email ?? '',
    firstName: '',
    lastName: '',
    address: '',
    city: '',
    zip: '',
    phone: '',
  });
  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [intent, setIntent] = useState<PaymentIntentResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isAuthenticated) fetchCart();
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    navigate('/login');
    return null;
  }

  if (!cart || cart.items.length === 0) {
    navigate('/store/cart');
    return null;
  }

  const handleBillingChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setBilling((p) => ({ ...p, [e.target.id]: e.target.value }));

  // Step 1 → 2: create the order
  const handleBillingNext = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const created = await api.post<OrderResponse>('/orders/checkout', {
        payment_provider: provider,
        billing_email: billing.email,
        billing_name: `${billing.firstName} ${billing.lastName}`.trim(),
        phone_number: billing.phone || undefined,
      });
      setOrder(created);
      setStep('payment');
    } catch (err: any) {
      setError(err.message || 'Failed to create order.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2 → 3: create payment intent (and confirm for Stripe)
  const handlePaymentNext = async () => {
    if (!order) return;
    setError('');
    setLoading(true);
    try {
      if (provider === 'stripe') {
        if (!stripe || !elements) {
          setError('Payment service not ready. Please refresh the page.');
          return;
        }
        const cardEl = elements.getElement(CardElement);
        if (!cardEl) {
          setError('Card form not found. Please refresh the page.');
          return;
        }

        // 1. Create the PaymentIntent on the server
        const result = await api.post<PaymentIntentResponse>(`/payments/stripe/intent/${order.id}`, {});

        // 2. Confirm the card payment client-side using the returned client_secret
        const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
          result.client_secret!,
          { payment_method: { card: cardEl } }
        );

        if (stripeError) {
          setError(stripeError.message ?? 'Card payment failed. Please check your details.');
          return;
        }

        if (paymentIntent?.status === 'succeeded') {
          clearCart();
          setIntent(result);
          setStep('confirm');
        } else {
          setError('Payment was not completed. Please try again.');
        }
      } else if (provider === 'paypal') {
        const result = await api.post<PaymentIntentResponse>(`/payments/paypal/intent/${order.id}`, {});
        if (result.approval_url) {
          window.location.href = result.approval_url;
          return;
        }
        setIntent(result);
        setStep('confirm');
      } else if (provider === 'momo') {
        if (!billing.phone) {
          setError('Phone number is required for Mobile Money.');
          return;
        }
        const result = await api.post<PaymentIntentResponse>(
          `/payments/momo/intent/${order.id}?phone_number=${encodeURIComponent(billing.phone)}`,
          {}
        );
        setIntent(result);
        setStep('confirm');
      }
    } catch (err: any) {
      setError(err.message || 'Payment initiation failed.');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: navigate to orders (Stripe cart already cleared; MOMO/PayPal clear here)
  const handleConfirm = () => {
    clearCart();
    navigate('/store/orders');
  };

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>

          {/* Header */}
          <div className="text-center mb-8">
            <Lock className="w-10 h-10 text-primary mx-auto mb-3" />
            <h1 className="text-4xl mb-1">Secure Checkout</h1>
            <p className="text-black/50">SSL encrypted · Your data is safe</p>
          </div>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-0 mb-10">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center">
                <div className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors',
                  i < stepIndex ? 'bg-primary text-white' :
                  i === stepIndex ? 'bg-primary text-white ring-4 ring-primary/20' :
                  'bg-black/10 text-black/40'
                )}>
                  {i < stepIndex ? <CheckCircle className="w-4 h-4" /> : i + 1}
                </div>
                <span className={cn('ml-2 text-sm hidden sm:block', i === stepIndex ? 'text-black' : 'text-black/40')}>
                  {s.label}
                </span>
                {i < STEPS.length - 1 && (
                  <div className={cn('w-12 h-px mx-3', i < stepIndex ? 'bg-primary' : 'bg-black/10')} />
                )}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <AnimatePresence mode="wait">

                {/* ── Step 1: Billing ── */}
                {step === 'billing' && (
                  <motion.form
                    key="billing"
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    onSubmit={handleBillingNext}
                    className="space-y-5"
                  >
                    <GlassCard className="p-6">
                      <h2 className="text-xl mb-5">Contact Information</h2>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="email">Email *</Label>
                          <Input id="email" type="email" className="mt-1.5" value={billing.email} onChange={handleBillingChange} required />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="firstName">First Name *</Label>
                            <Input id="firstName" className="mt-1.5" value={billing.firstName} onChange={handleBillingChange} required />
                          </div>
                          <div>
                            <Label htmlFor="lastName">Last Name *</Label>
                            <Input id="lastName" className="mt-1.5" value={billing.lastName} onChange={handleBillingChange} required />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="address">Address *</Label>
                          <Input id="address" className="mt-1.5" value={billing.address} onChange={handleBillingChange} required />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="city">City *</Label>
                            <Input id="city" className="mt-1.5" value={billing.city} onChange={handleBillingChange} required />
                          </div>
                          <div>
                            <Label htmlFor="zip">ZIP Code *</Label>
                            <Input id="zip" className="mt-1.5" value={billing.zip} onChange={handleBillingChange} required />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="phone">Phone (required for Mobile Money)</Label>
                          <Input id="phone" type="tel" className="mt-1.5" placeholder="+256700000000" value={billing.phone} onChange={handleBillingChange} />
                        </div>
                      </div>
                    </GlassCard>

                    <GlassCard className="p-6">
                      <h2 className="text-xl mb-5">Payment Method</h2>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {([
                          { id: 'stripe', label: 'Credit / Debit Card', icon: CreditCard, desc: 'Visa, Mastercard, Amex' },
                          { id: 'paypal', label: 'PayPal', icon: CreditCard, desc: 'Pay with PayPal account' },
                          { id: 'momo', label: 'Mobile Money', icon: Smartphone, desc: 'MTN MoMo' },
                        ] as const).map((m) => {
                          const Icon = m.icon;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => setProvider(m.id)}
                              className={cn(
                                'flex flex-col items-start p-4 rounded-xl border-2 text-left transition-all',
                                provider === m.id
                                  ? 'border-primary bg-primary/5'
                                  : 'border-black/10 hover:border-black/20'
                              )}
                            >
                              <Icon className={cn('w-5 h-5 mb-2', provider === m.id ? 'text-primary' : 'text-black/40')} />
                              <span className="text-sm font-medium">{m.label}</span>
                              <span className="text-xs text-black/40 mt-0.5">{m.desc}</span>
                            </button>
                          );
                        })}
                      </div>
                    </GlassCard>

                    {error && <p className="text-sm text-red-500">{error}</p>}
                    <Button type="submit" size="lg" className="w-full" disabled={loading}>
                      {loading ? 'Creating order…' : 'Continue to Payment'}
                      <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </motion.form>
                )}

                {/* ── Step 2: Payment details ── */}
                {step === 'payment' && (
                  <motion.div
                    key="payment"
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-5"
                  >
                    <GlassCard className="p-6">
                      {provider === 'stripe' && (
                        <>
                          <h2 className="text-xl mb-2">Card Details</h2>
                          <p className="text-sm text-black/50 mb-5">
                            Enter your card information below. Your payment is secured by Stripe.
                          </p>
                          <div className="rounded-lg border border-black/15 bg-white px-4 py-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                            <CardElement options={CARD_ELEMENT_OPTIONS} />
                          </div>
                          <div className="flex items-center gap-1.5 mt-3 text-xs text-black/40">
                            <Lock className="w-3 h-3" />
                            <span>256-bit TLS encryption · Powered by Stripe</span>
                          </div>
                        </>
                      )}
                      {provider === 'paypal' && (
                        <>
                          <h2 className="text-xl mb-2">PayPal</h2>
                          <p className="text-sm text-black/50 mb-5">
                            You will be redirected to PayPal to complete your payment securely.
                          </p>
                          <div className="bg-blue-50 rounded-lg p-4 border border-blue-100 text-sm text-blue-700">
                            Clicking "Continue to PayPal" will redirect you to PayPal's approval page.
                          </div>
                        </>
                      )}
                      {provider === 'momo' && (
                        <>
                          <h2 className="text-xl mb-2">MTN Mobile Money</h2>
                          <p className="text-sm text-black/50 mb-5">
                            A payment request will be sent to <strong>{billing.phone || 'your phone'}</strong>. Approve it on your phone to complete the payment.
                          </p>
                          {!billing.phone && (
                            <p className="text-sm text-red-500 mb-3">Please go back and enter your phone number.</p>
                          )}
                          <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-100 text-sm text-yellow-700">
                            <Smartphone className="w-5 h-5 mb-1 text-yellow-600" />
                            You will receive a USSD push on <strong>{billing.phone || '—'}</strong>. Enter your MoMo PIN to confirm.
                          </div>
                        </>
                      )}
                    </GlassCard>

                    {error && <p className="text-sm text-red-500">{error}</p>}
                    <div className="flex gap-3">
                      <Button variant="outline" onClick={() => setStep('billing')} disabled={loading}>
                        <ArrowLeft className="mr-2 w-4 h-4" /> Back
                      </Button>
                      <Button
                        className="flex-1"
                        size="lg"
                        onClick={handlePaymentNext}
                        disabled={loading || (provider === 'momo' && !billing.phone) || (provider === 'stripe' && !stripe)}
                      >
                        {loading ? 'Processing…' : provider === 'paypal' ? 'Continue to PayPal' : 'Pay Now'}
                        <ArrowRight className="ml-2 w-4 h-4" />
                      </Button>
                    </div>
                  </motion.div>
                )}

                {/* ── Step 3: Success ── */}
                {step === 'confirm' && (
                  <motion.div
                    key="confirm"
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-5"
                  >
                    <GlassCard className="p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <CheckCircle className="w-6 h-6 text-green-500" />
                        <h2 className="text-xl">
                          {provider === 'stripe' ? 'Payment Successful' :
                           provider === 'momo' ? 'Payment Request Sent' :
                           'Order Confirmed'}
                        </h2>
                      </div>

                      {provider === 'stripe' && (
                        <div className="space-y-3 text-sm text-black/60">
                          <p>Your payment was confirmed successfully. Your order is now being processed.</p>
                          <p className="text-xs text-black/40">Order ID: {order?.id}</p>
                        </div>
                      )}

                      {provider === 'momo' && intent?.payment_reference && (
                        <div className="space-y-3 text-sm text-black/60">
                          <p>A payment request has been sent to <strong>{billing.phone}</strong>. Please check your phone and approve the MTN MoMo request.</p>
                          <div className="bg-yellow-50 rounded p-3 text-yellow-700 text-xs">
                            Reference: <strong>{intent.payment_reference}</strong>
                          </div>
                          <p className="text-xs text-black/40">Your order will be confirmed automatically once payment is received.</p>
                        </div>
                      )}
                    </GlassCard>

                    {error && <p className="text-sm text-red-500">{error}</p>}
                    <Button className="w-full" size="lg" onClick={handleConfirm}>
                      <ShoppingBag className="mr-2 w-4 h-4" />
                      View My Orders
                    </Button>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>

            {/* Order summary sidebar */}
            <div className="lg:col-span-1">
              <GlassCard className="p-6 sticky top-24">
                <h2 className="text-xl mb-5">Order Summary</h2>
                <div className="space-y-3 mb-5">
                  {cart.items.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-black/70 truncate flex-1 mr-2">{item.product.name} ×{item.quantity}</span>
                      <span>${(Number(item.product.price) * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-black/10 pt-3 space-y-2">
                  <div className="flex justify-between text-sm text-black/60">
                    <span>Subtotal</span><span>${Number(cart.subtotal).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-black/60">
                    <span>Tax</span><span>${Number(cart.tax).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-medium pt-1 border-t border-black/10">
                    <span>Total</span>
                    <span className="text-primary">${Number(cart.total).toFixed(2)}</span>
                  </div>
                </div>
                <div className="mt-5 pt-4 border-t border-black/10">
                  <div className="flex items-center gap-2 text-xs text-black/40">
                    <Lock className="w-3 h-3" />
                    <span>256-bit SSL encryption</span>
                  </div>
                </div>
              </GlassCard>
            </div>
          </div>

        </motion.div>
      </div>
    </div>
  );
}

export function Checkout() {
  return (
    <Elements stripe={stripePromise}>
      <CheckoutInner />
    </Elements>
  );
}
