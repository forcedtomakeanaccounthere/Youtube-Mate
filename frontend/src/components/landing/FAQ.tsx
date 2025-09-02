import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

export default function FAQ() {
  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Get answers to common questions about YouTube Mate
          </p>
        </div>

        <Accordion type="single" collapsible className="space-y-4">
          <AccordionItem
            value="item-1"
            className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-lg border border-orange-200/50 dark:border-gray-700/50"
          >
            <AccordionTrigger className="px-6 py-4 text-left text-gray-900 dark:text-white hover:text-orange-500">
              Is YouTube Mate free to use?
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-4 text-gray-600 dark:text-gray-300">
              Yes! YouTube Mate offers a generous free tier with access to all basic features. Premium plans are
              available for advanced features and higher usage limits.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem
            value="item-2"
            className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-lg border border-orange-200/50 dark:border-gray-700/50"
          >
            <AccordionTrigger className="px-6 py-4 text-left text-gray-900 dark:text-white hover:text-orange-500">
              How accurate are the transcripts?
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-4 text-gray-600 dark:text-gray-300">
              Our AI-powered transcription achieves 95%+ accuracy for clear audio. Accuracy may vary based on audio
              quality, accents, and background noise.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem
            value="item-3"
            className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-lg border border-orange-200/50 dark:border-gray-700/50"
          >
            <AccordionTrigger className="px-6 py-4 text-left text-gray-900 dark:text-white hover:text-orange-500">
              Can I download copyrighted content?
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-4 text-gray-600 dark:text-gray-300">
              Please respect copyright laws and YouTube's terms of service. Only download content you have permission
              to use or that falls under fair use guidelines.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem
            value="item-4"
            className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-lg border border-orange-200/50 dark:border-gray-700/50"
          >
            <AccordionTrigger className="px-6 py-4 text-left text-gray-900 dark:text-white hover:text-orange-500">
              How many people can collaborate on a playlist?
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-4 text-gray-600 dark:text-gray-300">
              Free accounts support up to 5 collaborators per playlist. Premium accounts can have unlimited
              collaborators with advanced permission controls.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </section>
  )
}
