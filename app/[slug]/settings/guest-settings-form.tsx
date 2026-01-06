'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, User, Phone, Mail, Loader2, Check, AlertTriangle, Trash2, MapPin, Lock, Eye, EyeOff, Save, Globe } from 'lucide-react'
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
import { Tenant, Profile } from '@/types/database'
import { GuestLocationSelector } from '@/components/guest-location-selector'
import { LanguageSwitcher } from '@/components/language-switcher'
import { useTranslations } from 'next-intl'
import { useLanguage } from '@/components/providers/language-provider'

interface GuestSettingsFormProps {
  slug: string
  tenant: Tenant
  profile: Profile
  isEmailUser: boolean
}

export function GuestSettingsForm({ slug, tenant, profile, isEmailUser }: GuestSettingsFormProps) {
  const supabase = createClient()
  const t = useTranslations('settings')
  const { locale } = useLanguage()

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
    province: profile.province || '',
    district: profile.district || '',
    sub_district: profile.sub_district || '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate required fields
    if (!formData.phone?.trim() || formData.phone.trim().length < 10) {
      setError(locale === 'th' ? 'กรุณากรอกเบอร์โทรศัพท์ที่ถูกต้อง (อย่างน้อย 10 หลัก)' : 'Please enter a valid phone number (at least 10 digits)')
      return
    }

    if (!formData.province) {
      setError(locale === 'th' ? 'กรุณาเลือกจังหวัด' : 'Please select your province')
      return
    }

    setIsSaving(true)
    setError(null)
    setSuccess(false)

    try {
      // Use API route for reliable update
      const response = await fetch('/api/profile/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: formData.phone,
          province: formData.province,
          district: formData.district || null,
          sub_district: formData.sub_district || null,
        }),
      })

      // Also update other fields directly
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name || null,
          avatar_url: formData.avatar_url || null,
        })
        .eq('id', profile.id)

      if (!response.ok || updateError) {
        setError(locale === 'th' ? 'บันทึกไม่สำเร็จ กรุณาลองใหม่' : 'Failed to update profile. Please try again.')
      } else {
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
      }
    } catch {
      setError(locale === 'th' ? 'เกิดข้อผิดพลาด กรุณาลองใหม่' : 'Something went wrong. Please try again.')
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
        body: JSON.stringify({ isHostAction: false })
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete account')
      }

      // Redirect to home page with a message
      window.location.href = `/${slug}?deleted=true`
    } catch (err) {
      console.error('Delete account error:', err)
      setError(locale === 'th' ? 'ลบบัญชีไม่สำเร็จ กรุณาลองใหม่หรือติดต่อฝ่ายสนับสนุน' : 'Failed to delete account. Please try again or contact support.')
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
      setPasswordError(locale === 'th' ? 'กรุณากรอกรหัสผ่านปัจจุบัน' : 'Please enter your current password')
      return
    }

    if (passwordData.newPassword.length < 6) {
      setPasswordError(locale === 'th' ? 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' : 'New password must be at least 6 characters')
      return
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError(locale === 'th' ? 'รหัสผ่านใหม่ไม่ตรงกัน' : 'New passwords do not match')
      return
    }

    if (passwordData.currentPassword === passwordData.newPassword) {
      setPasswordError(locale === 'th' ? 'รหัสผ่านใหม่ต้องไม่เหมือนรหัสผ่านเดิม' : 'New password must be different from current password')
      return
    }

    setIsChangingPassword(true)

    try {
      // First, verify current password by re-authenticating
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: passwordData.currentPassword,
      })

      if (signInError) {
        setPasswordError(locale === 'th' ? 'รหัสผ่านปัจจุบันไม่ถูกต้อง' : 'Current password is incorrect')
        setIsChangingPassword(false)
        return
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      })

      if (updateError) {
        setPasswordError(updateError.message || (locale === 'th' ? 'เปลี่ยนรหัสผ่านไม่สำเร็จ' : 'Failed to update password'))
        setIsChangingPassword(false)
        return
      }

      // Success
      setPasswordSuccess(true)
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setTimeout(() => setPasswordSuccess(false), 5000)
    } catch {
      setPasswordError(locale === 'th' ? 'เกิดข้อผิดพลาด กรุณาลองใหม่' : 'Something went wrong. Please try again.')
    } finally {
      setIsChangingPassword(false)
    }
  }

  const getInitials = (name: string | null) => {
    if (!name) return 'U'
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <div className="bg-white border-b border-stone-200">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-4">
          <Link 
            href={`/${slug}`}
            className="inline-flex items-center gap-2 text-stone-600 hover:text-stone-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {locale === 'th' ? 'กลับไป' : 'Back to'} {tenant.name}
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-900">{t('title')}</h1>
          <p className="text-stone-600 mt-1">{t('subtitle')}</p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Profile Card */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {t('profile')}
              </CardTitle>
              <CardDescription>
                {t('profileDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar Section */}
              <div className="flex items-center gap-6">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={formData.avatar_url} alt={formData.full_name} />
                  <AvatarFallback 
                    className="text-xl font-medium text-white"
                    style={{ backgroundColor: tenant.primary_color }}
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
                <Label htmlFor="full_name">{locale === 'th' ? 'ชื่อ-นามสกุล' : 'Full Name'}</Label>
                <Input
                  id="full_name"
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder={locale === 'th' ? 'กรอกชื่อ-นามสกุล' : 'Enter your full name'}
                />
              </div>

              {/* Email (Read-only) */}
              <div className="space-y-2">
                <Label htmlFor="email">{locale === 'th' ? 'อีเมล' : 'Email Address'}</Label>
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
                  {locale === 'th' ? 'ไม่สามารถเปลี่ยนอีเมลได้ ติดต่อฝ่ายสนับสนุนหากต้องการเปลี่ยน' : 'Email cannot be changed. Contact support if you need to update it.'}
                </p>
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label htmlFor="phone">{locale === 'th' ? 'เบอร์โทรศัพท์' : 'Phone Number'} <span className="text-red-500">*</span></Label>
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
              </div>
            </CardContent>
          </Card>

          {/* Location Card */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                {locale === 'th' ? 'ที่อยู่' : 'Location'}
              </CardTitle>
              <CardDescription>
                {locale === 'th' ? 'ที่อยู่ของคุณช่วยให้เราเข้าใจว่าแขกมาจากที่ไหน' : 'Your location helps us understand where our guests come from'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Searchable Location Selector */}
              <GuestLocationSelector
                province={formData.province}
                district={formData.district}
                subDistrict={formData.sub_district}
                onProvinceChange={(value) => setFormData({ 
                  ...formData, 
                  province: value, 
                  district: '', 
                  sub_district: '' 
                })}
                onDistrictChange={(value) => setFormData({ 
                  ...formData, 
                  district: value, 
                  sub_district: '' 
                })}
                onSubDistrictChange={(value) => setFormData({ 
                  ...formData, 
                  sub_district: value 
                })}
                primaryColor={tenant.primary_color}
              />

              {/* Error/Success Messages */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {success && (
                <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4" />
                  {locale === 'th' ? 'บันทึกโปรไฟล์สำเร็จ!' : 'Profile updated successfully!'}
                </div>
              )}

              <Button 
                type="submit" 
                disabled={isSaving}
                style={{ backgroundColor: tenant.primary_color }}
                className="text-white cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {locale === 'th' ? 'กำลังบันทึก...' : 'Saving...'}
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {locale === 'th' ? 'บันทึก' : 'Save Changes'}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </form>

        {/* Change Password Card - Only for email users */}
        {isEmailUser && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                {locale === 'th' ? 'เปลี่ยนรหัสผ่าน' : 'Change Password'}
              </CardTitle>
              <CardDescription>
                {locale === 'th' ? 'อัปเดตรหัสผ่านเพื่อความปลอดภัยของบัญชี' : 'Update your password to keep your account secure'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                {/* Current Password */}
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">{locale === 'th' ? 'รหัสผ่านปัจจุบัน' : 'Current Password'}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                    <Input
                      id="currentPassword"
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                      placeholder={locale === 'th' ? 'กรอกรหัสผ่านปัจจุบัน' : 'Enter current password'}
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
                  <Label htmlFor="newPassword">{locale === 'th' ? 'รหัสผ่านใหม่' : 'New Password'}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                    <Input
                      id="newPassword"
                      type={showNewPassword ? 'text' : 'password'}
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                      placeholder={locale === 'th' ? 'กรอกรหัสผ่านใหม่' : 'Enter new password'}
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
                  <p className="text-xs text-stone-500">{locale === 'th' ? 'ต้องมีอย่างน้อย 6 ตัวอักษร' : 'Must be at least 6 characters'}</p>
                </div>

                {/* Confirm New Password */}
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">{locale === 'th' ? 'ยืนยันรหัสผ่านใหม่' : 'Confirm New Password'}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                      placeholder={locale === 'th' ? 'ยืนยันรหัสผ่านใหม่' : 'Confirm new password'}
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
                    {locale === 'th' ? 'เปลี่ยนรหัสผ่านสำเร็จ!' : 'Password changed successfully!'}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isChangingPassword || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                  style={{ backgroundColor: tenant.primary_color }}
                  className="text-white cursor-pointer"
                >
                  {isChangingPassword ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {locale === 'th' ? 'กำลังเปลี่ยน...' : 'Changing Password...'}
                    </>
                  ) : (
                    <>
                      <Lock className="mr-2 h-4 w-4" />
                      {locale === 'th' ? 'เปลี่ยนรหัสผ่าน' : 'Change Password'}
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Language Settings */}
        <Card className="mt-6">
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
            <LanguageSwitcher variant="minimal" primaryColor={tenant.primary_color} />
          </CardContent>
        </Card>

        {/* Danger Zone - Delete Account */}
        <Card className="mt-6 border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              {locale === 'th' ? 'โซนอันตราย' : 'Danger Zone'}
            </CardTitle>
            <CardDescription>
              {locale === 'th' ? 'การกระทำที่ไม่สามารถย้อนกลับได้' : 'Irreversible and destructive actions'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-red-50 rounded-lg border border-red-100">
              <div>
                <h4 className="font-medium text-red-900">{locale === 'th' ? 'ลบบัญชี' : 'Delete Account'}</h4>
                <p className="text-sm text-red-700 mt-1">
                  {locale === 'th' ? 'ลบบัญชีและข้อมูลทั้งหมดอย่างถาวร รวมถึงการจองและรีวิว' : 'Permanently delete your account and all associated data including bookings and reviews.'}
                </p>
              </div>
              <Button 
                variant="destructive" 
                onClick={() => setShowDeleteDialog(true)}
                className="flex-shrink-0 cursor-pointer"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {locale === 'th' ? 'ลบบัญชี' : 'Delete Account'}
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
              {locale === 'th' ? 'ลบบัญชี' : 'Delete Account'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {locale === 'th' ? 'การกระทำนี้ไม่สามารถย้อนกลับได้ บัญชีและข้อมูลทั้งหมดจะถูกลบอย่างถาวร' : 'This action cannot be undone. This will permanently delete your account and remove all your data.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="text-sm text-stone-600">
              <p className="mb-2">{locale === 'th' ? 'ข้อมูลต่อไปนี้จะถูกลบอย่างถาวร:' : 'The following data will be permanently deleted:'}</p>
              <ul className="list-disc list-inside space-y-1">
                <li>{locale === 'th' ? 'ข้อมูลโปรไฟล์ของคุณ' : 'Your profile information'}</li>
                <li>{locale === 'th' ? 'ประวัติการจองทั้งหมด' : 'All your booking history'}</li>
                <li>{locale === 'th' ? 'รีวิวที่คุณเขียน' : 'Any reviews you have written'}</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirm-email" className="text-stone-700 text-sm">
                {locale === 'th' ? 'กรุณาพิมพ์' : 'Please type'} <span className="font-semibold">{profile.email}</span> {locale === 'th' ? 'เพื่อยืนยัน:' : 'to confirm:'}
              </Label>
              <Input
                id="confirm-email"
                type="email"
                value={deleteConfirmEmail}
                onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                placeholder={locale === 'th' ? 'กรอกอีเมลของคุณ' : 'Enter your email'}
              />
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmEmail('')}>
              {locale === 'th' ? 'ยกเลิก' : 'Cancel'}
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
                  {locale === 'th' ? 'กำลังลบ...' : 'Deleting...'}
                </>
              ) : (
                locale === 'th' ? 'ลบบัญชีของฉัน' : 'Delete My Account'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

