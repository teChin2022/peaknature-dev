'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { Upload, X, Loader2, ImageIcon, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'

interface RoomImageUploadProps {
  tenantId: string
  roomId?: string
  images: string[]
  onImagesChange: (images: string[]) => void
  primaryColor: string
}

export function RoomImageUpload({ 
  tenantId, 
  roomId,
  images, 
  onImagesChange,
  primaryColor 
}: RoomImageUploadProps) {
  const t = useTranslations('dashboard.roomImageUpload')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{
    current: number
    total: number
    fileName: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)
    setError(null)
    const newImages: string[] = []

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        
        // Validate file type
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
        if (!validTypes.includes(file.type)) {
          setError(`${file.name}: ${t('invalidFileType')}`)
          continue
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          setError(`${file.name}: ${t('fileTooLarge')}`)
          continue
        }

        setUploadProgress({
          current: i + 1,
          total: files.length,
          fileName: file.name
        })

        // Generate unique file name
        const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg'
        const fileName = `${tenantId}/rooms/${roomId || 'new'}_${Date.now()}_${i}.${fileExt}`

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('tenants')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
          })

        if (uploadError) {
          console.error('Upload error:', uploadError)
          setError(t('failedToUploadFile', { fileName: file.name }) + `: ${uploadError.message}`)
          continue
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('tenants')
          .getPublicUrl(fileName)

        newImages.push(publicUrl)
      }

      if (newImages.length > 0) {
        onImagesChange([...images, ...newImages])
      }
    } catch (err) {
      console.error('Upload error:', err)
      setError(t('uploadFailed'))
    } finally {
      setIsUploading(false)
      setUploadProgress(null)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const removeImage = async (imageUrl: string) => {
    // Extract file path from URL
    const urlParts = imageUrl.split('/storage/v1/object/public/tenants/')
    if (urlParts.length > 1) {
      const filePath = urlParts[1]
      
      // Delete from storage
      const { error: deleteError } = await supabase.storage
        .from('tenants')
        .remove([filePath])
      
      if (deleteError) {
        console.error('Delete error:', deleteError)
        // Still remove from UI even if storage delete fails
      }
    }
    
    onImagesChange(images.filter(img => img !== imageUrl))
  }

  const moveImage = (fromIndex: number, toIndex: number) => {
    const newImages = [...images]
    const [movedImage] = newImages.splice(fromIndex, 1)
    newImages.splice(toIndex, 0, movedImage)
    onImagesChange(newImages)
  }

  return (
    <div className="space-y-4">
      {/* Image Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {images.map((url, index) => (
            <div 
              key={url} 
              className="relative group aspect-video rounded-lg overflow-hidden bg-stone-100 border border-stone-200"
            >
              <Image
                src={url}
                alt={`Room image ${index + 1}`}
                fill
                className="object-cover"
                unoptimized
              />
              {/* Cover badge */}
              {index === 0 && (
                <div className="absolute top-2 left-2 px-2 py-1 bg-black/70 text-white text-xs rounded z-10">
                  {t('cover')}
                </div>
              )}
              
              {/* Actions overlay */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                {/* Move buttons */}
                {index > 0 && (
                  <button
                    type="button"
                    onClick={() => moveImage(index, index - 1)}
                    className="p-2 bg-white/90 text-stone-700 rounded-full hover:bg-white transition-colors"
                    title={t('moveLeft')}
                  >
                    <GripVertical className="h-4 w-4 rotate-90" />
                  </button>
                )}
                
                {/* Delete button */}
                <button
                  type="button"
                  onClick={() => removeImage(url)}
                  className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                  title={t('removeImage')}
                >
                  <X className="h-4 w-4" />
                </button>
                
                {/* Move right */}
                {index < images.length - 1 && (
                  <button
                    type="button"
                    onClick={() => moveImage(index, index + 1)}
                    className="p-2 bg-white/90 text-stone-700 rounded-full hover:bg-white transition-colors"
                    title={t('moveRight')}
                  >
                    <GripVertical className="h-4 w-4 -rotate-90" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Area */}
      <div 
        className="relative border-2 border-dashed border-stone-300 rounded-lg p-6 hover:border-stone-400 transition-colors cursor-pointer"
        onClick={() => !isUploading && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp,image/gif,image/avif"
          multiple
          className="hidden"
          onChange={handleFileSelect}
          disabled={isUploading}
        />
        
        <div className="text-center">
          {isUploading ? (
            <div className="space-y-3">
              <Loader2 className="h-10 w-10 mx-auto animate-spin" style={{ color: primaryColor }} />
              <div>
                <p className="font-medium text-stone-900">
                  {t('uploadingProgress', { current: uploadProgress?.current || 0, total: uploadProgress?.total || 0 })}
                </p>
                <p className="text-sm text-stone-500 truncate max-w-xs mx-auto">
                  {uploadProgress?.fileName}
                </p>
              </div>
              {/* Progress bar */}
              <div className="max-w-xs mx-auto h-2 bg-stone-200 rounded-full overflow-hidden">
                <div 
                  className="h-full transition-all duration-300"
                  style={{ 
                    width: `${((uploadProgress?.current || 0) / (uploadProgress?.total || 1)) * 100}%`,
                    backgroundColor: primaryColor 
                  }}
                />
              </div>
            </div>
          ) : (
            <>
              <div 
                className="h-12 w-12 mx-auto rounded-full flex items-center justify-center mb-3"
                style={{ backgroundColor: `${primaryColor}15` }}
              >
                <Upload className="h-6 w-6" style={{ color: primaryColor }} />
              </div>
              <p className="text-stone-900 font-medium">
                {t('clickToUpload')}
              </p>
              <p className="text-sm text-stone-500 mt-1">
                {t('orDragDrop')}
              </p>
              <p className="text-xs text-stone-400 mt-2">
                {t('supportedFormats')}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Help text */}
      <p className="text-xs text-stone-500 flex items-center gap-1">
        <ImageIcon className="h-3 w-3" />
        {t('coverPhotoHint')}
      </p>
    </div>
  )
}

