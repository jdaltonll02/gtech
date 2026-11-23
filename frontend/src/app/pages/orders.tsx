import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import { ShoppingBag, ChevronDown, ChevronUp, Package } from 'lucide-react';
import { Button } from '../components/ui/button';
import { GlassCard } from '../components/glass-card';
import { useAuthStore } from '../store/authStore';
import { api } from '../utils/api';

type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';
type OrderStatus = 'payment_pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
type PaymentProvider = 'stripe' | 'paypal' | 'momo';

interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: string;
  total_price: string;
}

interface Order {
  id: string;
  status: OrderStatus;
  subtotal: string;
  tax: string;
  total: string;
  payment_provider: PaymentProvider | null;
  payment_status: PaymentStatus;
  billing_email: string | null;
  billing_name: string | null;
  items: OrderItem[];
  created_at?: string;
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  payment_pending: 'Awaiting Payment',
  confirmed: 'Confirmed',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  payment_pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  processing: 'bg-purple-100 text-purple-800',
  shipped: 'bg-indigo-100 text-indigo-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  pending: 'text-yellow-700',
  completed: 'text-green-700',
  failed: 'text-red-700',
  refunded: 'text-gray-600',
};

const PROVIDER_LABELS: Record<string, string> = {
  stripe: 'Card (Stripe)',
  paypal: 'PayPal',
  momo: 'Mobile Money',
};

function OrderCard({ order }: { order: Order }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <GlassCard className="overflow-hidden">
      <button
        className="w-full text-left px-6 py-5 flex items-center justify-between hover:bg-black/[0.02] transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
          <div>
            <p className="text-xs text-black/40 mb-0.5">Order</p>
            <p className="font-mono text-sm">{order.id.slice(0, 8).toUpperCase()}</p>
          </div>
          <div>
            <p className="text-xs text-black/40 mb-0.5">Items</p>
            <p className="text-sm">{order.items.length} item{order.items.length !== 1 ? 's' : ''}</p>
          </div>
          <div>
            <p className="text-xs text-black/40 mb-0.5">Total</p>
            <p className="text-sm font-semibold">${Number(order.total).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-black/40 mb-0.5">Payment</p>
            <p className={`text-sm font-medium capitalize ${PAYMENT_STATUS_COLORS[order.payment_status]}`}>
              {order.payment_status}
            </p>
          </div>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[order.status]}`}>
            {STATUS_LABELS[order.status]}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-black/40 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-black/40 flex-shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-black/10 px-6 py-5 space-y-4">
          <div className="grid sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-black/40 text-xs mb-1">Billing name</p>
              <p>{order.billing_name || '—'}</p>
            </div>
            <div>
              <p className="text-black/40 text-xs mb-1">Billing email</p>
              <p>{order.billing_email || '—'}</p>
            </div>
            <div>
              <p className="text-black/40 text-xs mb-1">Payment method</p>
              <p>{order.payment_provider ? PROVIDER_LABELS[order.payment_provider] ?? order.payment_provider : '—'}</p>
            </div>
          </div>

          <div>
            <p className="text-xs text-black/40 mb-3">Items</p>
            <div className="space-y-2">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-2 border-b border-black/5 last:border-0">
                  <div className="flex items-center gap-3">
                    <Package className="w-4 h-4 text-black/30" />
                    <div>
                      <p className="text-sm">{item.product_name}</p>
                      <p className="text-xs text-black/40">Qty: {item.quantity} × ${Number(item.unit_price).toFixed(2)}</p>
                    </div>
                  </div>
                  <p className="text-sm font-medium">${Number(item.total_price).toFixed(2)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-end gap-1 text-sm pt-2 border-t border-black/10">
            <div className="flex justify-between w-40">
              <span className="text-black/50">Subtotal</span>
              <span>${Number(order.subtotal).toFixed(2)}</span>
            </div>
            <div className="flex justify-between w-40">
              <span className="text-black/50">Tax</span>
              <span>${Number(order.tax).toFixed(2)}</span>
            </div>
            <div className="flex justify-between w-40 font-semibold text-base pt-1 border-t border-black/10">
              <span>Total</span>
              <span>${Number(order.total).toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}
    </GlassCard>
  );
}

export function Orders() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) return;
    api.get<Order[]>('/ecommerce/orders')
      .then(setOrders)
      .catch(() => setError('Failed to load orders.'))
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <ShoppingBag className="w-24 h-24 text-primary/50 mx-auto mb-6" />
          <h1 className="text-4xl mb-4">Sign in to view your orders</h1>
          <Link to="/login"><Button size="lg">Sign In</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-4xl">Order History</h1>
            <Link to="/store">
              <Button variant="outline">Continue Shopping</Button>
            </Link>
          </div>

          {loading && (
            <div className="text-center py-20 text-black/40">Loading orders…</div>
          )}

          {error && (
            <GlassCard className="p-6 text-center text-destructive">{error}</GlassCard>
          )}

          {!loading && !error && orders.length === 0 && (
            <div className="text-center py-20">
              <ShoppingBag className="w-20 h-20 text-primary/30 mx-auto mb-6" />
              <h2 className="text-2xl mb-3">No orders yet</h2>
              <p className="text-black/50 mb-8">When you make a purchase it will appear here.</p>
              <Link to="/store"><Button size="lg">Browse Store</Button></Link>
            </div>
          )}

          {!loading && !error && orders.length > 0 && (
            <div className="space-y-4">
              {orders.map((order, i) => (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: i * 0.05 }}
                >
                  <OrderCard order={order} />
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
