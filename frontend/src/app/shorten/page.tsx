"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
  Copy,
  QrCode,
  Link,
  Clock,
  Eye,
  Calendar,
  AlertCircle,
  CheckCircle,
  Play,
  Plus,
  ExternalLink,
  Trash2,
  RefreshCw,
  Loader2
} from "lucide-react"
import Image from "next/image"
import { toast } from "@/hooks/use-toast"
import Navbar from "@/components/landing/Navbar"
import AuthGuard from "@/components/AuthGuard"
import featuresData from "@/data/features.json"
import { Feature } from "@/types/features"
import { useDarkMode } from "@/hooks/use-dark-mode"

const features: Feature[] = featuresData

interface VideoData {
  id: string
  title: string
  thumbnail: string
  duration: string
  durationSeconds: number
  channel: string
  views: string
}

interface ShortenedURL {
  id: string
  originalUrl: string
  shortUrl: string
  customAlias?: string
  timestamp?: string
  videoData?: VideoData | null
  analytics: boolean
  clicks: number
  createdAt: string
  expiryDate?: string
  qrCode: string
}

interface BulkURL {
  id: string
  url: string
  customAlias?: string
  timestamp?: string
  status: "pending" | "processing" | "completed" | "error"
  error?: string
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

function URLShortenerPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [url, setUrl] = useState("");
  const [customAlias, setCustomAlias] = useState("");
  const [timestamp, setTimestamp] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [isValidUrl, setIsValidUrl] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [expiryDate, setExpiryDate] = useState("");
  const [shortenedUrls, setShortenedUrls] = useState<ShortenedURL[]>([]);
  const [bulkUrls, setBulkUrls] = useState<BulkURL[]>([]);
  const [bulkInput, setBulkInput] = useState("");
  const [timestampError, setTimestampError] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadingInitialData, setLoadingInitialData] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeTab, setActiveTab] = useState("single");

  // Navbar state
  const [activeFeature, setActiveFeature] = useState<Feature | null>(null)
  const [showNavbar, setShowNavbar] = useState(true)
  const { darkMode, toggleDarkMode, mounted } = useDarkMode()

  // Initialize activeFeature safely
  useEffect(() => {
    if (features.length > 0) {
      setActiveFeature(features[0])
    }
  }, [])

  // Handle tab query parameter
  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam && ['single', 'bulk'].includes(tabParam)) {
      setActiveTab(tabParam)
    }
  }, [searchParams])

  // Handle tab change with URL update
  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab)
    router.push(`/shorten?tab=${newTab}`, { scroll: false })
  }

  // Remove mockVideoData

  const validateYouTubeUrl = (url: string): boolean => {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    return youtubeRegex.test(url);
  };

  const extractVideoId = (url: string): string | null => {
    const match = url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/)
    return match ? match[1] : null
  }

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`
  }

  const validateTimestamp = () => {
    const totalSeconds = timestamp.hours * 3600 + timestamp.minutes * 60 + timestamp.seconds;
    if (videoData && totalSeconds > videoData.durationSeconds) {
      setTimestampError(`Timestamp cannot exceed video duration (${videoData.duration})`);
      return false;
    }
    setTimestampError("");
    return true;
  };

  // Load existing URLs on component mount
  const loadExistingUrls = async () => {
    setLoadingInitialData(true);
    try {
      const token = localStorage.getItem("token")
      if (!token) {
        setLoadingInitialData(false);
        return;
      }

      const response = await fetch(`${API_BASE}/urls/my-urls?limit=10`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
      });

      if (response.ok) {
        const result = await response.json();
        const urls = result.data?.urls || [];
        
        const formattedUrls = urls.map((item: any) => ({
          id: item._id,
          originalUrl: item.originalUrl,
          shortUrl: `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}/${item.shortCode}`,
          customAlias: item.customAlias || undefined,
          timestamp: item.timestampFormatted || undefined,
          videoData: item.videoData ? {
            id: item.videoData.videoId,
            title: item.videoData.title,
            thumbnail: item.videoData.thumbnailUrl,
            duration: item.videoData.duration,
            durationSeconds: item.videoData.durationSeconds,
            channel: typeof item.videoData.channel === 'object' 
              ? item.videoData.channel.name || ''
              : item.videoData.channel || '',
            views: item.videoData.views,
          } : null,
          analytics: item.analyticsEnabled,
          clicks: item.clicks || 0,
          createdAt: item.createdAt,
          expiryDate: item.expiresAt || undefined,
          qrCode: item.qrCodeUrl || '',
        }));
        
        setShortenedUrls(formattedUrls);
      }
    } catch (error) {
      console.error('Failed to load existing URLs:', error);
      // Don't show error to user for this, as it might be due to no authentication
    } finally {
      setLoadingInitialData(false);
    }
  };

  useEffect(() => {
    if (url) {
      const isValid = validateYouTubeUrl(url);
      setIsValidUrl(isValid);
      if (isValid) {
        // Fetch video metadata from backend
        setIsLoading(true);
        fetch(`${API_BASE}/urls/shorten`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ originalUrl: url, fetchMetaOnly: true }),
        })
          .then(async (res) => {
            try {
              const data = await res.json();
              if (res.ok && data.videoData) {
                // Transform backend data to match frontend interface
                const transformedData: VideoData = {
                  id: data.videoData.videoId || '',
                  title: data.videoData.title || '',
                  thumbnail: data.videoData.thumbnailUrl || '',
                  duration: data.videoData.duration || '',
                  durationSeconds: data.videoData.durationSeconds || 0,
                  channel: typeof data.videoData.channel === 'object' 
                    ? data.videoData.channel.name || '' 
                    : data.videoData.channel || '',
                  views: data.videoData.views || '',
                };
                setVideoData(transformedData);
              } else {
                console.error('Failed to fetch video metadata:', data);
                setVideoData(null);
              }
            } catch (parseError) {
              console.error('Error parsing video metadata response:', parseError);
              setVideoData(null);
            }
          })
          .catch((error) => {
            console.error('Error fetching video metadata:', error);
            setVideoData(null);
          })
          .finally(() => setIsLoading(false));
      } else {
        setVideoData(null);
      }
    } else {
      setIsValidUrl(false);
      setVideoData(null);
    }
  }, [url]);

  useEffect(() => {
    validateTimestamp();
  }, [timestamp, videoData]);

  // Load existing URLs on component mount
  useEffect(() => {
    loadExistingUrls();
  }, [refreshTrigger]);

  // API call to shorten URL
  const generateShortUrl = async () => {
    setError(null);
    if (!isValidUrl || !validateTimestamp()) return;
    
    const token = localStorage.getItem("token")
    if (!token) {
      setError("Please log in to shorten URLs");
      return;
    }
    
    setIsLoading(true);
    try {
      const timestampPayload = (timestamp.hours || timestamp.minutes || timestamp.seconds) ? timestamp : undefined;
      
      const response = await fetch(`${API_BASE}/urls/shorten`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          originalUrl: url,
          customAlias: customAlias || undefined,
          timestamp: timestampPayload,
          analyticsEnabled: analytics,
          expiryDate: expiryDate || undefined,
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        setError(result.error || 'Failed to shorten URL');
        setIsLoading(false);
        return;
      }
      
      // Handle successful response
      const data = result.data;
      setShortenedUrls((prev) => [
        {
          id: data.id,
          originalUrl: data.originalUrl,
          shortUrl: data.shortUrl,
          customAlias: data.customAlias || undefined,
          timestamp: data.timestamp?.formatted || undefined,
          videoData: data.videoData ? {
            id: data.videoData.videoId,
            title: data.videoData.title,
            thumbnail: data.videoData.thumbnailUrl,
            duration: data.videoData.duration,
            durationSeconds: data.videoData.durationSeconds,
            channel: typeof data.videoData.channel === 'object' 
              ? data.videoData.channel.name || ''
              : data.videoData.channel || '',
            views: data.videoData.views,
          } : null,
          analytics: data.analyticsEnabled,
          clicks: 0, // Initial clicks
          createdAt: data.createdAt,
          expiryDate: data.expiresAt || undefined,
          qrCode: data.qrCode,
        },
        ...prev,
      ]);
      
      setUrl("");
      setCustomAlias("");
      setTimestamp({ hours: 0, minutes: 0, seconds: 0 });
      setVideoData(null);
      setExpiryDate("");
      
      toast({
        title: "URL Shortened Successfully!",
        description: "Your shortened URL has been generated.",
      });
    } catch (err) {
      console.error('Error shortening URL:', err);
      setError('Failed to connect to backend');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "Copied!",
      description: "URL copied to clipboard.",
    })
  }

  const openQRCode = (qrCodeUrl: string, shortUrl: string) => {
    if (qrCodeUrl) {
      // Create a new window to display the QR code
      const qrWindow = window.open('', '_blank', 'width=300,height=350');
      if (qrWindow) {
        qrWindow.document.write(`
          <html>
            <head><title>QR Code for ${shortUrl}</title></head>
            <body style="margin:0;padding:20px;text-align:center;font-family:Arial,sans-serif;">
              <h3>QR Code</h3>
              <img src="${qrCodeUrl}" alt="QR Code" style="max-width:100%;"/>
              <p style="word-break:break-all;margin-top:20px;">${shortUrl}</p>
            </body>
          </html>
        `);
        qrWindow.document.close();
      }
    } else {
      toast({
        title: "QR Code not available",
        description: "QR code could not be generated for this URL.",
      });
    }
  }

  const visitShortUrl = (shortUrl: string) => {
    window.open(shortUrl, '_blank');
  }

  // Bulk shorten API call
  const processBulkUrls = async () => {
    setError(null);
    if (bulkUrls.length === 0) return;
    
    const token = localStorage.getItem("token")
    if (!token) {
      setError("Please log in to shorten URLs");
      return;
    }
    
    setBulkUrls((prev) => prev.map((item) => ({ ...item, status: "processing" })));
    
    try {
      const response = await fetch(`${API_BASE}/urls/bulk-shorten`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          urls: bulkUrls.map((item) => ({
            url: item.url,
            customAlias: item.customAlias,
            timestamp: item.timestamp,
          })),
          analyticsEnabled: analytics,
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        setError(result.error || 'Bulk shorten failed');
        setBulkUrls((prev) => prev.map((item) => ({ ...item, status: "error", error: result.error })));
        return;
      }
      
      // Handle successful response
      const results = result.results;
      setBulkUrls(
        results.map((resultItem: any, idx: number) => ({
          id: Date.now().toString() + idx,
          url: resultItem.originalUrl,
          customAlias: resultItem.customAlias,
          timestamp: resultItem.timestampFormatted,
          status: resultItem.status === 'error' ? 'error' : 'completed',
          error: resultItem.error,
        }))
      );
      
      // Add successful ones to shortenedUrls
      const successful = results.filter((r: any) => r.status === 'success');
      setShortenedUrls((prev) => [
        ...successful.map((data: any) => ({
          id: Date.now().toString() + Math.random(),
          originalUrl: data.originalUrl,
          shortUrl: data.shortUrl,
          customAlias: data.customAlias || undefined,
          timestamp: data.timestampFormatted || undefined,
          videoData: data.videoData ? {
            id: data.videoData.videoId,
            title: data.videoData.title,
            thumbnail: data.videoData.thumbnailUrl,
            duration: data.videoData.duration,
            durationSeconds: data.videoData.durationSeconds,
            channel: typeof data.videoData.channel === 'object' 
              ? data.videoData.channel.name || ''
              : data.videoData.channel || '',
            views: data.videoData.views,
          } : null,
          analytics: analytics,
          clicks: 0,
          createdAt: new Date().toISOString(),
          expiryDate: undefined,
          qrCode: data.qrCodeUrl || '',
        })),
        ...prev,
      ]);
    } catch (err) {
      console.error('Error in bulk shorten:', err);
      setError('Failed to connect to backend');
      setBulkUrls((prev) => prev.map((item) => ({ ...item, status: "error", error: 'Network error' })));
    }
  };

  const removeBulkUrl = (id: string) => {
    setBulkUrls((prev) => prev.filter((item) => item.id !== id))
  }

  const addBulkUrl = () => {
    const urls = bulkInput.split("\n").filter((url) => url.trim());
    const newBulkUrls: BulkURL[] = urls.map((url) => ({
      id: Date.now().toString() + Math.random(),
      url: url.trim(),
      status: "pending",
    }));
    setBulkUrls((prev) => [...prev, ...newBulkUrls]);
    setBulkInput("");
  };

  const refreshData = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // Instead, let's create a function that only updates click counts
  const updateClickCounts = async () => {
    try {
      const token = localStorage.getItem("token")
      if (!token) return;

      const response = await fetch(`${API_BASE}/urls/my-urls?limit=50`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
      });

      if (response.ok) {
        const result = await response.json();
        const urls = result.data?.urls || [];
        
        // Update only the click counts for existing URLs
        setShortenedUrls(prev => 
          prev.map(existingUrl => {
            const updatedUrl = urls.find((url: any) => url._id === existingUrl.id);
            if (updatedUrl) {
              return {
                ...existingUrl,
                clicks: updatedUrl.clicks || 0
              };
            }
            return existingUrl;
          })
        );
      }
    } catch (error) {
      console.error('Failed to update click counts:', error);
      // Silent fail - don't show error to user
    }
  };

  // Update the handleRefresh function to only update clicks
  const handleRefresh = async () => {
    await updateClickCounts();
    toast({
      title: "Refreshed",
      description: "Click counts have been updated",
    });
  };

  // Don't render anything that depends on darkMode until mounted
  if (!mounted) {
    return <div className="min-h-screen" /> // Minimal fallback
  }

  return (
    <AuthGuard 
      message="You need to be logged in to use the URL shortener. Please log in to create shortened URLs with analytics and custom features."
      title="URL Shortener - Login Required"
    >
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
        <div className="pt-20 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <Link className="w-12 h-12 text-orange-500 mr-3" />
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-orange-500 to-red-600 bg-clip-text text-transparent">
                URL Shortener
              </h1>
            </div>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Create shortened YouTube URLs with custom timestamps, analytics, and QR codes for easy sharing.
            </p>
          </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto">
            <TabsTrigger value="single">Single URL</TabsTrigger>
            <TabsTrigger value="bulk">Bulk URLs</TabsTrigger>
          </TabsList>

          <img src="/flower1.webp" alt="flower" className="lg:w-[440px] lg:h-[720px] lg:top-[120px] md:w-[300px] md:h-[500px] md:top-[180px] absolute right-0 w-[250px] h-[380px] top-[200px] invisible sm:visible" />

          <TabsContent value="single" className="space-y-6">
            <div className={`grid ${videoData ? "lg:grid-cols-2" : "lg:grid-cols-1"} gap-6`}>
              <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50">
                <CardHeader>
                  <CardTitle className="flex items-center text-gray-900 dark:text-white">
                    <Link className="w-5 h-5 mr-2 text-orange-500" />
                    Shorten YouTube URL
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="url">YouTube URL</Label>
                    <div className="relative">
                      <Input
                        id="url"
                        type="url"
                        placeholder="https://www.youtube.com/watch?v=..."
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        className={`pr-10 ${isValidUrl ? "border-green-500" : url && !isValidUrl ? "border-red-500" : ""}`}
                      />
                      {url && (
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                          {isValidUrl ? (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-red-500" />
                          )}
                        </div>
                      )}
                    </div>
                    {url && !isValidUrl && <p className="text-sm text-red-500">Please enter a valid YouTube URL</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="alias">Custom Alias (Optional)</Label>
                    <Input
                      id="alias"
                      placeholder="my-custom-link"
                      value={customAlias}
                      onChange={(e) => setCustomAlias(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Start Time (Optional)</Label>
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center space-x-1">
                        <Input
                          type="number"
                          min="0"
                          max="23"
                          value={timestamp.hours}
                          onChange={(e) =>
                            setTimestamp((prev) => ({ ...prev, hours: Number.parseInt(e.target.value) || 0 }))
                          }
                          className="w-16 text-center"
                        />
                        <span className="text-sm text-gray-500">h</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Input
                          type="number"
                          min="0"
                          max="59"
                          value={timestamp.minutes}
                          onChange={(e) =>
                            setTimestamp((prev) => ({ ...prev, minutes: Number.parseInt(e.target.value) || 0 }))
                          }
                          className="w-16 text-center"
                        />
                        <span className="text-sm text-gray-500">m</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Input
                          type="number"
                          min="0"
                          max="59"
                          value={timestamp.seconds}
                          onChange={(e) =>
                            setTimestamp((prev) => ({ ...prev, seconds: Number.parseInt(e.target.value) || 0 }))
                          }
                          className="w-16 text-center"
                        />
                        <span className="text-sm text-gray-500">s</span>
                      </div>
                    </div>
                    {timestampError && (
                      <p className="text-sm text-red-500 flex items-center">
                        <AlertCircle className="w-4 h-4 mr-1" />
                        {timestampError}
                      </p>
                    )}
                  </div>

                  <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="analytics">Enable Analytics</Label>
                      <Switch id="analytics" checked={analytics} onCheckedChange={setAnalytics} />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="expiry">Expiry Date (Optional)</Label>
                      <Input
                        id="expiry"
                        type="date"
                        value={expiryDate}
                        onChange={(e) => setExpiryDate(e.target.value)}
                        min={new Date().toISOString().split("T")[0]}
                        className="focus:ring-orange-500 focus:border-orange-500 border-orange-200 dark:border-orange-700"
                      />
                    </div>
                  </div>

                  <Button
                    onClick={generateShortUrl}
                    disabled={!isValidUrl || isLoading || !!timestampError}
                    className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white"
                  >
                    {isLoading ? "Loading..." : "Shorten URL"}
                  </Button>
                  {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
                </CardContent>
              </Card>

              {videoData && (
                <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50">
                  <CardHeader>
                    <CardTitle className="flex items-center text-gray-900 dark:text-white">
                      <Play className="w-5 h-5 mr-2 text-orange-500" />
                      Video Preview
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="relative">
                      <Image
                        src={videoData.thumbnail || "/placeholder.svg"}
                        alt={videoData.title || "Video thumbnail"}
                        width={320}
                        height={180}
                        className="w-full rounded-lg object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "/placeholder.svg";
                        }}
                      />
                      <Badge className="absolute bottom-2 right-2 bg-black/80 text-white">{videoData.duration}</Badge>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-2">{videoData.title}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                        {videoData.channel} • {videoData.views}
                      </p>
                    </div>
                    <div className="flex items-center text-sm text-orange-600">
                      <Clock className="w-4 h-4 mr-1" />
                      Total Duration: {videoData.duration} ({videoData.durationSeconds}s)
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="bulk" className="space-y-6">
            <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50">
              <CardHeader>
                <CardTitle className="flex items-center text-gray-900 dark:text-white">
                  <Plus className="w-5 h-5 mr-2 text-orange-500" />
                  Bulk URL Shortening
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bulk-urls">YouTube URLs (one per line)</Label>
                  <Textarea
                    id="bulk-urls"
                    placeholder="https://www.youtube.com/watch?v=...                                                                                                                                                                                                                                                       
https://www.youtube.com/watch?v=...                                                                                                                                                                                                                                                       
https://youtu.be/..."
                    value={bulkInput}
                    onChange={(e) => setBulkInput(e.target.value)}
                    rows={6}
                  />
                </div>
                <div className="flex space-x-2">
                  <Button onClick={addBulkUrl} variant="outline">
                    Add URLs
                  </Button>
                  <Button
                    onClick={processBulkUrls}
                    disabled={bulkUrls.length === 0}
                    className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white"
                  >
                    Process All
                  </Button>
                </div>

                {bulkUrls.length > 0 && (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {bulkUrls.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.url}</p>
                          {item.error && <p className="text-xs text-red-500">{item.error}</p>}
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge
                            variant={
                              item.status === "completed"
                                ? "default"
                                : item.status === "error"
                                  ? "destructive"
                                  : item.status === "processing"
                                    ? "secondary"
                                    : "outline"
                            }
                          >
                            {item.status}
                          </Badge>
                          <Button size="sm" variant="ghost" onClick={() => removeBulkUrl(item.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {shortenedUrls.length > 0 && (
          <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-orange-200/50 dark:border-gray-700/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center text-gray-900 dark:text-white">
                  <CheckCircle className="w-5 h-5 mr-2 text-green-500" />
                  Generated Short URLs
                </CardTitle>
                <Button variant="outline" size="sm" onClick={handleRefresh}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Update Clicks
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingInitialData ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-gray-500">Loading your URLs...</div>
                </div>
              ) : (
                <div className="space-y-4">
                  {shortenedUrls.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 bg-gradient-to-r from-orange-50 to-red-50 dark:from-gray-700 dark:to-gray-600 rounded-lg"
                  >
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="flex items-center space-x-3">
                        <Image
                          src={item.videoData?.thumbnail || "/placeholder.svg"}
                          alt={item.videoData?.title || "Video thumbnail"}
                          width={80}
                          height={45}
                          className="rounded object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2">
                            {item.videoData?.title || "No title available"}
                          </p>
                          <p className="text-xs text-gray-500">{item.videoData?.channel || "Unknown channel"}</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Input value={item.shortUrl} readOnly className="text-sm" />
                          <Button size="sm" variant="outline" onClick={() => copyToClipboard(item.shortUrl)}>
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          {item.timestamp && (
                            <span className="flex items-center">
                              <Clock className="w-3 h-3 mr-1" />
                              {item.timestamp}
                            </span>
                          )}
                          {item.analytics && (
                            <span className="flex items-center">
                              <Eye className="w-3 h-3 mr-1" />
                              {item.clicks} clicks
                            </span>
                          )}
                          {item.expiryDate && (
                            <span className="flex items-center">
                              <Calendar className="w-3 h-3 mr-1" />
                              Expires: {new Date(item.expiryDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-end space-x-2">
                        <Button size="sm" variant="outline" onClick={() => openQRCode(item.qrCode, item.shortUrl)}>
                          <QrCode className="w-4 h-4 mr-1" />
                          QR Code
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => visitShortUrl(item.shortUrl)}>
                          <ExternalLink className="w-4 h-4 mr-1" />
                          Visit
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            </CardContent>
          </Card>
        )}
        </div>
        </div>
      </div>
    </AuthGuard>
  )
}

export default function URLShortenerPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center"><div className="text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" /><p>Loading...</p></div></div>}>
      <URLShortenerPageContent />
    </Suspense>
  )
}
