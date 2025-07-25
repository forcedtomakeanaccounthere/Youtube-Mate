import { Play } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function Hero() {
  return (
    <section className="relative pt-20 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto text-center">
        <img src="/7.png" alt="chain" className="w-[500px] h-[628px] absolute top-0 left-[1028px]" />
        {/* <img src="/6.png" alt="YouTube Mate" className="w-[580px] h-[580px] absolute top-5 left-[1100px]" /> */}
        <img src="/2.png" alt="stripes" className="w-[690px] h-[690px] absolute top-[980px] left-[835px]" />
        {/* <img src="/4.png" alt="YouTube Mate" className="w-[690px] h-[690px] absolute top-[900px] left-[1020px]" /> */}
        <img src="/1.png" alt="circular designer stuff" className="w-[460px] h-[460px] absolute top-[150px] left-[0px]" />
        <div className="flex items-center justify-center mb-8">
          <Play className="w-16 h-16 text-orange-500 mr-4" />
          <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-orange-500 to-red-600 bg-clip-text text-transparent">
            YouTube Mate
          </h1>
        </div>
        <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-12 max-w-3xl mx-auto">
          Your ultimate companion for YouTube content management. Shorten URLs, generate transcripts, download videos,
          and collaborate on playlists.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            size="lg"
            className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white px-8 py-3 text-lg"
          >
            Get Started Free
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-orange-500 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 px-8 py-3 text-lg bg-transparent"
          >
            Watch Demo
          </Button>
        </div>
      </div>
    </section>
  )
}