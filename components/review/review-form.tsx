'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { StarRating } from './star-rating'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'
import type { ExistingReview } from './review-dialog'

interface ReviewFormProps {
  bookingId: string
  roomName: string
  tenantSlug: string
  primaryColor: string
  onSuccess?: (review: ExistingReview) => void
  onCancel?: () => void
}

export function ReviewForm({
  bookingId,
  roomName,
  tenantSlug,
  primaryColor,
  onSuccess,
  onCancel,
}: ReviewFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const t = useTranslations('review')
  
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (rating === 0) {
      setError(t('pleaseSelectRating'))
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        setError(t('pleaseLoginToReview'))
        return
      }

      // Check if review already exists
      const { data: existingCheck } = await supabase
        .from('reviews')
        .select('id')
        .eq('booking_id', bookingId)
        .single()

      if (existingCheck) {
        setError(t('alreadyReviewed'))
        return
      }

      // Submit new review
      const { data: newReview, error: insertError } = await supabase
        .from('reviews')
        .insert({
          booking_id: bookingId,
          user_id: user.id,
          rating,
          comment: comment.trim() || null,
        })
        .select('id, rating, comment, created_at')
        .single()

      if (insertError) {
        console.error('Error submitting review:', insertError)
        // Check for RLS policy error
        if (insertError.code === '42501' || insertError.message?.includes('policy')) {
          setError(t('bookingMustBeCompleted'))
        } else {
          setError(t('failedToSubmitReview'))
        }
        return
      }

      // Success
      if (onSuccess && newReview) {
        onSuccess(newReview)
      } else {
        router.refresh()
      }
    } catch {
      setError(t('failedToSubmitReview'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="text-center pb-4 border-b border-stone-200">
        <h3 className="font-semibold text-stone-900 text-lg">
          {t('howWasYourStay')}
        </h3>
        <p className="text-sm text-stone-600 mt-1">
          {t('rateExperience', { roomName })}
        </p>
      </div>

      {/* Star Rating */}
      <div className="flex flex-col items-center gap-3">
        <Label className="text-sm font-medium text-stone-700">
          {t('yourRating')}
        </Label>
        <StarRating
          rating={rating}
          size="lg"
          interactive
          onRatingChange={setRating}
          primaryColor={primaryColor}
        />
        <p className="text-sm text-stone-500">
          {rating === 0 && t('tapToRate')}
          {rating === 1 && t('ratingPoor')}
          {rating === 2 && t('ratingFair')}
          {rating === 3 && t('ratingGood')}
          {rating === 4 && t('ratingVeryGood')}
          {rating === 5 && t('ratingExcellent')}
        </p>
      </div>

      {/* Comment */}
      <div className="space-y-2">
        <Label htmlFor="comment" className="text-sm font-medium text-stone-700">
          {t('yourReviewOptional')}
        </Label>
        <Textarea
          id="comment"
          placeholder={t('shareExperience')}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          maxLength={500}
          className="resize-none"
        />
        <p className="text-xs text-stone-500 text-right">
          {comment.length}/500 {t('characters')}
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            {t('cancel')}
          </Button>
        )}
        <Button
          type="submit"
          className="flex-1 text-white"
          style={{ backgroundColor: primaryColor }}
          disabled={isSubmitting || rating === 0}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('submitting')}
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              {t('submitReview')}
            </>
          )}
        </Button>
      </div>
    </form>
  )
}

