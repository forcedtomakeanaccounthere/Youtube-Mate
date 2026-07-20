import { Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import { bileha } from "@/app/fonts"

export default function Hero() {
  return (
    <section className="relative pt-20 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="absolute inset-0 ">
        <div className="absolute chains">
          <Image src="/7.webp" alt="chain" fill style={{objectFit: 'contain'}} priority />
        </div>
        <div className="circle absolute">
          <Image src="/1.webp" alt="circular designer stuff" fill style={{objectFit: 'contain'}} priority />
        </div>
      </div>
      <div className="max-w-7xl mx-auto text-center">
        
        <div className="flex items-center justify-center mb-16 mt-16 ml-4">
          <Play className="w-24 h-24 text-orange-500 mr-4" />
          <h1 className="text-5xl md:text-9xl font-bold bg-gradient-to-r from-orange-500 to-red-600 bg-clip-text text-transparent text-center" style={{ fontFamily: bileha.style.fontFamily }}>
            YouTube Mate
          </h1>
        </div>
        <p className="text-xl md:text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mt-16">
          Your ultimate companion for YouTube content management.
        </p>
        <p className="text-xl md:text-xl text-gray-600 dark:text-gray-300 mb-12 max-w-2xl mx-auto">
          Stream with friends, generate AI summaries, Download videos,
          and Collaborate on playlists.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-20">
          <Button
            size="lg"
            className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white px-8 py-3 text-lg"
          >
            Get Started
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
      <style jsx>{`
        .rotating-element {
          animation: spin 14s linear infinite;
        }
        @keyframes spin {
          from {
            transform: rotateZ(0deg);
          }
          to {
            transform: rotateZ(360deg);
          }
        }
        .chains {
          width: 420px;
          height: 620px;
          position: absolute;
          top: 50px;
          right: 0;
        }
        @media (max-width: 1330px) {
          .chains {
            width: 340px;
            height: 590px;
            top: 67px;
            right: 0;
          }
        }
        @media (max-width: 1200px) {
          .chains {
            width: 300px;
            height: 590px;
            top: 65px;
            right: 0;
          }
        }
        @media (max-width: 1130px) {
          .chains {
            visibility: hidden;
          }
        }
        .circle {
          // visibility: hidden;
          width: 460px;
          height: 460px;
          top: 190px;
          left: 0px;
        }
        @media (max-width: 1420px) {
          .circle {
            width: 360px;
            height: 360px;
            top: 240px;
            left: 0px;
          }
        }
        @media (max-width: 1110px) {
          .circle {
            width: 260px;
            height: 260px;
            top: 280px;
            left: 0px;
          }
        }
        @media (max-width: 890px) {
          .circle {
            width: 160px;
            height: 160px;
            top: 380px;
            left: 0px;
          }
        }
        @media (max-width: 640px) {
          .circle {
            visibility: hidden;
          }
        }
      `}</style>
    </section>
  )
}
