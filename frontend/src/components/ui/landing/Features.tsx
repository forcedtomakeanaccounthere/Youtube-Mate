import { Scissors, Share2, FileText, Download, List } from "lucide-react"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import { Feature } from "@/types/features"

const iconMap = {
  Scissors: Scissors,
  Share2: Share2,
  FileText: FileText,
  Download: Download,
  List: List,
}

interface FeaturesProps {
  features: Feature[]
  activeFeature: Feature
  setActiveFeature: (feature: Feature) => void
}

export default function Features({ features, activeFeature, setActiveFeature }: FeaturesProps) {
  return (
    <section className="mt-8 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">Powerful Features</h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Discover all the tools you need to enhance your YouTube experience
          </p>
        </div>

        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl border border-orange-200/50 dark:border-gray-700/50 overflow-hidden">
          {/* Tab Navigation */}
          <div className="flex flex-wrap justify-center p-6 bg-gradient-to-r from-orange-100/50 to-red-100/50 dark:from-gray-700/50 dark:to-gray-600/50">
            <div className="flex flex-wrap gap-2 bg-white/60 dark:bg-gray-800/60 rounded-full p-2 backdrop-blur-sm">
              {features.map((feature) => {
                const IconComponent = iconMap[features.icon]
                return (
                  <button
                    key={feature.id}
                    onClick={() => setActiveFeature(feature)}
                    className={`px-6 py-3 rounded-full transition-all duration-300 flex items-center space-x-2 ${
                      activeFeature.id === feature.id
                        ? "bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg transform scale-105"
                        : "text-gray-700 dark:text-gray-300 hover:bg-orange-100 dark:hover:bg-gray-700"
                    }`}
                  >
                    {IconComponent && <IconComponent className="w-6 h-6" />}
                    <span className="font-medium">{feature.title}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Content Area */}
          <div className="grid md:grid-cols-2 gap-8 p-8">
            <div className="space-y-6">
              <h3 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
                {activeFeature.content.title}
              </h3>
              <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed">
                {activeFeature.content.description}
              </p>
              <div className="space-y-3">
                {activeFeature.content.features.map((feature, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-gradient-to-r from-orange-500 to-red-600 rounded-full"></div>
                    <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                  </div>
                ))}
              </div>
              <Button className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white">
                Try {activeFeature.title}
              </Button>
            </div>
            <div className="relative">
              <Image
                src={`${activeFeature.image}?height=400&width=600`}
                // src="/9.png?height=400&width=600"
                alt={`${activeFeature.title} feature showcase`}
                width={600}
                height={400}
                className="rounded-lg shadow-lg object-cover w-full h-full"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-orange-500/20 to-transparent rounded-lg"></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}