import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { motion } from 'motion/react';
import {
  ShoppingCart, Star, Truck, Shield, RotateCcw,
  ChevronRight, Check, Minus, Plus, Package, ArrowRight,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { GlassCard } from '../components/glass-card';
import { StarRating as StarRatingWidget, RatingDistribution } from '../components/star-rating';
import { Textarea } from '../components/ui/textarea';
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';
import { api } from '../utils/api';
import { cn } from '../components/ui/utils';

type RatingSummary = { avg_rating: number; rating_count: number; distribution: Record<number, number> };
type ProductRating = { id: string; author_name: string; rating: number; review: string | null; created_at: string };

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  original_price?: number;
  discounted_price?: number;
  image_url?: string;
  image_urls?: string[];
  in_stock: boolean;
  stock_quantity?: number;
  category?: { name: string };
}

function StarRatingDisplay({ value, count }: { value: number; count: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              'w-4 h-4',
              star <= Math.floor(value)
                ? 'fill-amber-400 text-amber-400'
                : star - 0.5 <= value
                  ? 'fill-amber-200 text-amber-400'
                  : 'fill-black/10 text-black/20',
            )}
          />
        ))}
      </div>
      <span className="text-sm text-primary hover:underline cursor-pointer">
        {count.toLocaleString()} ratings
      </span>
    </div>
  );
}

export function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { cart, fetchCart, addItem } = useCartStore();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const [buyingNow, setBuyingNow] = useState(false);
  const [ratingSummary, setRatingSummary] = useState<RatingSummary | null>(null);
  const [reviews, setReviews] = useState<ProductRating[]>([]);
  const [myRating, setMyRating] = useState<{ rating: number; review: string | null } | null>(null);
  const [ratingInput, setRatingInput] = useState(0);
  const [reviewInput, setReviewInput] = useState('');
  const [ratingSubmitting, setRatingSubmitting] = useState(false);

  const markFailed = (url: string) =>
    setFailedImages((prev) => new Set(prev).add(url));

  useEffect(() => {
    api.get<Product>(`/products/${id}`)
      .then(setProduct)
      .catch(() => setError('Product not found.'))
      .finally(() => setLoading(false));
    api.get<RatingSummary>(`/products/${id}/ratings/summary`).then(setRatingSummary).catch(() => {});
    api.get<ProductRating[]>(`/products/${id}/ratings`).then(setReviews).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!id || !isAuthenticated) return;
    api.get<{ rating: number; review: string | null } | null>(`/products/${id}/ratings/me`)
      .then((r) => { if (r) { setMyRating(r); setRatingInput(r.rating); setReviewInput(r.review ?? ''); } })
      .catch(() => {});
  }, [id, isAuthenticated]);

  const handleSubmitRating = async () => {
    if (!id || ratingInput === 0) return;
    setRatingSubmitting(true);
    try {
      await api.post(`/products/${id}/rate`, { rating: ratingInput, review: reviewInput || null });
      setMyRating({ rating: ratingInput, review: reviewInput || null });
      const [summary, list] = await Promise.all([
        api.get<RatingSummary>(`/products/${id}/ratings/summary`),
        api.get<ProductRating[]>(`/products/${id}/ratings`),
      ]);
      setRatingSummary(summary);
      setReviews(list);
    } catch {}
    finally { setRatingSubmitting(false); }
  };

  useEffect(() => {
    setActiveImageIndex(0);
  }, [product?.id]);

  useEffect(() => {
    if (isAuthenticated) fetchCart();
  }, [isAuthenticated]);

  if (loading) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-black/40">Loading product…</p>
        </div>
      </div>
    );
  }

  if (!product || error) {
    return (
      <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <Package className="w-24 h-24 text-primary/30 mx-auto mb-6" />
          <h1 className="text-4xl mb-4">Product Not Found</h1>
          <p className="text-black/50 mb-8">This product doesn't exist or has been removed.</p>
          <Link to="/store"><Button size="lg">Back to Store</Button></Link>
        </div>
      </div>
    );
  }

  const imageUrls = (product.image_urls?.length ? product.image_urls : product.image_url ? [product.image_url] : []);
  const currentImage = imageUrls[activeImageIndex];
  const effectivePrice = Number(product.discounted_price ?? product.price);
  const originalPrice = product.original_price != null ? Number(product.original_price) : null;
  const discountPct = originalPrice && originalPrice > effectivePrice
    ? Math.round((1 - effectivePrice / originalPrice) * 100)
    : null;

  const cartItemCount = cart?.items.reduce((s, i) => s + i.quantity, 0) ?? 0;
  const isInCart = cart?.items.some((i) => i.product_id === product.id) ?? false;
  const showCartActions = isInCart || justAdded;

  const handleAddToCart = async () => {
    if (!isAuthenticated) { navigate('/login'); return; }
    setAdding(true);
    try {
      await addItem(product.id, quantity);
      setJustAdded(true);
    } catch (e: any) {
      setError(e.message ?? 'Failed to add to cart.');
    } finally {
      setAdding(false);
    }
  };

  const handleBuyNow = async () => {
    if (!isAuthenticated) { navigate('/login'); return; }
    setBuyingNow(true);
    try {
      await addItem(product.id, quantity);
      navigate('/store/checkout');
    } catch (e: any) {
      setError(e.message ?? 'Failed to add to cart.');
      setBuyingNow(false);
    }
  };

  return (
    <div className="min-h-screen pt-20 pb-20 bg-white/50">
      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 border-b border-black/8">
        <nav className="flex items-center gap-1.5 text-sm text-black/50 flex-wrap">
          <Link to="/" className="hover:text-primary hover:underline">Home</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <Link to="/store" className="hover:text-primary hover:underline">Store</Link>
          {product.category?.name && (
            <>
              <ChevronRight className="w-3.5 h-3.5" />
              <Link to={`/store?category=${encodeURIComponent(product.category.name)}`} className="hover:text-primary hover:underline">
                {product.category.name}
              </Link>
            </>
          )}
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-black/70 line-clamp-1 max-w-xs">{product.name}</span>
        </nav>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>

          {/* ── Main product section ── */}
          <div className="flex flex-col lg:flex-row gap-8 lg:gap-10">

            {/* ── Image gallery ── */}
            <div className="lg:w-[55%] flex gap-3">
              {/* Vertical thumbnail strip */}
              {imageUrls.length > 1 && (
                <div className="flex flex-col gap-2 flex-shrink-0">
                  {imageUrls.map((url, idx) => (
                    <button
                      key={`thumb-${idx}`}
                      type="button"
                      onMouseEnter={() => setActiveImageIndex(idx)}
                      onClick={() => setActiveImageIndex(idx)}
                      className={cn(
                        'w-14 h-14 rounded border-2 overflow-hidden flex-shrink-0 bg-black/5 flex items-center justify-center transition-all',
                        idx === activeImageIndex
                          ? 'border-primary ring-1 ring-primary/30 shadow-sm'
                          : 'border-black/10 hover:border-black/30',
                      )}
                    >
                      {failedImages.has(url) ? (
                        <ShoppingCart className="w-5 h-5 text-primary/30" />
                      ) : (
                        <img
                          src={url}
                          alt={`${product.name} view ${idx + 1}`}
                          className="h-full w-full object-cover"
                          referrerPolicy="no-referrer"
                          crossOrigin="anonymous"
                          onError={() => markFailed(url)}
                        />
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Main image */}
              <div className="flex-1">
                <div className="sticky top-24 rounded-2xl overflow-hidden border border-black/8 bg-gradient-to-br from-black/[0.02] to-black/[0.04] aspect-square flex items-center justify-center">
                  {currentImage && !failedImages.has(currentImage) ? (
                    <img
                      src={currentImage}
                      alt={product.name}
                      className="h-full w-full object-contain p-4 transition-transform duration-300 hover:scale-105"
                      referrerPolicy="no-referrer"
                      crossOrigin="anonymous"
                      onError={() => markFailed(currentImage)}
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-4 text-black/20">
                      <ShoppingCart className="w-24 h-24" />
                      <span className="text-sm">No image available</span>
                    </div>
                  )}
                </div>
                {imageUrls.length > 1 && (
                  <div className="flex justify-center gap-1.5 mt-3">
                    {imageUrls.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveImageIndex(idx)}
                        className={cn(
                          'w-2 h-2 rounded-full transition-all',
                          idx === activeImageIndex ? 'bg-primary w-4' : 'bg-black/20',
                        )}
                        aria-label={`View image ${idx + 1}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Product info + buy box ── */}
            <div className="lg:w-[45%] flex flex-col gap-0">

              {/* Title & meta */}
              <div className="pb-4 border-b border-black/8">
                {product.category?.name && (
                  <span className="text-xs font-medium text-primary uppercase tracking-wider mb-2 inline-block">
                    {product.category.name}
                  </span>
                )}
                <h1 className="text-2xl sm:text-3xl leading-snug mb-3">{product.name}</h1>
                {ratingSummary && ratingSummary.rating_count > 0
                  ? <StarRatingDisplay value={ratingSummary.avg_rating} count={ratingSummary.rating_count} />
                  : <span className="text-sm text-black/40">No ratings yet</span>
                }
              </div>

              {/* Price */}
              <div className="py-4 border-b border-black/8">
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="text-3xl font-bold text-primary">
                    ${effectivePrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                  {originalPrice && originalPrice > effectivePrice && (
                    <span className="text-base text-black/40 line-through">
                      ${originalPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  )}
                  {discountPct && (
                    <span className="text-sm font-semibold px-2 py-0.5 bg-red-100 text-red-700 rounded">
                      -{discountPct}%
                    </span>
                  )}
                </div>
                {discountPct && originalPrice && (
                  <p className="text-sm text-green-700 mt-1">
                    You save ${(originalPrice - effectivePrice).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                )}
              </div>

              {/* Delivery & stock */}
              <div className="py-4 border-b border-black/8 space-y-2.5">
                <div className="flex items-start gap-2.5 text-sm">
                  <Truck className="w-4 h-4 text-black/50 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-medium">FREE Delivery</span>
                    <span className="text-black/50"> on eligible orders over $35</span>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 text-sm">
                  <Package className="w-4 h-4 text-black/50 flex-shrink-0" />
                  {product.in_stock ? (
                    <span className="font-semibold text-green-700">In Stock</span>
                  ) : (
                    <span className="font-semibold text-red-600">Out of Stock</span>
                  )}
                </div>
                <div className="flex items-start gap-2.5 text-sm">
                  <RotateCcw className="w-4 h-4 text-black/50 mt-0.5 flex-shrink-0" />
                  <span className="text-black/60">30-day return policy</span>
                </div>
              </div>

              {/* Buy box */}
              <div className="py-5 space-y-3">
                {/* Quantity */}
                <div className="flex items-center gap-3">
                  <span className="text-sm text-black/60 w-16">Quantity:</span>
                  <div className="flex items-center border border-black/15 rounded-lg overflow-hidden">
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      title="Decrease quantity"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      disabled={quantity <= 1}
                      className="w-9 h-9 flex items-center justify-center hover:bg-black/5 disabled:opacity-30 transition-colors"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-10 text-center text-sm font-medium">{quantity}</span>
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      title="Increase quantity"
                      onClick={() => setQuantity((q) => q + 1)}
                      className="w-9 h-9 flex items-center justify-center hover:bg-black/5 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Add to Cart */}
                <Button
                  size="lg"
                  className="w-full bg-amber-400 hover:bg-amber-500 text-black border-0 font-semibold shadow-sm"
                  disabled={!product.in_stock || adding}
                  onClick={handleAddToCart}
                >
                  {adding ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      Adding…
                    </span>
                  ) : justAdded ? (
                    <span className="flex items-center gap-2"><Check className="w-4 h-4" />Added to Cart</span>
                  ) : (
                    <span className="flex items-center gap-2"><ShoppingCart className="w-4 h-4" />Add to Cart</span>
                  )}
                </Button>

                {/* Buy Now */}
                <Button
                  size="lg"
                  className="w-full bg-primary hover:bg-primary/90 text-white font-semibold"
                  disabled={!product.in_stock || buyingNow}
                  onClick={handleBuyNow}
                >
                  {buyingNow ? 'Processing…' : 'Buy Now'}
                </Button>

                {/* View Cart / Proceed to Checkout — shown once item is in cart */}
                {showCartActions && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2.5"
                  >
                    <div className="flex items-center gap-2 text-sm text-black/60 mb-1">
                      <Check className="w-4 h-4 text-green-600" />
                      <span>Item added · {cartItemCount} {cartItemCount === 1 ? 'item' : 'items'} in cart</span>
                    </div>
                    <Link to="/store/cart">
                      <Button variant="outline" className="w-full border-primary/30 hover:bg-primary/5">
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        View Cart
                      </Button>
                    </Link>
                    <Link to="/store/checkout">
                      <Button className="w-full mt-2">
                        Proceed to Checkout
                        <ArrowRight className="ml-2 w-4 h-4" />
                      </Button>
                    </Link>
                  </motion.div>
                )}

                {error && <p className="text-sm text-red-500">{error}</p>}

                {/* Trust badges */}
                <div className="flex items-center gap-2 text-xs text-black/40 pt-1">
                  <Shield className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Secure transaction · SSL encrypted payment</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Below fold ── */}
          <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* About this item */}
            <div className="lg:col-span-2 space-y-8">
              <GlassCard className="p-8">
                <h2 className="text-xl font-semibold mb-5">About this item</h2>
                <ul className="space-y-3">
                  {[
                    'Expert consultation and personalized guidance included',
                    'Comprehensive documentation and setup guide provided',
                    'Email support for 30 days post-purchase',
                    '30-day money-back guarantee on all orders',
                    'Secure checkout powered by Stripe',
                  ].map((point, i) => (
                    <li key={i} className="flex items-start gap-3 text-black/70 text-sm leading-relaxed">
                      <span className="w-1.5 h-1.5 rounded-full bg-black/40 mt-2 flex-shrink-0" />
                      {point}
                    </li>
                  ))}
                </ul>
              </GlassCard>

              <GlassCard className="p-8">
                <h2 className="text-xl font-semibold mb-4">Product Description</h2>
                <p className="text-black/70 leading-relaxed">{product.description}</p>
              </GlassCard>
            </div>

            {/* Technical details */}
            <div>
              <GlassCard className="p-6">
                <h2 className="text-lg font-semibold mb-4">Technical Details</h2>
                <table className="w-full text-sm">
                  <tbody>
                    {[
                      ['Category', product.category?.name ?? '—'],
                      ['Availability', product.in_stock ? 'In Stock' : 'Out of Stock'],
                      ['Price', `$${effectivePrice.toFixed(2)}`],
                      ...(discountPct ? [['Savings', `-${discountPct}%`]] : []),
                    ].map(([label, value]) => (
                      <tr key={label} className="border-b border-black/8 last:border-0">
                        <td className="py-2.5 pr-4 text-black/50 font-medium w-28">{label}</td>
                        <td className="py-2.5 text-black/80">{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </GlassCard>

              {/* Secure purchase guarantee */}
              <GlassCard className="p-6 mt-4">
                <h3 className="text-sm font-semibold mb-3">Purchase Protection</h3>
                <div className="space-y-3 text-sm text-black/60">
                  <div className="flex gap-2.5">
                    <Shield className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>Secure payment processing</span>
                  </div>
                  <div className="flex gap-2.5">
                    <RotateCcw className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>30-day return policy</span>
                  </div>
                  <div className="flex gap-2.5">
                    <Truck className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>Free delivery on eligible orders</span>
                  </div>
                </div>
              </GlassCard>
            </div>
          </div>

        </motion.div>

        {/* ── Ratings & Reviews ── */}
        {(ratingSummary || isAuthenticated) && (
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 pb-16">
            <h2 className="text-2xl mb-6">Ratings & Reviews</h2>
            {ratingSummary && ratingSummary.rating_count > 0 && (
              <GlassCard className="p-6 mb-6">
                <div className="flex flex-col sm:flex-row gap-8 items-start">
                  <div className="text-center flex-shrink-0">
                    <p className="text-6xl font-bold text-primary">{ratingSummary.avg_rating.toFixed(1)}</p>
                    <StarRatingWidget value={Math.round(ratingSummary.avg_rating)} readOnly size="md" />
                    <p className="text-sm text-black/50 mt-1">{ratingSummary.rating_count} rating{ratingSummary.rating_count !== 1 ? 's' : ''}</p>
                  </div>
                  <RatingDistribution distribution={ratingSummary.distribution} total={ratingSummary.rating_count} />
                </div>
              </GlassCard>
            )}

            {isAuthenticated && (
              <GlassCard className="p-6 mb-6">
                <h3 className="text-lg mb-3">{myRating ? 'Update your review' : 'Write a review'}</h3>
                <StarRatingWidget value={ratingInput} onChange={setRatingInput} size="lg" />
                <Textarea
                  className="mt-3"
                  placeholder="Share your thoughts about this product (optional)…"
                  value={reviewInput}
                  onChange={(e) => setReviewInput(e.target.value)}
                  rows={3}
                />
                <Button
                  className="mt-3"
                  disabled={ratingInput === 0 || ratingSubmitting}
                  onClick={handleSubmitRating}
                >
                  {ratingSubmitting ? 'Submitting…' : myRating ? 'Update Review' : 'Submit Review'}
                </Button>
              </GlassCard>
            )}

            {reviews.length > 0 && (
              <div className="space-y-4">
                {reviews.map((r) => (
                  <GlassCard key={r.id} className="p-5">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-medium text-sm">{r.author_name}</p>
                        <p className="text-xs text-black/40">{new Date(r.created_at).toLocaleDateString()}</p>
                      </div>
                      <StarRatingWidget value={r.rating} readOnly size="sm" />
                    </div>
                    {r.review && <p className="text-black/70 text-sm leading-relaxed">{r.review}</p>}
                  </GlassCard>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
