'use client'

import { use, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, CheckCircle, XCircle, Users, Music } from "lucide-react"
import AuthGuard from "@/components/AuthGuard"

interface AcceptInvitePageProps {
  params: Promise<{ id: string }>
}

export default function AcceptInvitePage({ params }: AcceptInvitePageProps) {
  const resolvedParams = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  
  const [isLoading, setIsLoading] = useState(false)
  const [isAccepting, setIsAccepting] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)
  const [status, setStatus] = useState<'pending' | 'accepted' | 'rejected' | 'error'>('pending')
  const [invite, setInvite] = useState<any>(null)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    if (!token) {
      setError('Invalid invite token')
      setStatus('error')
      return
    }

    // Fetch invite details
    fetchInviteDetails()
  }, [token])

  const fetchInviteDetails = async () => {
    try {
      setIsLoading(true)
      console.log('Fetching invite details for token:', token)
      console.log('Playlist ID:', resolvedParams.id)
      console.log('Auth token:', localStorage.getItem('token'))
      
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
      const response = await fetch(`${backendUrl}/api/playlists/${resolvedParams.id}/collaborators/invite/${token}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })

      console.log('Response status:', response.status)
      console.log('Response ok:', response.ok)

      if (!response.ok) {
        const errorText = await response.text()
        console.log('Error response:', errorText)
        throw new Error('Failed to fetch invite details')
      }

      const data = await response.json()
      console.log('Invite data:', data)
      setInvite(data.invite)
    } catch (error: any) {
      console.error('Error fetching invite:', error)
      setError(error.message)
      setStatus('error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAccept = async () => {
    try {
      setIsAccepting(true)
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
      const response = await fetch(`${backendUrl}/api/playlists/${resolvedParams.id}/collaborators/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ token })
      })

      if (!response.ok) {
        throw new Error('Failed to accept invite')
      }

      setStatus('accepted')
      setTimeout(() => {
        router.push(`/playlists/${resolvedParams.id}`)
      }, 2000)
    } catch (error: any) {
      console.error('Error accepting invite:', error)
      setError(error.message)
      setStatus('error')
    } finally {
      setIsAccepting(false)
    }
  }

  const handleReject = async () => {
    try {
      setIsRejecting(true)
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
      const response = await fetch(`${backendUrl}/api/playlists/${resolvedParams.id}/collaborators/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ token })
      })

      if (!response.ok) {
        throw new Error('Failed to reject invite')
      }

      setStatus('rejected')
      setTimeout(() => {
        router.push('/playlists')
      }, 2000)
    } catch (error: any) {
      console.error('Error rejecting invite:', error)
      setError(error.message)
      setStatus('error')
    } finally {
      setIsRejecting(false)
    }
  }

  if (isLoading) {
    return (
      <AuthGuard>
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-md mx-auto">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span className="ml-2">Loading invite details...</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </AuthGuard>
    )
  }

  if (status === 'accepted') {
    return (
      <AuthGuard>
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-md mx-auto">
            <Card>
              <CardContent className="p-6 text-center">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">Invite Accepted!</h2>
                <p className="text-gray-600 mb-4">
                  You've successfully joined the playlist as a collaborator.
                </p>
                <p className="text-sm text-gray-500">
                  Redirecting to playlist...
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </AuthGuard>
    )
  }

  if (status === 'rejected') {
    return (
      <AuthGuard>
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-md mx-auto">
            <Card>
              <CardContent className="p-6 text-center">
                <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">Invite Rejected</h2>
                <p className="text-gray-600 mb-4">
                  You've declined the collaboration invite.
                </p>
                <p className="text-sm text-gray-500">
                  Redirecting to playlists...
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </AuthGuard>
    )
  }

  if (status === 'error') {
    return (
      <AuthGuard>
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-md mx-auto">
            <Card>
              <CardContent className="p-6 text-center">
                <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">Error</h2>
                <p className="text-gray-600 mb-4">{error}</p>
                <Button onClick={() => router.push('/playlists')}>
                  Go to Playlists
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </AuthGuard>
    )
  }

  return (
    <AuthGuard>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <Card>
            <CardHeader className="text-center">
              <div className="flex items-center justify-center mb-4">
                <Users className="h-8 w-8 text-blue-500" />
              </div>
              <CardTitle>Collaboration Invite</CardTitle>
              <CardDescription>
                You've been invited to collaborate on a playlist
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {invite && (
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-2">
                      <Music className="h-5 w-5 text-gray-500 mr-2" />
                      <h3 className="font-semibold">{invite.playlist?.name}</h3>
                    </div>
                    <p className="text-sm text-gray-600">
                      by {invite.inviter?.name}
                    </p>
                  </div>

                  <div className="text-center">
                    <Badge variant="secondary">
                      Role: {invite.permission_level}
                    </Badge>
                  </div>

                  <div className="flex space-x-3">
                    <Button 
                      onClick={handleAccept}
                      disabled={isAccepting || isRejecting}
                      className="flex-1"
                    >
                      {isAccepting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Accepting...
                        </>
                      ) : (
                        'Accept'
                      )}
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={handleReject}
                      disabled={isAccepting || isRejecting}
                      className="flex-1"
                    >
                      {isRejecting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Rejecting...
                        </>
                      ) : (
                        'Decline'
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AuthGuard>
  )
}
