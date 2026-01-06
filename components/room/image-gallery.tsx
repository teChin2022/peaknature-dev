'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, X, Grid3X3, ZoomIn } from 'lucide-react'

interface ImageGalleryProps {
  images: string[]
  roomName: string
}

export function ImageGallery({ images, roomName }: ImageGalleryProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoaded, setIsLoaded] = useState(false)
  const [direction, setDirection] = useState<'left' | 'right' | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  const openGallery = (index: number = 0) => {
    setCurrentIndex(index)
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

  // Handle keyboard navigation
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

  // Close on overlay click
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      closeGallery()
    }
  }

  return (
    <>
      {/* Bento Grid Layout */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 rounded-2xl overflow-hidden">
        {/* Main Large Image */}
        <div 
          className="relative col-span-2 row-span-2 aspect-[4/3] cursor-pointer group"
          onClick={() => openGallery(0)}
        >
          <Image
            src={images[0]}
            alt={roomName}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            placeholder="blur"
            blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAUH/8QAIhAAAgEDBAMBAAAAAAAAAAAAAQIDAAQRBQYSIRMxQXH/xAAVAQEBAAAAAAAAAAAAAAAAAAADBP/EABkRAAIDAQAAAAAAAAAAAAAAAAECAAMRIf/aAAwDAQACEQMRAD8Aw63t7m6uIreGNnmkcIiqOyT0B+1b3tvYsWmbatrS8jEVzBbRRyqHBwwUdH/aUoVdnIbH/9k="
            loading="eager"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="absolute bottom-4 left-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <ZoomIn className="h-5 w-5 text-white drop-shadow-lg" />
          </div>
        </div>

        {/* Secondary Images */}
        {images.slice(1, 5).map((image, index) => (
          <div 
            key={index} 
            className={`relative aspect-[4/3] cursor-pointer group ${index >= 2 ? 'hidden md:block' : ''}`}
            onClick={() => openGallery(index + 1)}
          >
            <Image
              src={image}
              alt={`${roomName} - Image ${index + 2}`}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
              placeholder="blur"
              blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAUH/8QAIhAAAgEDBAMBAAAAAAAAAAAAAQIDAAQRBQYSIRMxQXH/xAAVAQEBAAAAAAAAAAAAAAAAAAADBP/EABkRAAIDAQAAAAAAAAAAAAAAAAECAAMRIf/aAAwDAQACEQMRAD8Aw63t7m6uIreGNnmkcIiqOyT0B+1b3tvYsWmbatrS8jEVzBbRRyqHBwwUdH/aUoVdnIbH/9k="
              sizes="(max-width: 768px) 50vw, 25vw"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
            
            {/* Show "View all" button on last visible image */}
            {((index === 1 && images.length > 3) || (index === 3 && images.length > 5)) && (
              <div 
                className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                onClick={(e) => {
                  e.stopPropagation()
                  openGallery(0)
                }}
              >
                <div className="text-center text-white">
                  <Grid3X3 className="h-8 w-8 mx-auto mb-2" />
                  <span className="text-sm font-medium">+{images.length - (index + 2)} more</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* View All Button - Shows on mobile or when there are many images */}
      {images.length > 1 && (
        <Button 
          variant="outline" 
          className="mt-3 w-full md:w-auto bg-white hover:bg-stone-50 border-stone-300"
          onClick={() => openGallery(0)}
        >
          <Grid3X3 className="h-4 w-4 mr-2" />
          View all {images.length} photos
        </Button>
      )}

      {/* Full Screen Gallery Modal - Clean White Design */}
      {isOpen && (
        <div 
          ref={overlayRef}
          onClick={handleOverlayClick}
          className="fixed inset-0 z-[9999] bg-white/80 backdrop-blur-xl animate-in fade-in duration-200"
          role="dialog"
          aria-label={`${roomName} - Photo Gallery`}
        >
          {/* Close Button - Top Right */}
          <button
            onClick={closeGallery}
            className="absolute top-4 right-4 md:top-6 md:right-6 z-30 p-2 rounded-full text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-all bg-white/80 backdrop-blur-sm shadow-md"
            aria-label="Close gallery"
          >
            <X className="h-6 w-6" />
          </button>

          {/* Centered Content Container */}
          <div className="absolute inset-0 flex flex-col items-center justify-center py-6 md:py-12 px-0">
            {/* Header - Above Image */}
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

              {/* Navigation Arrows - On sides of image */}
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

            {/* Thumbnail Strip - Below Image */}
            <div className="mt-4 md:mt-6 w-full max-w-3xl">
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
                    aria-current={index === currentIndex}
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

