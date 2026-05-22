import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0c0a14] text-white">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-violet-500 mb-4">404</h1>
        <h2 className="text-2xl font-semibold mb-2">Page Not Found</h2>
        <p className="text-gray-400 mb-8">The page you are looking for does not exist.</p>
        <Link href="/" className="px-6 py-3 bg-violet-600 hover:bg-violet-500 rounded-xl text-sm font-semibold transition-colors">
          Go Home
        </Link>
      </div>
    </div>
  )
}