'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

interface RoomCardImageProps {
  images: string[]
  roomName: string
}

export function RoomCardImage({ images, roomName }: RoomCardImageProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoaded, setIsLoaded] = useState(false)
  const [direction, setDirection] = useState<'left' | 'right' | null>(null)

  const displayImage = images[0] || 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&q=80'

  const openGallery = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setCurrentIndex(0)
    setIsOpen(true)
    setIsLoaded(false)
    document.body.style.overflow = 'hidden'
  }

  const closeGallery = () => {
    setIsOpen(false)
    document.body.style.overflow = ''
  }

  const nextImage = useCallback(() => {
    setDirection('right')
    setIsLoaded(false)
    setCurrentIndex((prev) => (prev + 1) % images.length)
  }, [images.length])

  const prevImage = useCallback(() => {
    setDirection('left')
    setIsLoaded(false)
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length)
  }, [images.length])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') nextImage()
      if (e.key === 'ArrowLeft') prevImage()
      if (e.key === 'Escape') closeGallery()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, nextImage, prevImage])

  return (
    <>
      {/* Image Container */}
      <div 
        className="relative w-full h-full min-h-[200px] md:min-h-[240px] aspect-[16/10] md:aspect-auto overflow-hidden cursor-pointer group/image"
        onClick={openGallery}
      >
        <Image
          src={displayImage}
          alt={roomName}
          fill
          className="object-cover transition-transform duration-500 group-hover/image:scale-105"
        />
        <div className="absolute inset-0 bg-black/0 group-hover/image:bg-black/10 transition-colors" />
        {images.length > 1 && (
          <Badge className="absolute bottom-3 left-3 bg-black/60 hover:bg-black/70 text-white border-0 cursor-pointer">
            +{images.length - 1} photos
          </Badge>
        )}
      </div>

      {/* Full Screen Gallery Modal */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-[9999] bg-white/80 backdrop-blur-xl animate-in fade-in duration-200"
          onClick={closeGallery}
          role="dialog"
          aria-label={`${roomName} - Photo Gallery`}
        >
          {/* Close Button */}
          <button
            onClick={closeGallery}
            className="absolute top-4 right-4 md:top-6 md:right-6 z-30 p-2 rounded-full text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-all bg-white/80 backdrop-blur-sm shadow-md"
            aria-label="Close gallery"
          >
            <X className="h-6 w-6" />
          </button>

          {/* Content Container */}
          <div 
            className="absolute inset-0 flex flex-col items-center justify-center py-6 md:py-12 px-0"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="mb-4 text-center">
              <span className="text-stone-800 text-sm font-semibold">
                {currentIndex + 1} / {images.length}
              </span>
              <span className="hidden md:inline text-stone-400 mx-2">•</span>
              <span className="hidden md:inline text-stone-500 text-sm">
                {roomName}
              </span>
            </div>

            {/* Main Image */}
            <div className="relative flex-1 w-full max-w-6xl flex items-center justify-center px-4 md:px-16">
              <div 
                className={`bg-white rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 ${
                  isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                } ${
                  direction === 'right' ? 'animate-in slide-in-from-right-4' : 
                  direction === 'left' ? 'animate-in slide-in-from-left-4' : ''
                }`}
              >
                <Image
                  src={images[currentIndex]}
                  alt={`${roomName} - Image ${currentIndex + 1}`}
                  width={1200}
                  height={800}
                  className="w-auto h-auto max-w-full max-h-[70vh] object-contain"
                  onLoad={() => setIsLoaded(true)}
                  loading="eager"
                  quality={90}
                />
              </div>

              {/* Navigation Arrows */}
              {images.length > 1 && (
                <>
                  <button
                    onClick={prevImage}
                    className="absolute -left-2 md:left-0 top-1/2 -translate-y-1/2 z-20 p-2 md:p-3 rounded-full bg-white/90 hover:bg-white text-stone-600 hover:text-stone-900 transition-all shadow-lg border border-stone-200"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="h-5 w-5 md:h-6 md:w-6" />
                  </button>
                  <button
                    onClick={nextImage}
                    className="absolute -right-2 md:right-0 top-1/2 -translate-y-1/2 z-20 p-2 md:p-3 rounded-full bg-white/90 hover:bg-white text-stone-600 hover:text-stone-900 transition-all shadow-lg border border-stone-200"
                    aria-label="Next image"
                  >
                    <ChevronRight className="h-5 w-5 md:h-6 md:w-6" />
                  </button>
                </>
              )}

              {/* Loading Spinner */}
              {!isLoaded && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-8 w-8 border-2 border-stone-200 border-t-stone-600 rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Thumbnail Strip */}
            <div className="mt-4 md:mt-6 w-full max-w-3xl px-4">
              <div className="flex gap-2 md:gap-3 justify-center overflow-x-auto py-2">
                {images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setDirection(index > currentIndex ? 'right' : 'left')
                      setIsLoaded(false)
                      setCurrentIndex(index)
                    }}
                    className={`relative flex-shrink-0 rounded-xl overflow-hidden transition-all duration-200 ${
                      index === currentIndex 
                        ? 'w-16 h-12 md:w-20 md:h-14 ring-2 ring-stone-800 shadow-lg' 
                        : 'w-14 h-10 md:w-16 md:h-12 opacity-50 hover:opacity-100 shadow-md'
                    }`}
                    aria-label={`View image ${index + 1}`}
                  >
                    <Image
                      src={image}
                      alt={`Thumbnail ${index + 1}`}
                      fill
                      className="object-cover"
                      sizes="80px"
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

