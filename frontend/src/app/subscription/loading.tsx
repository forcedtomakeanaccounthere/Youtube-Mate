export default function SubscriptionLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 pt-20 pb-12">
        {/* Header Skeleton */}
        <div className="text-center mb-16">
          <div className="h-8 w-40 bg-gradient-to-r from-orange-200 to-red-200 dark:from-gray-700 dark:to-gray-600 rounded-full mx-auto mb-6 animate-pulse" />
          <div className="h-16 w-96 bg-gradient-to-r from-orange-200 to-red-200 dark:from-gray-700 dark:to-gray-600 rounded-2xl mx-auto mb-8 animate-pulse" />
          <div className="h-6 w-80 bg-gradient-to-r from-orange-200 to-red-200 dark:from-gray-700 dark:to-gray-600 rounded-lg mx-auto animate-pulse" />
        </div>

        {/* Mobile Tabs Skeleton */}
        <div className="block md:hidden mb-8">
          <div className="h-12 w-full bg-gradient-to-r from-orange-200 to-red-200 dark:from-gray-700 dark:to-gray-600 rounded-lg animate-pulse mb-6" />
          <div className="w-full max-w-sm mx-auto h-96 bg-gradient-to-br from-orange-200 to-red-200 dark:from-gray-700 dark:to-gray-600 rounded-3xl animate-pulse" />
        </div>

        {/* Desktop Cards Skeleton */}
        <div className="hidden md:block">
          <div className="relative h-[700px] flex items-center justify-center">
            <div className="flex space-x-8">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-96 h-[550px] bg-gradient-to-br from-orange-200 to-red-200 dark:from-gray-700 dark:to-gray-600 rounded-3xl animate-pulse ${
                    i === 2 ? "scale-110 z-10" : "scale-85"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Details Skeleton */}
        <div className="mt-16 max-w-5xl mx-auto">
          <div className="bg-gradient-to-br from-orange-100 to-red-100 dark:from-gray-800 dark:to-gray-700 rounded-3xl p-8 animate-pulse">
            <div className="h-10 w-80 bg-gradient-to-r from-orange-200 to-red-200 dark:from-gray-600 dark:to-gray-500 rounded-lg mx-auto mb-8 animate-pulse" />
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="flex items-center">
                  <div className="w-6 h-6 bg-gradient-to-r from-orange-200 to-red-200 dark:from-gray-600 dark:to-gray-500 rounded mr-3 animate-pulse" />
                  <div className="h-5 w-48 bg-gradient-to-r from-orange-200 to-red-200 dark:from-gray-600 dark:to-gray-500 rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* FAQ Skeleton */}
        <div className="mt-16 text-center">
          <div className="h-10 w-48 bg-gradient-to-r from-orange-200 to-red-200 dark:from-gray-700 dark:to-gray-600 rounded-lg mx-auto mb-4 animate-pulse" />
          <div className="h-6 w-80 bg-gradient-to-r from-orange-200 to-red-200 dark:from-gray-700 dark:to-gray-600 rounded-lg mx-auto mb-8 animate-pulse" />
          <div className="h-12 w-40 bg-gradient-to-r from-orange-200 to-red-200 dark:from-gray-700 dark:to-gray-600 rounded-lg mx-auto animate-pulse" />
        </div>
      </div>
    </div>
  )
}
