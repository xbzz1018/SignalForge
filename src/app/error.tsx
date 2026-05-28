'use client'

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0c0a14] text-white">
      <div className="text-center max-w-md">
        <h1 className="text-5xl font-bold text-violet-500 mb-4">Error</h1>
        <p className="text-gray-400 mb-2 text-sm">{error.message || 'An unexpected error occurred'}</p>
        {error.digest && (
          <p className="text-xs text-gray-600 mb-6">Digest: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="px-6 py-3 bg-violet-600 hover:bg-violet-500 rounded-xl text-sm font-semibold transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  )
}