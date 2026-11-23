import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import { ShoppingCart, ChevronLeft, ChevronRight } from 'lucide-react';
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
  category?: { name: string };
  in_stock: boolean;
  is_active: boolean;
}

export function Store() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState('All');
  const [activeImageByProduct, setActiveImageByProduct] = useState<Record<string, number>>({});
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const markFailed = (url: string) => setFailedImages((prev) => new Set(prev).add(url));

  useEffect(() => {
    api.get<Product[]>('/products')
      .then(setProducts)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const categories = ['All', ...new Set(products.map((p) => p.category?.name ?? 'Uncategorized'))];
  const filteredProducts = filter === 'All'
    ? products
    : products.filter((p) => (p.category?.name ?? 'Uncategorized') === filter);

  const getProductImages = (product: Product) => {
    const all = product.image_urls && product.image_urls.length > 0
      ? product.image_urls
      : (product.image_url ? [product.image_url] : []);
    return all;
  };

  const setActiveImage = (productId: string, idx: number) => {
    setActiveImageByProduct((prev) => ({ ...prev, [productId]: idx }));
  };

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <h1 className="text-5xl mb-4 text-center">Store</h1>
          <p className="text-xl text-black/60 text-center mb-12">Professional services and educational resources</p>

          <div className="flex flex-wrap gap-2 justify-center mb-12">
            {categories.map((c) => (
              <Button key={c} variant={filter === c ? 'default' : 'outline'} onClick={() => setFilter(c)}>{c}</Button>
            ))}
          </div>

          {loading && <p className="text-center text-black/40 py-20">Loading products…</p>}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredProducts.map((product, index) => (
              <motion.div key={product.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: index * 0.1 }}>
                <GlassCard className="overflow-hidden h-full flex flex-col" hover>
                  <div className="bg-gradient-to-br from-primary/20 to-primary/5 overflow-hidden">
                    {(() => {
                      const images = getProductImages(product);
                      const activeIdx = Math.min(activeImageByProduct[product.id] ?? 0, Math.max(images.length - 1, 0));
                      const activeUrl = images[activeIdx];
                      return (
                        <>
                          <div className="h-40 flex items-center justify-center overflow-hidden">
                            {activeUrl && !failedImages.has(activeUrl) ? (
                              <img
                                src={activeUrl}
                                alt={product.name}
                                className="h-full w-full object-cover"
                                referrerPolicy="no-referrer"
                                crossOrigin="anonymous"
                                onError={() => markFailed(activeUrl)}
                              />
                            ) : (
                              <ShoppingCart className="w-16 h-16 text-primary/50" />
                            )}
                          </div>
                          {images.length > 1 && (
                            <div className="px-2 py-2 border-t border-black/10 bg-white/60">
                              <div className="flex items-center gap-1 mb-2">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => setActiveImage(product.id, activeIdx === 0 ? images.length - 1 : activeIdx - 1)}
                                >
                                  <ChevronLeft className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => setActiveImage(product.id, activeIdx === images.length - 1 ? 0 : activeIdx + 1)}
                                >
                                  <ChevronRight className="w-3 h-3" />
                                </Button>
                                <span className="text-[10px] text-black/50 ml-auto">{activeIdx + 1}/{images.length}</span>
                              </div>
                              <div className="flex gap-1 overflow-x-auto">
                                {images.map((url, idx) => (
                                  <button
                                    key={`${product.id}-${idx}`}
                                    onClick={() => setActiveImage(product.id, idx)}
                                    className={`w-10 h-10 rounded overflow-hidden border flex-shrink-0 bg-black/5 flex items-center justify-center ${idx === activeIdx ? 'border-primary' : 'border-black/10'}`}
                                  >
                                    {failedImages.has(url) ? (
                                      <ShoppingCart className="w-4 h-4 text-primary/40" />
                                    ) : (
                                      <img
                                        src={url}
                                        alt={`${product.name} ${idx + 1}`}
                                        className="h-full w-full object-cover"
                                        referrerPolicy="no-referrer"
                                        crossOrigin="anonymous"
                                        onError={() => markFailed(url)}
                                      />
                                    )}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                  <div className="p-6 flex-1 flex flex-col">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-xl flex-1">{product.name}</h3>
                      {!product.in_stock && (
                        <span className="text-xs px-2 py-1 bg-black/5 border border-black/10 rounded">Out of Stock</span>
                      )}
                    </div>
                    <p className="text-sm text-primary mb-3">{product.category?.name ?? 'Uncategorized'}</p>
                    <p className="text-black/60 mb-4 flex-1">{product.description}</p>
                    <div className="flex items-center justify-between mt-auto">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">${Number(product.discounted_price ?? product.price).toLocaleString()}</span>
                        {product.original_price != null && Number(product.original_price) > Number(product.discounted_price ?? product.price) && (
                          <span className="text-sm text-black/40 line-through">${Number(product.original_price).toLocaleString()}</span>
                        )}
                      </div>
                      <Link to={`/store/product/${product.id}`}>
                        <Button disabled={!product.in_stock}>View Details</Button>
                      </Link>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>

          {!loading && filteredProducts.length === 0 && (
            <p className="text-center text-black/40 py-20">No products found.</p>
          )}
        </motion.div>
      </div>
    </div>
  );
}
