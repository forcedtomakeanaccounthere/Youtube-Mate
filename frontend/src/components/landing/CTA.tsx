import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export default function CTA() {
  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto text-center">
        <Card className="bg-gradient-to-r from-orange-500 to-red-600 border-0 text-white">
          <CardContent className="p-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to enhance your YouTube experience?</h2>
            <p className="text-xl mb-8 opacity-90">
              Join thousands of users who are already using YouTube Mate to streamline their video workflow.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                variant="secondary"
                className="bg-white text-orange-600 hover:bg-gray-100 px-8 py-3 text-lg"
              >
                Start Free Trial
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white text-white hover:bg-white/10 px-8 py-3 text-lg bg-transparent"
              >
                View Pricing
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}