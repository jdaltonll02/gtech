import { motion } from 'motion/react';
import { useMemo, useState, useEffect } from 'react';
import Masonry from 'react-responsive-masonry';
import { X } from 'lucide-react';
import { Button } from '../components/ui/button';
import { GlassCard } from '../components/glass-card';
import { api } from '../utils/api';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';

type MediaItem = {
  id: string;
  filename: string;
  original_filename: string;
  content_type: string;
  size_bytes: number;
  url: string;
  folder?: string;
};

export function Gallery() {
  const [filter, setFilter] = useState<string>('All');
  const [selectedImage, setSelectedImage] = useState<MediaItem | null>(null);
  const [images, setImages] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<MediaItem[]>('/media/?limit=500')
      .then(setImages)
      .catch((e) => setError(e.message || 'Failed to load gallery media.'))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => {
    return ['All', ...new Set(images.map((img) => img.folder || 'uploads'))];
  }, [images]);

  const filteredImages = filter === 'All'
    ? images
    : images.filter((img) => (img.folder || 'uploads') === filter);

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-5xl mb-4 text-center">Gallery</h1>
          <p className="text-xl text-black/60 text-center mb-12">Media served from backend storage</p>

          <div className="mb-12">
            <div className="flex flex-wrap gap-2 justify-center">
              {categories.map((category) => (
                <Button
                  key={category}
                  variant={filter === category ? 'default' : 'outline'}
                  onClick={() => setFilter(category)}
                >
                  {category}
                </Button>
              ))}
            </div>
          </div>

          {loading && (
            <div className="text-center py-20">
              <p className="text-black/50">Loading gallery images...</p>
            </div>
          )}

          {!loading && error && (
            <div className="text-center py-10">
              <p className="text-red-500">{error}</p>
            </div>
          )}

          {!loading && !error && filteredImages.length > 0 && (
            <Masonry columnsCount={3} gutter="1rem">
              {filteredImages.map((image, index) => (
                <motion.div
                  key={image.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, delay: index * 0.03 }}
                  onClick={() => setSelectedImage(image)}
                  className="cursor-pointer"
                >
                  <GlassCard className="overflow-hidden" hover>
                    <ImageWithFallback
                      src={image.url}
                      alt={image.original_filename}
                      className="w-full h-auto object-cover"
                    />
                    <div className="p-3">
                      <p className="text-sm text-primary">{image.folder || 'uploads'}</p>
                      <p className="text-xs text-black/50 truncate">{image.original_filename}</p>
                    </div>
                  </GlassCard>
                </motion.div>
              ))}
            </Masonry>
          )}

          {!loading && !error && filteredImages.length === 0 && (
            <div className="text-center py-20">
              <p className="text-black/50">No media found. Upload files from the admin/backend media endpoint.</p>
            </div>
          )}
        </motion.div>
      </div>

      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="relative max-w-5xl max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              aria-label="Close image preview"
              title="Close image preview"
              onClick={() => setSelectedImage(null)}
              className="absolute -top-12 right-0 text-white/80 hover:text-white"
            >
              <X className="w-8 h-8" />
            </button>
            <img
              src={selectedImage.url}
              alt={selectedImage.original_filename}
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
            <div className="mt-4 text-center">
              <p className="text-white/90">{selectedImage.original_filename}</p>
              <p className="text-white/60 text-sm">{selectedImage.folder || 'uploads'}</p>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
