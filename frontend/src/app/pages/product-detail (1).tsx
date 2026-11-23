import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router';
import { motion } from 'motion/react';
import { ArrowLeft, ShoppingCart, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import { GlassCard } from '../components/glass-card';
import { api } from '../utils/api';

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
  category?: { name: string };
}

export function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<Product>(`/products/${id}`)
      .then(setProduct)
      .catch(() => setError('Product not found.'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    setActiveImageIndex(0);
  }, [product?.id]);

  const handleAddToCart = async () => {
    if (!product) return;
    setAdding(true);
    try {
      await api.post('/cart', { product_id: product.id, quantity: 1 });
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    } catch (e: any) {
      setError(e.message ?? 'Failed to add to cart.');
    } finally {
      setAdding(false);
    }
  };

  if (loading) return <div className="min-h-screen pt-24 flex items-center justify-center"><p className="text-black/40">Loading…</p></div>;

  if (!product || error) return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto text-center">
        <h1 className="text-4xl mb-4">Product Not Found</h1>
        <Link to="/store"><Button>Back to Store</Button></Link>
      </div>
    </div>
  );

  const features = ['Expert consultation and guidance', 'Detailed documentation included', 'Email support for 30 days', 'Money-back guarantee'];
  const imageUrls = product.image_urls && product.image_urls.length > 0
    ? product.image_urls
    : (product.image_url ? [product.image_url] : []);
  const currentImage = imageUrls[activeImageIndex];

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <Link to="/store" className="inline-flex items-center text-primary hover:underline mb-8">
          <ArrowLeft className="w-4 h-4 mr-2" />Back to Store
        </Link>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <GlassCard className="overflow-hidden">
              <div className="aspect-square bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center overflow-hidden">
                {currentImage ? (
                  <img src={currentImage} alt={product.name} className="h-full w-full object-cover" />
                ) : (
                  <ShoppingCart className="w-32 h-32 text-primary/50" />
                )}
              </div>
              {imageUrls.length > 1 && (
                <div className="p-3 border-t border-black/10">
                  <div className="flex items-center gap-2 mb-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setActiveImageIndex((i) => (i === 0 ? imageUrls.length - 1 : i - 1))}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setActiveImageIndex((i) => (i === imageUrls.length - 1 ? 0 : i + 1))}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                    <p className="text-xs text-black/50 ml-auto">{activeImageIndex + 1} / {imageUrls.length}</p>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {imageUrls.map((url, idx) => (
                      <button
                        key={`${url}-${idx}`}
                        onClick={() => setActiveImageIndex(idx)}
                        className={`h-16 w-16 rounded border overflow-hidden flex-shrink-0 ${idx === activeImageIndex ? 'border-primary' : 'border-black/10'}`}
                      >
                        <img src={url} alt={`${product.name} ${idx + 1}`} className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </GlassCard>
            <div>
              <p className="text-sm text-primary mb-2">{product.category?.name}</p>
              {!product.in_stock && <span className="text-sm px-3 py-1 bg-black/5 border border-black/10 rounded ml-2">Out of Stock</span>}
              <h1 className="text-4xl mb-4">{product.name}</h1>
              <div className="flex items-center gap-3 mb-6">
                <p className="text-2xl text-primary">${Number(product.discounted_price ?? product.price).toLocaleString()}</p>
                {product.original_price != null && Number(product.original_price) > Number(product.discounted_price ?? product.price) && (
                  <p className="text-base text-black/40 line-through">${Number(product.original_price).toLocaleString()}</p>
                )}
              </div>
              <p className="text-lg text-black/70 mb-8">{product.description}</p>
              <GlassCard className="p-6 mb-8">
                <h3 className="text-xl mb-4">What's Included:</h3>
                <ul className="space-y-3">
                  {features.map((f, i) => (
                    <li key={i} className="flex items-center text-black/70">
                      <Check className="w-5 h-5 text-primary mr-3 flex-shrink-0" />{f}
                    </li>
                  ))}
                </ul>
              </GlassCard>
              {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
              <div className="flex gap-4">
                <Button size="lg" className="flex-1" disabled={!product.in_stock || adding} onClick={handleAddToCart}>
                  <ShoppingCart className="w-5 h-5 mr-2" />
                  {added ? 'Added!' : adding ? 'Adding…' : 'Add to Cart'}
                </Button>
                <Link to="/store/cart" className="flex-1">
                  <Button size="lg" variant="outline" className="w-full" disabled={!product.in_stock}>Buy Now</Button>
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
