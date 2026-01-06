import Link from 'next/link'
import { Home } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        {/* 404 Illustration */}
        <div className="mb-8">
          <div className="text-9xl font-bold text-stone-200 select-none">404</div>
        </div>

        {/* Message */}
        <h1 className="text-2xl font-bold text-stone-900 mb-3">
          Page Not Found
        </h1>
        <p className="text-stone-600 mb-8">
          Sorry, the page you are looking for doesn&apos;t exist or has been moved.
        </p>

        {/* Action */}
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-stone-900 text-white rounded-lg hover:bg-stone-800 transition-colors font-medium"
        >
          <Home className="h-4 w-4" />
          Go Home
        </Link>
      </div>
    </div>
  )
}
