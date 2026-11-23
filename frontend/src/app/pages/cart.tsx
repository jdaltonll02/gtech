import { useEffect } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import { Trash2, ShoppingBag, ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import { GlassCard } from '../components/glass-card';
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';

export function Cart() {
  const { cart, loading, fetchCart, updateItem, removeItem } = useCartStore();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());

  useEffect(() => {
    if (isAuthenticated) fetchCart();
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <ShoppingBag className="w-24 h-24 text-primary/50 mx-auto mb-6" />
          <h1 className="text-4xl mb-4">Sign In to View Cart</h1>
          <p className="text-black/60 mb-8">Please sign in to manage your cart.</p>
          <Link to="/login"><Button size="lg">Sign In</Button></Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <p className="text-black/40">Loading cart…</p>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <ShoppingBag className="w-24 h-24 text-primary/50 mx-auto mb-6" />
          <h1 className="text-4xl mb-4">Your Cart is Empty</h1>
          <p className="text-black/60 mb-8">Add some items to your cart to get started</p>
          <Link to="/store"><Button size="lg">Browse Store</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <h1 className="text-5xl mb-4">Shopping Cart</h1>
          <p className="text-black/60 mb-12">
            {cart.items.length} {cart.items.length === 1 ? 'item' : 'items'} in your cart
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              {cart.items.map((item) => (
                <GlassCard key={item.id} className="p-6">
                  <div className="flex items-center gap-6">
                    <div className="w-24 h-24 bg-gradient-to-br from-primary/20 to-primary/5 rounded-lg flex-shrink-0" />
                    <div className="flex-1">
                      <h3 className="text-xl mb-1">{item.product.name}</h3>
                      <p className="text-sm text-black/50 mb-2">{item.product.category?.name}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-lg text-primary">${Number(item.product.discounted_price ?? item.product.price).toLocaleString()}</p>
                        {item.product.original_price != null && Number(item.product.original_price) > Number(item.product.discounted_price ?? item.product.price) && (
                          <p className="text-sm text-black/40 line-through">${Number(item.product.original_price).toLocaleString()}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <label htmlFor={`qty-${item.id}`} className="sr-only">Quantity for {item.product.name}</label>
                      <select
                        id={`qty-${item.id}`}
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, Number(e.target.value))}
                        className="bg-black/5 border border-black/10 rounded px-3 py-2"
                      >
                        {[1, 2, 3, 4, 5].map((num) => (
                          <option key={num} value={num}>{num}</option>
                        ))}
                      </select>
                      <Button variant="ghost" size="icon" onClick={() => removeItem(item.id)}>
                        <Trash2 className="w-5 h-5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <GlassCard className="p-6 sticky top-24">
                <h2 className="text-2xl mb-6">Order Summary</h2>
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-black/60">
                    <span>Subtotal</span>
                    <span>${Number(cart.subtotal).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-black/60">
                    <span>Tax (8%)</span>
                    <span>${Number(cart.tax).toFixed(2)}</span>
                  </div>
                  <div className="border-t border-black/10 pt-3">
                    <div className="flex justify-between text-xl">
                      <span>Total</span>
                      <span className="text-primary">${Number(cart.total).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                <Link to="/store/checkout">
                  <Button size="lg" className="w-full group">
                    Proceed to Checkout
                    <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <Link to="/store">
                  <Button variant="ghost" className="w-full mt-3">Continue Shopping</Button>
                </Link>
              </GlassCard>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
