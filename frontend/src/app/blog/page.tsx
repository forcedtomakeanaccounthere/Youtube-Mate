"use client"

import { useState, useEffect } from "react"
import { BookOpen, Calendar, User, ArrowRight, Clock, Tag, X } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import Link from "next/link"
import Navbar from "@/components/landing/Navbar"
import Footer from "@/components/landing/Footer"
import featuresData from "@/data/features.json"
import { Feature } from "@/types/features"
import { useDarkMode } from "@/hooks/use-dark-mode"
import { toast } from "@/hooks/use-toast"

const features: Feature[] = featuresData

// Sample blog posts data with full content
const blogPosts = [
  {
    id: 1,
    title: "10 Creative Ways to Use URL Shorteners for Content Creators",
    excerpt: "Discover how content creators are leveraging URL shorteners with timestamps to engage their audience and drive more traffic to their YouTube videos.",
    author: "Abhishek Anand",
    date: "2024-01-15",
    readTime: "5 min read",
    category: "Tips & Tricks",
    tags: ["URL Shortener", "Content Creation", "Marketing"],
    image: "/blogs/blog1.png",
    content: `
      <h2>Introduction</h2>
      <p>URL shorteners have evolved far beyond simple link compression. For content creators, they've become powerful tools for audience engagement, analytics, and strategic content distribution. In this guide, we'll explore 10 creative ways you can leverage URL shorteners to amplify your YouTube presence.</p>

      <h2>1. Timestamp-Based Highlights</h2>
      <p>Create shortened URLs that jump directly to the most engaging moments in your videos. This is perfect for social media promotions where you want to showcase specific segments without making viewers watch the entire video.</p>
      <ul>
        <li>Share climactic moments from tutorials</li>
        <li>Link to punchlines in comedy sketches</li>
        <li>Direct viewers to key insights in long-form content</li>
        <li>Create chapter-specific links for educational videos</li>
      </ul>

      <h2>2. Call-to-Action Tracking</h2>
      <p>Use different shortened URLs for different marketing channels to track performance effectively:</p>
      <ul>
        <li><strong>Instagram:</strong> Create unique links for stories, posts, and bio</li>
        <li><strong>Twitter:</strong> Track tweet performance with dedicated URLs</li>
        <li><strong>Email:</strong> Monitor newsletter click-through rates</li>
        <li><strong>Discord/Reddit:</strong> Measure community engagement</li>
      </ul>
      <p>With analytics enabled, you can identify which platforms drive the most engagement and optimize your strategy accordingly.</p>

      <h2>3. A/B Testing Content Promotion</h2>
      <p>Create multiple shortened URLs with different timestamps for the same video. Test which opening hooks or segments drive better results:</p>
      <ul>
        <li>Compare dramatic vs. informative openings</li>
        <li>Test different call-to-action placements</li>
        <li>Measure engagement from various video segments</li>
        <li>Identify your most compelling content moments</li>
      </ul>

      <h2>4. Custom Branded Links</h2>
      <p>Use custom aliases that reflect your brand or campaign names. Benefits include:</p>
      <ul>
        <li>Increased brand recognition and trust</li>
        <li>Memorable URLs for verbal sharing (podcasts, live events)</li>
        <li>Professional appearance in marketing materials</li>
        <li>Better click-through rates vs. generic codes</li>
      </ul>

      <h2>5. Temporary Promotional Campaigns</h2>
      <p>Set expiry dates on shortened URLs for time-sensitive promotions:</p>
      <ul>
        <li>Limited-time discount codes</li>
        <li>Exclusive early access to content</li>
        <li>Flash sales and special offers</li>
        <li>Seasonal campaign content</li>
      </ul>
      <p>This creates urgency and helps you control access to special content.</p>

      <h2>6. QR Code Integration</h2>
      <p>Generate QR codes from your shortened URLs for offline marketing:</p>
      <ul>
        <li>Business cards and networking materials</li>
        <li>Event posters and flyers</li>
        <li>Product packaging and merchandise</li>
        <li>Conference presentations and slides</li>
      </ul>
      <p>This bridges the gap between physical and digital marketing efforts seamlessly.</p>

      <h2>7. Collaborative Campaign Tracking</h2>
      <p>When working with sponsors or collaborators:</p>
      <ul>
        <li>Create unique URLs for each partnership</li>
        <li>Demonstrate exact value and reach with data</li>
        <li>Provide detailed performance reports</li>
        <li>Secure future sponsorships with proven ROI</li>
      </ul>

      <h2>8. Email Newsletter Optimization</h2>
      <p>Shortened URLs in email campaigns offer multiple advantages:</p>
      <ul>
        <li>Track engagement rates accurately</li>
        <li>Professional, clean appearance</li>
        <li>Higher click-through rates</li>
        <li>Better deliverability (avoids spam filters)</li>
      </ul>

      <h2>9. Comment Section Management</h2>
      <p>Pin shortened URLs in your video comments:</p>
      <ul>
        <li>Direct viewers to related content</li>
        <li>Link to curated playlists</li>
        <li>Share sponsored content professionally</li>
        <li>Reduce spam detection flags</li>
      </ul>

      <h2>10. Geographic Targeting</h2>
      <p>Create different shortened URLs for different geographic regions:</p>
      <ul>
        <li>Track regional engagement patterns</li>
        <li>Identify high-performing markets</li>
        <li>Plan location-specific content strategies</li>
        <li>Optimize posting times by region</li>
      </ul>

      <h2>Conclusion</h2>
      <p>URL shorteners are versatile tools that go far beyond making links prettier. By implementing these strategies, you can:</p>
      <ul>
        <li>Gain valuable insights into audience behavior</li>
        <li>Optimize marketing efforts with data</li>
        <li>Create more targeted, effective content</li>
        <li>Build stronger relationships with sponsors</li>
      </ul>
      <p>Start experimenting with these techniques today and watch your channel analytics transform.</p>
    `
  },
  {
    id: 2,
    title: "The Power of YouTube Transcripts in Education",
    excerpt: "How educators are using YouTube transcripts to make learning more accessible and create comprehensive study materials for students worldwide.",
    author: "Abhishek Anand",
    date: "2024-01-10",
    readTime: "7 min read",
    category: "Education",
    tags: ["Transcripts", "Education", "Accessibility"],
    image: "/blogs/blog2.png",
    content: `
      <h2>The Educational Revolution</h2>
      <p>YouTube has become one of the largest educational platforms in the world, with millions of tutorial videos, lectures, and educational content. However, video alone isn't always the most effective learning medium for every student. This is where transcripts become invaluable.</p>

      <h2>Accessibility First</h2>
      <p>Transcripts make educational content accessible to a diverse range of learners:</p>
      <ul>
        <li><strong>Students with hearing impairments</strong> - Full access to educational content</li>
        <li><strong>Sound-sensitive environments</strong> - Libraries, public spaces, shared rooms</li>
        <li><strong>Different learning styles</strong> - Visual learners who prefer reading</li>
        <li><strong>Language barriers</strong> - Easier translation and comprehension</li>
      </ul>
      <p>This universal design approach ensures no student is left behind due to format limitations.</p>

      <h2>Language Learning Support</h2>
      <p>For non-native speakers, transcripts are transformative:</p>
      <ul>
        <li>Pause and look up unfamiliar words easily</li>
        <li>Understand complex concepts at their own pace</li>
        <li>Practice pronunciation by reading along</li>
        <li>Build vocabulary through context</li>
      </ul>
      <p>This dual-mode learning accelerates language acquisition and comprehension.</p>

      <h2>Note-Taking Made Easy</h2>
      <p>Transform how students take notes:</p>
      <ol>
        <li>Extract transcript before watching</li>
        <li>Watch video for understanding (no pausing needed)</li>
        <li>Highlight key points in transcript afterward</li>
        <li>Create organized study notes efficiently</li>
      </ol>
      <p>This workflow leads to more efficient study sessions and better retention.</p>

      <h2>Search and Reference</h2>
      <p>Transcripts make educational content searchable. Students can quickly find:</p>
      <ul>
        <li>Specific topics within lengthy lectures</li>
        <li>Mathematical formulas and equations</li>
        <li>Historical dates and facts</li>
        <li>Scientific terminology and definitions</li>
      </ul>
      <p>This is especially valuable during exam preparation when reviewing specific concepts.</p>

      <h2>Creating Study Guides</h2>
      <p>Educators use transcript exports to create:</p>
      <ul>
        <li>Comprehensive study guides</li>
        <li>Printed handouts for offline study</li>
        <li>Annotated reference materials</li>
        <li>Quiz and test preparation sheets</li>
      </ul>
      <p>These resources extend the value of video content beyond the screen.</p>

      <h2>Flipped Classroom Integration</h2>
      <p>In flipped classroom models, transcripts enable:</p>
      <ul>
        <li>Quick review during class discussions</li>
        <li>Reference for homework questions</li>
        <li>Shared understanding among all students</li>
        <li>Efficient use of in-class time</li>
      </ul>

      <h2>Assessment and Quizzes</h2>
      <p>Teachers can extract from transcripts to create:</p>
      <ul>
        <li>Multiple-choice questions</li>
        <li>Fill-in-the-blank exercises</li>
        <li>Discussion prompts</li>
        <li>Comprehension checks</li>
      </ul>
      <p>This ensures assessments directly align with video content students consumed.</p>

      <h2>Translation and Global Reach</h2>
      <p>Transcripts democratize education globally:</p>
      <ul>
        <li>Easy translation into multiple languages</li>
        <li>Cultural adaptation of content</li>
        <li>Wider accessibility for international students</li>
        <li>Knowledge sharing across language barriers</li>
      </ul>

      <h2>Future of Educational Content</h2>
      <p>The future is bright with emerging technologies:</p>
      <ul>
        <li>AI-powered transcription improving accuracy</li>
        <li>Real-time translation during lectures</li>
        <li>Automatic summarization of key points</li>
        <li>Interactive transcript-based learning tools</li>
      </ul>

      <h2>Conclusion</h2>
      <p>Transcripts are not just an accessibility feature—they're a powerful educational tool that enhances learning outcomes for <em>all</em> students. Educators who embrace transcript-based learning are creating:</p>
      <ul>
        <li>More inclusive classrooms</li>
        <li>Better learning outcomes</li>
        <li>Engaged student communities</li>
        <li>Accessible education for everyone</li>
      </ul>
    `
  },
  {
    id: 3,
    title: "Building Collaborative Playlists: Best Practices",
    excerpt: "Learn how teams and communities are using collaborative playlists to curate content, share knowledge, and build engaged audiences.",
    author: "Abhishek Anand",
    date: "2024-01-05",
    readTime: "6 min read",
    category: "Collaboration",
    tags: ["Playlists", "Collaboration", "Teams"],
    image: "/blogs/blog3.png",
    content: `
      <h2>The Power of Collective Curation</h2>
      <p>Collaborative playlists transform content curation from a solitary activity into a team effort. Whether you're managing a learning community, a content team, or a fan group, collaborative playlists help organize and share knowledge effectively.</p>

      <h2>Setting Clear Objectives</h2>
      <p>Before creating a collaborative playlist, define its purpose. Is it for team training, customer education, entertainment, or research compilation? Clear objectives help contributors understand what content belongs in the playlist and maintain consistency.</p>

      <h2>Establishing Contribution Guidelines</h2>
      <p>Create simple rules for contributors: What types of videos are appropriate? Should videos meet certain quality standards? How should videos be titled or described? Guidelines ensure playlist quality and coherence as it grows.</p>

      <h2>Role-Based Permissions</h2>
      <p>Not everyone needs full editing rights. Consider having curators who can add/remove content, contributors who can only add, and viewers who can only watch. This hierarchy maintains quality while encouraging participation.</p>

      <h2>Using Playlists for Onboarding</h2>
      <p>Companies are creating collaborative onboarding playlists where team members add videos that helped them learn their role. New hires get a curated, team-tested learning path that evolves with the organization.</p>

      <h2>Community Engagement</h2>
      <p>Fan communities and interest groups use collaborative playlists to share discoveries. This builds engagement and gives members a sense of ownership. The best content naturally rises to the top through community consensus.</p>

      <h2>Research and Development</h2>
      <p>Research teams use collaborative playlists to compile talks, tutorials, and presentations on specific topics. This creates a living knowledge base that team members can reference and expand over time.</p>

      <h2>Event Planning</h2>
      <p>For conferences or workshops, create collaborative playlists of relevant pre-event learning materials. Participants can contribute talks or tutorials they found valuable, creating shared preparation materials.</p>

      <h2>Version Control and History</h2>
      <p>Track who adds what and when. This accountability ensures quality and allows you to understand how the playlist evolved. It also helps identify your most active contributors.</p>

      <h2>Moderation and Quality Control</h2>
      <p>Regularly review collaborative playlists for outdated content, broken links, or off-topic additions. Schedule quarterly reviews to keep playlists fresh and relevant.</p>

      <h2>Cross-Promotion Opportunities</h2>
      <p>Collaborative playlists featuring multiple creators benefit everyone involved. Each contributor promotes the playlist to their audience, creating network effects that grow everyone's reach.</p>

      <h2>Conclusion</h2>
      <p>Collaborative playlists are more than content collections—they're community-building tools. By following these best practices, you can create playlists that educate, engage, and grow with your audience.</p>
    `
  },
  {
    id: 4,
    title: "YouTube Analytics: Understanding Your Shortened URL Performance",
    excerpt: "Dive deep into analytics features and learn how to track, measure, and optimize your shortened YouTube URLs for maximum impact.",
    author: "Abhishek Anand",
    date: "2023-12-28",
    readTime: "8 min read",
    category: "Analytics",
    tags: ["Analytics", "Marketing", "Data"],
    image: "/blogs/blog4.png",
    content: `
      <h2>Why Analytics Matter</h2>
      <p>In the digital age, intuition alone isn't enough. Analytics provide concrete data about what works and what doesn't. For content creators, understanding URL performance is crucial for optimizing marketing strategies and content distribution.</p>

      <h2>Key Metrics to Track</h2>
      <p>Focus on click-through rates (CTR), geographic distribution, device types, referral sources, and time-based patterns. These metrics paint a complete picture of how your audience interacts with your content across different platforms and contexts.</p>

      <h2>Click-Through Rate Optimization</h2>
      <p>CTR reveals how compelling your links are. Low CTR might indicate poor positioning, uninteresting preview text, or targeting the wrong audience. Test different placements, descriptions, and calls-to-action to improve this critical metric.</p>

      <h2>Geographic Insights</h2>
      <p>Understanding where your clicks come from helps you create location-specific content and optimize posting times for different regions. If you notice strong engagement from specific countries, consider creating content that resonates with those cultures.</p>

      <h2>Device and Platform Analysis</h2>
      <p>Knowing whether your audience primarily uses mobile or desktop devices influences how you design thumbnails, titles, and even video content. Mobile-first audiences need different optimization strategies than desktop viewers.</p>

      <h2>Referral Source Tracking</h2>
      <p>Identify which platforms drive the most engaged traffic. If Twitter generates more clicks than Instagram, allocate more resources there. Each platform has unique characteristics that affect link performance.</p>

      <h2>Time-Based Patterns</h2>
      <p>Discover when your audience is most active. Analytics reveal optimal posting times, helping you schedule content when your audience is most likely to engage. These patterns can vary significantly by content type and audience demographics.</p>

      <h2>Conversion Tracking</h2>
      <p>Beyond clicks, track what viewers do after arriving at your video. Do they watch the entire video? Do they subscribe? Understanding post-click behavior helps optimize both your links and your content.</p>

      <h2>A/B Testing Strategies</h2>
      <p>Create multiple shortened URLs for the same content with different timestamps or presentations. Compare performance to understand what resonates with your audience. This scientific approach removes guesswork from optimization.</p>

      <h2>Attribution and ROI</h2>
      <p>For sponsored content or campaigns, demonstrate ROI by tracking how many views, subscribers, or conversions came from specific shortened URLs. This data is invaluable for securing future partnerships and justifying marketing spend.</p>

      <h2>Dashboard and Reporting</h2>
      <p>Create regular reports combining your URL analytics with YouTube Studio data. This holistic view reveals the complete customer journey from link click to viewer action, enabling data-driven decision making.</p>

      <h2>Conclusion</h2>
      <p>Analytics transform shortened URLs from simple convenience tools into powerful marketing instruments. By understanding and acting on these insights, you can continuously improve your content strategy and audience engagement.</p>
    `
  },
  {
    id: 5,
    title: "Watch Parties: The Future of Remote Content Consumption",
    excerpt: "Explore how synchronized watch parties are revolutionizing remote team building, online education, and virtual events.",
    author: "Abhishek Anand",
    date: "2023-12-20",
    readTime: "5 min read",
    category: "Features",
    tags: ["Watch Party", "Remote Work", "Events"],
    image: "/blogs/blog5.png",
    content: `
      <h2>The Rise of Social Viewing</h2>
      <p>The pandemic accelerated a trend that was already emerging: people want to experience content together, even when physically apart. Watch parties recreate the communal viewing experience in virtual spaces, bringing people together regardless of geographic boundaries.</p>

      <h2>Synchronized Playback Technology</h2>
      <p>Modern watch parties use sophisticated synchronization technology to ensure everyone sees the same moment simultaneously. This shared timeline creates authentic group reactions and enables real-time discussions about content as it unfolds.</p>

      <h2>Remote Team Building</h2>
      <p>Companies are hosting virtual movie nights, documentary viewings, and TED Talk marathons as team building activities. These shared experiences create bonds and conversation topics that transcend work discussions, fostering stronger team relationships.</p>

      <h2>Educational Applications</h2>
      <p>Educators use watch parties for virtual field trips, documentary analysis, and group study sessions. Real-time chat enables students to ask questions, share insights, and learn collaboratively, recreating classroom dynamics in online environments.</p>

      <h2>Virtual Events and Conferences</h2>
      <p>Watch parties enable synchronized viewing of keynotes, product launches, and conference presentations. Attendees can network and discuss in real-time, creating engagement levels comparable to in-person events.</p>

      <h2>Fan Communities</h2>
      <p>Music fans, sports enthusiasts, and content communities use watch parties to experience releases, games, and premieres together. This collective experience amplifies excitement and creates memorable shared moments.</p>

      <h2>Interview and Reaction Videos</h2>
      <p>Content creators host watch parties for interviews, reactions, or content reviews. This interactive format allows creators to engage directly with their audience while consuming content together, building stronger community connections.</p>

      <h2>Chat and Interaction Features</h2>
      <p>Real-time chat transforms passive viewing into active participation. Viewers share reactions, insights, and jokes, creating a dynamic second screen experience that enriches content consumption and builds community.</p>

      <h2>Moderation and Community Standards</h2>
      <p>Successful watch parties require clear community guidelines and active moderation. Establishing respectful interaction norms ensures everyone feels comfortable participating and the focus remains on shared enjoyment.</p>

      <h2>Technical Considerations</h2>
      <p>Bandwidth, latency, and device compatibility affect watch party quality. Choose platforms that optimize for smooth streaming and synchronization across different internet speeds and devices to ensure inclusive participation.</p>

      <h2>The Future of Watch Parties</h2>
      <p>As VR and AR technologies mature, watch parties will become more immersive. Imagine watching content in virtual theaters with friends appearing as avatars, or AR overlays adding contextual information during group viewings.</p>

      <h2>Conclusion</h2>
      <p>Watch parties prove that physical distance doesn't prevent shared experiences. As remote work and global communities become the norm, synchronized viewing will remain a vital tool for connection, education, and entertainment.</p>
    `
  },
  {
    id: 6,
    title: "Video Download Best Practices: Legal and Ethical Considerations",
    excerpt: "Understanding copyright, fair use, and best practices when downloading YouTube videos for personal and educational purposes.",
    author: "Abhishek Anand",
    date: "2023-12-15",
    readTime: "6 min read",
    category: "Legal",
    tags: ["Downloads", "Copyright", "Legal"],
    image: "/blogs/blog6.png",
    content: `
      <h2>Understanding Copyright Basics</h2>
      <p>Copyright law protects original creative works, including YouTube videos. Just because content is publicly accessible doesn't mean it's free to download and redistribute. Understanding these fundamentals helps you stay within legal boundaries while using content appropriately.</p>

      <h2>What is Fair Use?</h2>
      <p>Fair use is a legal doctrine that permits limited use of copyrighted material without permission for purposes like criticism, commentary, education, and research. However, fair use is nuanced and context-dependent—it's not a blanket exemption.</p>

      <h2>Personal Use vs. Distribution</h2>
      <p>Downloading videos for personal, offline viewing in regions where internet is unreliable is generally acceptable. However, redistributing downloaded content, even without profit motive, typically violates copyright. The distinction between private and public use is crucial.</p>

      <h2>Educational Exemptions</h2>
      <p>Educational institutions have specific exemptions under copyright law. Teachers can download and display videos in classroom settings under certain conditions, but these exemptions have limitations and don't extend to all educational contexts.</p>

      <h2>Creative Commons and Public Domain</h2>
      <p>Some creators license their work under Creative Commons, explicitly allowing download and reuse under specific conditions. Public domain content, where copyright has expired or never existed, can be freely used. Always check licensing before downloading.</p>

      <h2>YouTube's Terms of Service</h2>
      <p>YouTube's TOS generally prohibits downloading content unless a download button is provided by YouTube or the creator. While this doesn't carry the same legal weight as copyright law, violating TOS can result in account termination.</p>

      <h2>Respecting Creator Intent</h2>
      <p>Beyond legalities, consider creator intent. Many creators depend on ad revenue and view counts. Downloading and sharing their content can undermine their livelihood. If you value the content, support creators through official channels.</p>

      <h2>When Downloading Makes Sense</h2>
      <p>Legitimate use cases include: personal archiving of your own content, preserving public domain materials, educational use within legal bounds, research purposes, and offline viewing in areas with limited connectivity—always for non-commercial purposes.</p>

      <h2>Attribution and Credit</h2>
      <p>Even when downloading is legally permissible, always credit the original creator. Proper attribution respects their work and helps others discover the original source. This ethical practice maintains the creative ecosystem's integrity.</p>

      <h2>International Considerations</h2>
      <p>Copyright laws vary significantly by country. What's legal in one jurisdiction might be prohibited in another. Research your local laws and understand that online actions can have legal implications across borders.</p>

      <h2>Alternative Solutions</h2>
      <p>Instead of downloading, consider YouTube Premium for offline viewing, creator-authorized downloads, platform features like "Watch Later," or simply bookmarking content for online access. These alternatives respect creator rights while meeting your needs.</p>

      <h2>Conclusion</h2>
      <p>Responsible video downloading balances personal needs with respect for creators' rights. By understanding legal boundaries, respecting Terms of Service, and supporting creators through legitimate channels, we can enjoy content while maintaining a healthy digital ecosystem.</p>
    `
  }
]

const categories = ["All", "Tips & Tricks", "Education", "Collaboration", "Analytics", "Features", "Legal"]

export default function BlogPage() {
  const [activeFeature, setActiveFeature] = useState<Feature | null>(null)
  const [showNavbar, setShowNavbar] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [selectedPost, setSelectedPost] = useState<typeof blogPosts[0] | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [email, setEmail] = useState("")
  const { darkMode, toggleDarkMode, mounted } = useDarkMode()

  useEffect(() => {
    if (features.length > 0) {
      setActiveFeature(features[0])
    }
  }, [])

  useEffect(() => {
    // Check if user is subscribed from localStorage
    const subscribed = localStorage.getItem("newsletter_subscribed")
    const savedEmail = localStorage.getItem("newsletter_email")
    if (subscribed === "true" && savedEmail) {
      setIsSubscribed(true)
      setEmail(savedEmail)
    }
  }, [])

  const filteredPosts = selectedCategory === "All" 
    ? blogPosts 
    : blogPosts.filter(post => post.category === selectedCategory)

  const openArticle = (post: typeof blogPosts[0]) => {
    setSelectedPost(post)
    setIsModalOpen(true)
  }

  const closeArticle = () => {
    setIsModalOpen(false)
    setTimeout(() => setSelectedPost(null), 300) // Clear after animation
  }

  const handleSubscribe = () => {
    if (!email || !email.includes("@")) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive"
      })
      return
    }

    localStorage.setItem("newsletter_subscribed", "true")
    localStorage.setItem("newsletter_email", email)
    setIsSubscribed(true)
    
    toast({
      title: "Successfully Subscribed!",
      description: "You'll receive our latest updates and articles.",
    })
  }

  const handleUnsubscribe = () => {
    localStorage.removeItem("newsletter_subscribed")
    localStorage.removeItem("newsletter_email")
    setIsSubscribed(false)
    setEmail("")
    
    toast({
      title: "Unsubscribed",
      description: "You've been removed from our newsletter.",
    })
  }

  if (!mounted) {
    return <div className="min-h-screen" />
  }

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${darkMode ? "dark bg-gray-900" : "bg-gradient-to-br from-orange-50 to-red-50"}`}
    >
      {activeFeature && (
        <Navbar
          showNavbar={showNavbar}
          features={features}
          setActiveFeature={setActiveFeature}
          darkMode={darkMode}
          toggleDarkMode={toggleDarkMode}
        />
      )}
      
      <div className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header Section */}
          <div className="text-center mb-16">
            <div className="flex items-center justify-center mb-6">
              <BookOpen className="w-16 h-16 text-orange-500 mr-4" />
              <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-orange-500 to-red-600 bg-clip-text text-transparent">
                Blog
              </h1>
            </div>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Tips, tutorials, and insights on getting the most out of YouTube Mate and managing YouTube content like a pro.
            </p>
          </div>

          {/* Category Filter */}
          <div className="mb-12">
            <div className="flex flex-wrap justify-center gap-3">
              {categories.map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  onClick={() => setSelectedCategory(category)}
                  className={
                    selectedCategory === category
                      ? "bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white"
                      : "border-orange-300 dark:border-orange-700 hover:border-orange-500 dark:hover:border-orange-500"
                  }
                >
                  {category}
                </Button>
              ))}
            </div>
          </div>

          {/* Featured Post */}
          {selectedCategory === "All" && filteredPosts.length > 0 && (
            <Card className="mb-12 overflow-hidden bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50">
              <div className="grid md:grid-cols-2 gap-0">
                <div
                  className="h-64 md:h-auto bg-cover bg-center"
                  style={{ backgroundImage: `url(${filteredPosts[0].image})` }}
                />
                <CardContent className="p-8 flex flex-col justify-center">
                  <Badge className="w-fit mb-4 bg-orange-500 hover:bg-orange-600">Featured Post</Badge>
                  <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                    {filteredPosts[0].title}
                  </h2>
                  <p className="text-lg text-gray-700 dark:text-gray-300 mb-6">
                    {filteredPosts[0].excerpt}
                  </p>
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 mb-6">
                    <User className="w-4 h-4 mr-2" />
                    <span className="mr-4">{filteredPosts[0].author}</span>
                    <Calendar className="w-4 h-4 mr-2" />
                    <span className="mr-4">{new Date(filteredPosts[0].date).toLocaleDateString()}</span>
                    <Clock className="w-4 h-4 mr-2" />
                    <span>{filteredPosts[0].readTime}</span>
                  </div>
                  <Button className="w-fit bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white" onClick={() => openArticle(filteredPosts[0])}>
                    Read More <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </CardContent>
              </div>
            </Card>
          )}

          {/* Blog Posts Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredPosts.slice(selectedCategory === "All" ? 1 : 0).map((post) => (
              <Card
                key={post.id}
                className="overflow-hidden bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50 hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              >
                <div
                  className="h-48 bg-cover bg-center"
                  style={{ backgroundImage: `url(${post.image})` }}
                />
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <Badge variant="secondary" className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
                      {post.category}
                    </Badge>
                    <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      {post.readTime}
                    </span>
                  </div>
                  
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3 line-clamp-2">
                    {post.title}
                  </h3>
                  
                  <p className="text-gray-700 dark:text-gray-300 mb-4 line-clamp-3">
                    {post.excerpt}
                  </p>
                  
                  <div className="flex flex-wrap gap-2 mb-4">
                    {post.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full flex items-center"
                      >
                        <Tag className="w-3 h-3 mr-1" />
                        {tag}
                      </span>
                    ))}
                  </div>
                  
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                    <User className="w-4 h-4 mr-2" />
                    <span className="mr-4">{post.author}</span>
                    <Calendar className="w-4 h-4 mr-2" />
                    <span>{new Date(post.date).toLocaleDateString()}</span>
                  </div>
                  
                  <Button
                    variant="outline"
                    className="w-full border-orange-300 dark:border-orange-700 hover:border-orange-500 dark:hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                    onClick={() => openArticle(post)}
                  >
                    Read Article <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* No Posts Message */}
          {filteredPosts.length === 0 && (
            <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50">
              <CardContent className="p-12 text-center">
                <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">No posts found</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  We don't have any posts in this category yet. Check back soon!
                </p>
              </CardContent>
            </Card>
          )}

          {/* Newsletter Section */}
          <Card className="mt-16 bg-gradient-to-r from-orange-500 to-red-600 text-white">
            <CardContent className="p-4 md:p-6 text-center">
              <BookOpen className="w-16 h-16 mx-auto mb-6" />
              <h2 className="text-3xl font-bold mb-4">Stay Updated</h2>
              <p className="text-lg mb-8 max-w-2xl mx-auto">
                Get the latest tips, tutorials, and updates delivered straight to your inbox. Join our community of 
                YouTube enthusiasts and content creators.
              </p>
              {!isSubscribed ? (
                <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
                  <input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex-1 px-4 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-white"
                  />
                  <Button
                    size="lg"
                    onClick={handleSubscribe}
                    className="bg-white text-orange-600 hover:bg-gray-100 font-semibold"
                  >
                    Subscribe
                  </Button>
                </div>
              ) : (
                <div className="max-w-md mx-auto">
                  <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4 mb-4">
                    <p className="text-lg font-semibold mb-2">You're subscribed !</p>
                    <p className="text-sm opacity-90">{email}</p>
                  </div>
                  <Button
                    size="lg"
                    onClick={handleUnsubscribe}
                    variant="outline"
                    className="bg-transparent border-2 border-white text-white hover:bg-white hover:text-orange-600 font-semibold"
                  >
                    Unsubscribe
                  </Button>
                </div>
              )}
              <p className="text-sm mt-4 opacity-90">
                No spam, unsubscribe anytime. We respect your privacy.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Article Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white/95 dark:bg-gray-900/95 backdrop-blur-lg border-orange-200/50 dark:border-gray-700/50">
          {selectedPost && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between mb-4">
                  <Badge className="bg-orange-500 hover:bg-orange-600">{selectedPost.category}</Badge>
                  <button
                    onClick={closeArticle}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                  >
                    {/* <X className="w-5 h-5 text-gray-600 dark:text-gray-400" /> */}
                  </button>
                </div>
                <DialogTitle className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                  {selectedPost.title}
                </DialogTitle>
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 mb-4">
                  <User className="w-4 h-4 mr-2" />
                  <span className="mr-4">{selectedPost.author}</span>
                  <Calendar className="w-4 h-4 mr-2" />
                  <span className="mr-4">{new Date(selectedPost.date).toLocaleDateString()}</span>
                  <Clock className="w-4 h-4 mr-2" />
                  <span>{selectedPost.readTime}</span>
                </div>
                <div className="flex flex-wrap gap-2 mb-6">
                  {selectedPost.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs px-3 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full flex items-center"
                    >
                      <Tag className="w-3 h-3 mr-1" />
                      {tag}
                    </span>
                  ))}
                </div>
              </DialogHeader>
              <div className="article-content">
                <div dangerouslySetInnerHTML={{ __html: selectedPost.content }} />
              </div>
              
              <style jsx>{`
                .article-content {
                  color: ${darkMode ? '#e5e7eb' : '#1f2937'};
                  line-height: 1.8;
                }

                .article-content :global(h2) {
                  font-size: 1.875rem;
                  font-weight: 700;
                  color: ${darkMode ? '#ffffff' : '#111827'};
                  margin-top: 3rem;
                  margin-bottom: 1.5rem;
                  padding-bottom: 0.75rem;
                  border-bottom: 3px solid ${darkMode ? '#ea580c' : '#fb923c'};
                  line-height: 1.3;
                }

                .article-content :global(h2:first-child) {
                  margin-top: 0;
                }

                .article-content :global(h3) {
                  font-size: 1.5rem;
                  font-weight: 600;
                  color: ${darkMode ? '#f3f4f6' : '#374151'};
                  margin-top: 2rem;
                  margin-bottom: 1rem;
                  line-height: 1.4;
                }

                .article-content :global(p) {
                  font-size: 1.125rem;
                  color: ${darkMode ? '#d1d5db' : '#4b5563'};
                  margin-bottom: 1.5rem;
                  line-height: 1.8;
                }

                .article-content :global(ul) {
                  margin: 1.5rem 0;
                  padding-left: 0;
                  list-style: none;
                }

                .article-content :global(ul li) {
                  font-size: 1.0625rem;
                  color: ${darkMode ? '#d1d5db' : '#4b5563'};
                  margin-bottom: 1rem;
                  padding-left: 2rem;
                  position: relative;
                  line-height: 1.7;
                }

                .article-content :global(ul li::before) {
                  content: '';
                  position: absolute;
                  left: 0;
                  top: 0.6em;
                  width: 8px;
                  height: 8px;
                  background: linear-gradient(135deg, #ea580c, #dc2626);
                  border-radius: 50%;
                  box-shadow: 0 2px 4px rgba(234, 88, 12, 0.3);
                }

                .article-content :global(ol) {
                  margin: 1.5rem 0;
                  padding-left: 0;
                  list-style: none;
                  counter-reset: article-counter;
                }

                .article-content :global(ol li) {
                  font-size: 1.0625rem;
                  color: ${darkMode ? '#d1d5db' : '#4b5563'};
                  margin-bottom: 1rem;
                  padding-left: 2.5rem;
                  position: relative;
                  line-height: 1.7;
                  counter-increment: article-counter;
                }

                .article-content :global(ol li::before) {
                  content: counter(article-counter);
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 1.75rem;
                  height: 1.75rem;
                  background: linear-gradient(135deg, #ea580c, #dc2626);
                  color: white;
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-weight: 700;
                  font-size: 0.875rem;
                  box-shadow: 0 2px 6px rgba(234, 88, 12, 0.4);
                }

                .article-content :global(strong) {
                  font-weight: 700;
                  color: ${darkMode ? '#ffffff' : '#111827'};
                  font-size: 1.05em;
                }

                .article-content :global(em) {
                  font-style: italic;
                  color: ${darkMode ? '#fbbf24' : '#d97706'};
                }

                .article-content :global(a) {
                  color: ${darkMode ? '#fb923c' : '#ea580c'};
                  text-decoration: underline;
                  text-underline-offset: 3px;
                  font-weight: 500;
                  transition: all 0.2s ease;
                }

                .article-content :global(a:hover) {
                  color: ${darkMode ? '#fdba74' : '#c2410c'};
                  text-decoration-thickness: 2px;
                }

                .article-content :global(blockquote) {
                  margin: 2rem 0;
                  padding: 1.5rem 1.5rem 1.5rem 2rem;
                  border-left: 4px solid ${darkMode ? '#ea580c' : '#fb923c'};
                  background: ${darkMode ? 'rgba(234, 88, 12, 0.1)' : 'rgba(251, 146, 60, 0.1)'};
                  border-radius: 0 0.5rem 0.5rem 0;
                  font-style: italic;
                  color: ${darkMode ? '#d1d5db' : '#374151'};
                }

                .article-content :global(code) {
                  background: ${darkMode ? 'rgba(55, 65, 81, 0.8)' : 'rgba(229, 231, 235, 0.8)'};
                  color: ${darkMode ? '#fbbf24' : '#d97706'};
                  padding: 0.2em 0.5em;
                  border-radius: 0.375rem;
                  font-size: 0.9em;
                  font-family: 'Courier New', monospace;
                  font-weight: 500;
                }

                .article-content :global(hr) {
                  margin: 3rem 0;
                  border: none;
                  height: 2px;
                  background: linear-gradient(90deg, transparent, ${darkMode ? '#ea580c' : '#fb923c'}, transparent);
                }

                /* First paragraph after h2 special styling */
                .article-content :global(h2 + p) {
                  font-size: 1.1875rem;
                  color: ${darkMode ? '#e5e7eb' : '#374151'};
                  margin-top: 1rem;
                }

                /* Nested lists */
                .article-content :global(ul ul),
                .article-content :global(ol ul),
                .article-content :global(ul ol),
                .article-content :global(ol ol) {
                  margin-top: 0.75rem;
                  margin-bottom: 0.75rem;
                }

                .article-content :global(ul ul li::before),
                .article-content :global(ol ul li::before) {
                  width: 6px;
                  height: 6px;
                  background: ${darkMode ? '#fb923c' : '#ea580c'};
                  opacity: 0.7;
                }
              `}</style>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  )
}
