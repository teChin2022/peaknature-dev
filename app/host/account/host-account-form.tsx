'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft, User, Phone, Mail, Loader2, Check, AlertTriangle, 
  Trash2, Lock, Eye, EyeOff, Save, Globe, Building2, ExternalLink
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { createClient } from '@/lib/supabase/client'
import { Profile, Tenant } from '@/types/database'
import { LanguageSwitcher } from '@/components/language-switcher'
import { useTranslations } from 'next-intl'

interface HostAccountFormProps {
  profile: Profile
  tenant: Tenant | null
  isEmailUser: boolean
}

export function HostAccountForm({ profile, tenant, isEmailUser }: HostAccountFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const t = useTranslations('hostAccount')
  const tAuth = useTranslations('auth')
  const tErrors = useTranslations('errors')
  const tCommon = useTranslations('common')

  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('')

  // Password change state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    full_name: profile.full_name || '',
    phone: profile.phone || '',
    avatar_url: profile.avatar_url || '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name || null,
          phone: formData.phone || null,
          avatar_url: formData.avatar_url || null,
        })
        .eq('id', profile.id)

      if (updateError) {
        setError(tErrors('somethingWrong'))
      } else {
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
        router.refresh()
      }
    } catch {
      setError(tErrors('somethingWrong'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmEmail !== profile.email) return

    setIsDeleting(true)
    setError(null)

    try {
      const response = await fetch('/api/user/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isHostAction: true })
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete account')
      }

      // Redirect to home page
      window.location.href = '/?deleted=true'
    } catch (err) {
      console.error('Delete account error:', err)
      setError(tErrors('somethingWrong'))
      setIsDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(false)

    // Validate passwords
    if (!passwordData.currentPassword) {
      setPasswordError(tErrors('required'))
      return
    }

    if (passwordData.newPassword.length < 6) {
      setPasswordError(tErrors('passwordMin'))
      return
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError(tErrors('passwordMismatch'))
      return
    }

    if (passwordData.currentPassword === passwordData.newPassword) {
      setPasswordError(tErrors('samePassword'))
      return
    }

    setIsChangingPassword(true)

    try {
      // Verify current password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: passwordData.currentPassword,
      })

      if (signInError) {
        setPasswordError(tErrors('incorrectPassword'))
        setIsChangingPassword(false)
        return
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      })

      if (updateError) {
        setPasswordError(updateError.message || tErrors('somethingWrong'))
        setIsChangingPassword(false)
        return
      }

      // Success
      setPasswordSuccess(true)
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setTimeout(() => setPasswordSuccess(false), 5000)
    } catch {
      setPasswordError(tErrors('somethingWrong'))
    } finally {
      setIsChangingPassword(false)
    }
  }

  const getInitials = (name: string | null) => {
    if (!name) return 'H'
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const primaryColor = tenant?.primary_color || '#10B981'

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      {/* Header */}
      <div className="bg-white border-b border-stone-200 shadow-sm">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            {tenant ? (
              <Link 
                href={`/${tenant.slug}/dashboard`}
                className="inline-flex items-center gap-2 text-stone-600 hover:text-stone-900 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                {t('backToDashboard')}
              </Link>
            ) : (
              <Link 
                href="/host/login"
                className="inline-flex items-center gap-2 text-stone-600 hover:text-stone-900 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                {tCommon('back')}
              </Link>
            )}
            
            {tenant && (
              <a
                href={`/${tenant.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-700 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                {t('viewProperty')}
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
        {/* Page Header */}
        <div className="mb-8 text-center sm:text-left">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 mb-4">
            <User className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-900">{t('title')}</h1>
          <p className="text-stone-600 mt-1">{t('subtitle')}</p>
        </div>

        {/* Property Info Banner */}
        {tenant && (
          <Card className="mb-6 border-emerald-200 bg-emerald-50/50">
            <CardContent className="py-4">
              <div className="flex items-center gap-4">
                <div 
                  className="h-12 w-12 rounded-lg flex items-center justify-center text-white font-bold text-lg"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Building2 className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-stone-500">{t('managingProperty')}</p>
                  <p className="font-semibold text-stone-900 truncate">{tenant.name}</p>
                </div>
                <Link 
                  href={`/${tenant.slug}/dashboard/settings`}
                  className="text-sm text-emerald-600 hover:text-emerald-700 font-medium whitespace-nowrap"
                >
                  {t('propertySettings')} →
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        <form onSubmit={handleSubmit}>
          {/* Profile Card */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {t('personalInfo')}
              </CardTitle>
              <CardDescription>
                {t('personalInfoDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar Section */}
              <div className="flex items-center gap-6">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={formData.avatar_url} alt={formData.full_name} />
                  <AvatarFallback 
                    className="text-xl font-medium text-white bg-gradient-to-br from-emerald-500 to-teal-600"
                  >
                    {getInitials(formData.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <Label htmlFor="avatar_url">{t('profilePhoto')}</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      id="avatar_url"
                      type="url"
                      value={formData.avatar_url}
                      onChange={(e) => setFormData({ ...formData, avatar_url: e.target.value })}
                      placeholder="https://example.com/photo.jpg"
                      className="flex-1"
                    />
                  </div>
                  <p className="text-xs text-stone-500 mt-1">
                    {t('profilePhotoHint')}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="full_name">{t('fullName')}</Label>
                <Input
                  id="full_name"
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder={tAuth('fullName')}
                />
              </div>

              {/* Email (Read-only) */}
              <div className="space-y-2">
                <Label htmlFor="email">{t('email')}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                  <Input
                    id="email"
                    type="email"
                    value={profile.email}
                    disabled
                    className="pl-10 bg-stone-50 text-stone-500"
                  />
                </div>
                <p className="text-xs text-stone-500">
                  {t('emailHint')}
                </p>
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label htmlFor="phone">{t('phone')}</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+66 812 345 678"
                    className="pl-10"
                  />
                </div>
                <p className="text-xs text-stone-500">
                  {t('phoneHint')}
                </p>
              </div>

              {/* Error/Success Messages */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {success && (
                <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4" />
                  {t('profileUpdated')}
                </div>
              )}

              <Button 
                type="submit" 
                disabled={isSaving}
                className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('saving')}
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {t('saveChanges')}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </form>

        {/* Change Password Card - Only for email users */}
        {isEmailUser && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                {t('changePassword')}
              </CardTitle>
              <CardDescription>
                {t('changePasswordDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                {/* Current Password */}
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">{t('currentPassword')}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                    <Input
                      id="currentPassword"
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                      placeholder={t('currentPassword')}
                      className="pl-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                    >
                      {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div className="space-y-2">
                  <Label htmlFor="newPassword">{t('newPassword')}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                    <Input
                      id="newPassword"
                      type={showNewPassword ? 'text' : 'password'}
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                      placeholder={t('newPassword')}
                      className="pl-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-stone-500">{t('passwordHint')}</p>
                </div>

                {/* Confirm New Password */}
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">{t('confirmNewPassword')}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                      placeholder={t('confirmNewPassword')}
                      className="pl-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Password Error/Success Messages */}
                {passwordError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                    {passwordError}
                  </div>
                )}

                {passwordSuccess && (
                  <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4" />
                    {t('passwordChanged')}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isChangingPassword || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                  className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white"
                >
                  {isChangingPassword ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('changingPassword')}
                    </>
                  ) : (
                    <>
                      <Lock className="mr-2 h-4 w-4" />
                      {t('changePassword')}
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Language Settings */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              {t('language')}
            </CardTitle>
            <CardDescription>
              {t('languageDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LanguageSwitcher variant="minimal" primaryColor={primaryColor} />
          </CardContent>
        </Card>

        {/* Danger Zone - Delete Account */}
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              {t('dangerZone')}
            </CardTitle>
            <CardDescription>
              {t('dangerZoneDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-red-50 rounded-lg border border-red-100">
              <div>
                <h4 className="font-medium text-red-900">{t('deleteAccount')}</h4>
                <p className="text-sm text-red-700 mt-1">
                  {t('deleteAccountDesc')}
                </p>
              </div>
              <Button 
                variant="destructive" 
                onClick={() => setShowDeleteDialog(true)}
                className="flex-shrink-0 cursor-pointer"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t('deleteAccount')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete Account Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              {t('deleteConfirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteConfirmDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="text-sm text-stone-600">
              <p className="mb-2 font-medium">{t('dataToDelete')}</p>
              <ul className="list-disc list-inside space-y-1 text-red-700">
                <li>{t('deleteProfileInfo')}</li>
                {tenant && <li>{t('deleteProperty')}: <strong>{tenant.name}</strong></li>}
                <li>{t('deleteBookings')}</li>
                <li>{t('deleteReviews')}</li>
              </ul>
            </div>
            
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                <strong>{t('warning')}:</strong> {t('deleteWarning')}
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirm-email" className="text-stone-700 text-sm">
                {t('deleteConfirmHint')} <span className="font-semibold">{profile.email}</span> {t('deleteConfirmHint2')}
              </Label>
              <Input
                id="confirm-email"
                type="email"
                value={deleteConfirmEmail}
                onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                placeholder={tAuth('email')}
              />
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmEmail('')}>
              {tCommon('cancel')}
            </AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={deleteConfirmEmail !== profile.email || isDeleting}
              className="cursor-pointer"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('deleting')}
                </>
              ) : (
                t('deleteMyAccount')
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

