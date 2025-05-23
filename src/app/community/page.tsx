'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Plus, Heart, MessageCircle, Share, MoreHorizontal, Search, Send, X, User, LogOut, LogIn, UserPlus, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'

interface Reply {
  id: string
  content: string
  author: string
  authorAvatar: string
  timestamp: string
  likes: number
  liked: boolean
  likedBy: string[]
}

interface Post {
  id: string
  title: string
  content: string
  author: string
  authorAvatar: string
  timestamp: string
  likes: number
  comments: number
  tags: string[]
  liked: boolean
  likedBy: string[]
  replies: Reply[]
  showReplies: boolean
}

interface User {
  id: string
  username: string
  email: string
  password: string
  avatar: string
  joinDate: string
}

export default function CommunityPage() {
  const [mounted, setMounted] = useState(false)
  const [posts, setPosts] = useState<Post[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [showNewPost, setShowNewPost] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const [isLogin, setIsLogin] = useState(true) // true for login, false for signup
  const [newPost, setNewPost] = useState({ title: '', content: '', tags: '' })
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [authForm, setAuthForm] = useState({ username: '', email: '', password: '', confirmPassword: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [authError, setAuthError] = useState('')

  // Load data from localStorage
  useEffect(() => {
    setMounted(true)
    
    // Load users from localStorage
    const savedUsers = localStorage.getItem('communityUsers')
    if (savedUsers) {
      setUsers(JSON.parse(savedUsers))
    }

    // Load current user from localStorage
    const savedCurrentUser = localStorage.getItem('currentUser')
    if (savedCurrentUser) {
      setCurrentUser(JSON.parse(savedCurrentUser))
    }

    // Load posts from localStorage or use defaults
    const savedPosts = localStorage.getItem('communityPosts')
    if (savedPosts) {
      setPosts(JSON.parse(savedPosts))
    } else {
      // Default posts
      const defaultPosts = [
        {
          id: '1',
          title: 'Just started my real estate journey! 🏠',
          content: 'Applied everything from Nikhil\'s real estate episode. Found a small plot for JDA. Wish me luck guys! Any tips for a complete beginner?',
          author: 'PropertyNewbie',
          authorAvatar: 'PN',
          timestamp: '1/15/2024',
          likes: 24,
          comments: 2,
          tags: ['real-estate', 'beginner', 'jda'],
          liked: false,
          likedBy: [],
          showReplies: false,
          replies: [
            {
              id: '1-1',
              content: 'Congratulations! Make sure to get proper legal verification before finalizing. JDA plots can be tricky.',
              author: 'LegalExpert',
              authorAvatar: 'LE',
              timestamp: '1/15/2024',
              likes: 5,
              liked: false,
              likedBy: []
            },
            {
              id: '1-2',
              content: 'Great choice! JDA plots have good appreciation potential. Just ensure clear title.',
              author: 'RealEstateVet',
              authorAvatar: 'RV',
              timestamp: '1/15/2024',
              likes: 3,
              liked: false,
              likedBy: []
            }
          ]
        },
        {
          id: '2', 
          title: 'Gaming content creation tips? 🎮',
          content: 'Want to start a gaming channel after listening to the gaming episode. What\'s the best platform to start with? YouTube or Twitch?',
          author: 'GamerGirl2024',
          authorAvatar: 'GG',
          timestamp: '1/14/2024',
          likes: 18,
          comments: 1,
          tags: ['gaming', 'content-creation', 'advice'],
          liked: false,
          likedBy: [],
          showReplies: false,
          replies: [
            {
              id: '2-1',
              content: 'Start with YouTube for long-form content, then move to Twitch for live streaming once you have an audience.',
              author: 'ContentCreator',
              authorAvatar: 'CC',
              timestamp: '1/14/2024',
              likes: 8,
              liked: false,
              likedBy: []
            }
          ]
        },
        {
          id: '3',
          title: 'Successfully raised ₹50L for my startup! 💰',
          content: 'Used the pitch strategies from the VC episode. Took 6 months but finally got our first round! AMA about fundraising.',
          author: 'StartupFounder',
          authorAvatar: 'SF',
          timestamp: '1/13/2024',
          likes: 67,
          comments: 0,
          tags: ['startup', 'fundraising', 'success-story'],
          liked: false,
          likedBy: [],
          showReplies: false,
          replies: []
        }
      ]
      setPosts(defaultPosts)
      localStorage.setItem('communityPosts', JSON.stringify(defaultPosts))
    }
  }, [])

  // Save data to localStorage whenever it changes
  useEffect(() => {
    if (mounted && posts.length > 0) {
      localStorage.setItem('communityPosts', JSON.stringify(posts))
    }
  }, [posts, mounted])

  useEffect(() => {
    if (mounted && users.length > 0) {
      localStorage.setItem('communityUsers', JSON.stringify(users))
    }
  }, [users, mounted])

  const generateAvatar = (name: string) => {
    return name.split(' ').map(word => word[0]).join('').toUpperCase().substring(0, 2)
  }

  const validateForm = () => {
    setAuthError('')
    
    if (!authForm.username.trim()) {
      setAuthError('Username is required')
      return false
    }

    if (!authForm.password.trim()) {
      setAuthError('Password is required')
      return false
    }

    if (!isLogin) {
      if (!authForm.email.trim()) {
        setAuthError('Email is required')
        return false
      }
      
      if (authForm.password.length < 6) {
        setAuthError('Password must be at least 6 characters')
        return false
      }

      if (authForm.password !== authForm.confirmPassword) {
        setAuthError('Passwords do not match')
        return false
      }

      // Check if username already exists
      if (users.some(user => user.username.toLowerCase() === authForm.username.toLowerCase())) {
        setAuthError('Username already exists')
        return false
      }

      // Check if email already exists
      if (users.some(user => user.email.toLowerCase() === authForm.email.toLowerCase())) {
        setAuthError('Email already exists')
        return false
      }
    }

    return true
  }

  const handleSignup = () => {
    if (!validateForm()) return

    const newUser: User = {
      id: Date.now().toString(),
      username: authForm.username.trim(),
      email: authForm.email.trim(),
      password: authForm.password, // In real apps, this should be hashed
      avatar: generateAvatar(authForm.username),
      joinDate: new Date().toLocaleDateString()
    }

    const updatedUsers = [...users, newUser]
    setUsers(updatedUsers)
    setCurrentUser(newUser)
    localStorage.setItem('currentUser', JSON.stringify(newUser))
    
    setShowAuth(false)
    setAuthForm({ username: '', email: '', password: '', confirmPassword: '' })
    setAuthError('')
  }

  const handleLogin = () => {
    if (!validateForm()) return

    const user = users.find(u => 
      u.username.toLowerCase() === authForm.username.toLowerCase() && 
      u.password === authForm.password
    )

    if (!user) {
      setAuthError('Invalid username or password')
      return
    }

    setCurrentUser(user)
    localStorage.setItem('currentUser', JSON.stringify(user))
    setShowAuth(false)
    setAuthForm({ username: '', email: '', password: '', confirmPassword: '' })
    setAuthError('')
  }

  const handleLogout = () => {
    setCurrentUser(null)
    localStorage.removeItem('currentUser')
  }

  const handleSubmitPost = () => {
    if (!currentUser) {
      alert('Please login to create a post')
      return
    }

    if (!newPost.title.trim() || !newPost.content.trim()) {
      alert('Please fill in title and content')
      return
    }

    const post: Post = {
      id: Date.now().toString(),
      title: newPost.title,
      content: newPost.content,
      author: currentUser.username,
      authorAvatar: currentUser.avatar,
      timestamp: new Date().toLocaleDateString(),
      likes: 0,
      comments: 0,
      tags: newPost.tags.split(',').map(tag => tag.trim()).filter(Boolean),
      liked: false,
      likedBy: [],
      showReplies: false,
      replies: []
    }

    const updatedPosts = [post, ...posts]
    setPosts(updatedPosts)
    setNewPost({ title: '', content: '', tags: '' })
    setShowNewPost(false)
  }

  const handleLike = (postId: string) => {
    if (!currentUser) {
      alert('Please login to like posts')
      return
    }

    const updatedPosts = posts.map(post => {
      if (post.id === postId) {
        // Ensure likedBy array exists
        const likedBy = post.likedBy || []
        const isLiked = likedBy.includes(currentUser.id)
        const newLikedBy = isLiked 
          ? likedBy.filter(id => id !== currentUser.id)
          : [...likedBy, currentUser.id]
        
        return {
          ...post,
          likes: newLikedBy.length,
          liked: !isLiked,
          likedBy: newLikedBy
        }
      }
      return post
    })
    setPosts(updatedPosts)
  }

  const handleReplyLike = (postId: string, replyId: string) => {
    if (!currentUser) {
      alert('Please login to like replies')
      return
    }

    const updatedPosts = posts.map(post => 
      post.id === postId 
        ? {
            ...post,
            replies: post.replies.map(reply => {
              if (reply.id === replyId) {
                // Ensure likedBy array exists
                const likedBy = reply.likedBy || []
                const isLiked = likedBy.includes(currentUser.id)
                const newLikedBy = isLiked 
                  ? likedBy.filter(id => id !== currentUser.id)
                  : [...likedBy, currentUser.id]
                
                return {
                  ...reply,
                  likes: newLikedBy.length,
                  liked: !isLiked,
                  likedBy: newLikedBy
                }
              }
              return reply
            })
          }
        : post
    )
    setPosts(updatedPosts)
  }

  const handleShare = async (post: Post) => {
    const shareData = {
      title: post.title,
      text: post.content,
      url: window.location.href
    }

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData)
      } catch (error) {
        console.log('Share failed:', error)
      }
    } else {
      const textToShare = `${post.title}\n\n${post.content}\n\n${window.location.href}`
      try {
        await navigator.clipboard.writeText(textToShare)
        alert('Post copied to clipboard!')
      } catch (error) {
        const textArea = document.createElement('textarea')
        textArea.value = textToShare
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
        alert('Post copied to clipboard!')
      }
    }
  }

  const toggleReplies = (postId: string) => {
    const updatedPosts = posts.map(post => 
      post.id === postId 
        ? { ...post, showReplies: !post.showReplies }
        : post
    )
    setPosts(updatedPosts)
  }

  const handleSubmitReply = (postId: string) => {
    if (!currentUser) {
      alert('Please login to reply')
      return
    }

    if (!replyContent.trim()) {
      alert('Please enter a reply')
      return
    }

    const reply: Reply = {
      id: `${postId}-${Date.now()}`,
      content: replyContent,
      author: currentUser.username,
      authorAvatar: currentUser.avatar,
      timestamp: new Date().toLocaleDateString(),
      likes: 0,
      liked: false,
      likedBy: []
    }

    const updatedPosts = posts.map(post => 
      post.id === postId 
        ? { 
            ...post, 
            replies: [...post.replies, reply],
            comments: post.comments + 1,
            showReplies: true
          }
        : post
    )
    setPosts(updatedPosts)

    setReplyContent('')
    setReplyingTo(null)
  }

  const getTagColor = (tag: string) => {
    const colors = {
      'real-estate': 'bg-red-100 text-red-700',
      'gaming': 'bg-blue-100 text-blue-700',
      'startup': 'bg-green-100 text-green-700',
      'investment': 'bg-yellow-100 text-yellow-700',
      'advice': 'bg-purple-100 text-purple-700',
      'fundraising': 'bg-green-100 text-green-700',
      'success-story': 'bg-yellow-100 text-yellow-700',
      'content-creation': 'bg-pink-100 text-pink-700',
      'beginner': 'bg-gray-100 text-gray-700',
      'jda': 'bg-orange-100 text-orange-700'
    }
    return colors[tag as keyof typeof colors] || 'bg-gray-100 text-gray-700'
  }

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading community...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Link href="/">
                <button className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                  <ArrowLeft className="w-5 h-5 text-gray-600" />
                </button>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Community</h1>
                <p className="text-sm text-gray-500">Share insights & discuss episodes</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              {currentUser ? (
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                      {currentUser.avatar}
                    </div>
                    <span className="text-sm font-medium text-gray-700">{currentUser.username}</span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                    title="Logout"
                  >
                    <LogOut className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      setIsLogin(true)
                      setShowAuth(true)
                    }}
                    className="flex items-center space-x-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                  >
                    <LogIn className="w-4 h-4 text-gray-600" />
                    <span className="text-sm font-medium text-gray-700">Login</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsLogin(false)
                      setShowAuth(true)
                    }}
                    className="flex items-center space-x-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span className="text-sm font-medium">Sign Up</span>
                  </button>
                </div>
              )}
              
              <button className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <Search className="w-5 h-5 text-gray-600" />
              </button>
              <button
                onClick={() => {
                  if (!currentUser) {
                    alert('Please login to create a post')
                    return
                  }
                  setShowNewPost(true)
                }}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center space-x-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>New Post</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Auth Modal */}
        {showAuth && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
              <div className="flex items-center justify-between p-6 pb-4">
                <h3 className="text-xl font-semibold text-gray-900">
                  {isLogin ? 'Login to Community' : 'Sign Up for Community'}
                </h3>
                <button
                  onClick={() => {
                    setShowAuth(false)
                    setAuthError('')
                    setAuthForm({ username: '', email: '', password: '', confirmPassword: '' })
                  }}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="px-6 pb-6">
                {authError && (
                  <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-xl text-sm">
                    {authError}
                  </div>
                )}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                    <input
                      type="text"
                      placeholder="Enter your username"
                      value={authForm.username}
                      onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    />
                  </div>
                  {!isLogin && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        placeholder="Enter your email"
                        value={authForm.email}
                        onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter your password"
                        value={authForm.password}
                        onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 pr-12"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                  {!isLogin && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                      <input
                        type="password"
                        placeholder="Confirm your password"
                        value={authForm.confirmPassword}
                        onChange={(e) => setAuthForm({ ...authForm, confirmPassword: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      />
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between mt-6">
                  <button
                    onClick={() => {
                      setIsLogin(!isLogin)
                      setAuthError('')
                      setAuthForm({ username: '', email: '', password: '', confirmPassword: '' })
                    }}
                    className="text-sm text-blue-500 hover:text-blue-600 font-medium"
                  >
                    {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Login'}
                  </button>
                  <button
                    onClick={isLogin ? handleLogin : handleSignup}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-xl font-medium transition-colors"
                  >
                    {isLogin ? 'Login' : 'Sign Up'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* New Post Modal */}
        {showNewPost && currentUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
              <div className="flex items-center justify-between p-6 pb-4">
                <h3 className="text-xl font-semibold text-gray-900">Create New Post</h3>
                <button
                  onClick={() => setShowNewPost(false)}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="px-6 pb-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                    <input
                      type="text"
                      placeholder="Post title..."
                      value={newPost.title}
                      onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                    <textarea
                      placeholder="Share your thoughts, questions, or success stories..."
                      value={newPost.content}
                      onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                      rows={4}
                      className="w-full px-4 py-3 bg-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
                    <input
                      type="text"
                      placeholder="Tags (comma separated): startup, real-estate, gaming"
                      value={newPost.tags}
                      onChange={(e) => setNewPost({ ...newPost, tags: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-end space-x-3 mt-6">
                  <button
                    onClick={() => setShowNewPost(false)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitPost}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-xl font-medium transition-colors"
                  >
                    Post
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Login Required Message */}
        {!currentUser && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Join the Community</h3>
                <p className="text-gray-600 mb-3">Login or sign up to create posts, reply to discussions, and connect with other listeners.</p>
                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      setIsLogin(true)
                      setShowAuth(true)
                    }}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                  >
                    Login
                  </button>
                  <button
                    onClick={() => {
                      setIsLogin(false)
                      setShowAuth(true)
                    }}
                    className="bg-white hover:bg-gray-50 text-blue-500 border border-blue-500 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                  >
                    Sign Up
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Posts Feed */}
        <div className="space-y-4">
          {posts.map((post) => (
            <div key={post.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
              {/* Post Header */}
              <div className="p-4 pb-0">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                      {post.authorAvatar}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">@{post.author}</p>
                      <p className="text-sm text-gray-500">{post.timestamp}</p>
                    </div>
                  </div>
                  <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <MoreHorizontal className="w-4 h-4 text-gray-400" />
                  </button>
                </div>

                {/* Post Content */}
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{post.title}</h3>
                <p className="text-gray-700 leading-relaxed mb-3">{post.content}</p>

                {/* Tags */}
                {post.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {post.tags.map((tag, index) => (
                      <span
                        key={index}
                        className={`px-3 py-1 rounded-full text-xs font-medium ${getTagColor(tag)}`}
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Post Actions */}
              <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-6">
                    <button
                      onClick={() => handleLike(post.id)}
                      className={`flex items-center space-x-2 text-sm font-medium transition-colors ${
                        currentUser && post.likedBy && post.likedBy.includes(currentUser.id) ? 'text-red-500' : 'text-gray-600 hover:text-red-500'
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${currentUser && post.likedBy && post.likedBy.includes(currentUser.id) ? 'fill-current' : ''}`} />
                      <span>{post.likes}</span>
                    </button>
                    
                    <button 
                      onClick={() => toggleReplies(post.id)}
                      className="flex items-center space-x-2 text-sm font-medium text-gray-600 hover:text-blue-500 transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>{post.comments}</span>
                    </button>

                    <button
                      onClick={() => {
                        if (!currentUser) {
                          alert('Please login to reply')
                          return
                        }
                        setReplyingTo(replyingTo === post.id ? null : post.id)
                      }}
                      className="flex items-center space-x-2 text-sm font-medium text-gray-600 hover:text-blue-500 transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>Reply</span>
                    </button>
                    
                    <button 
                      onClick={() => handleShare(post)}
                      className="flex items-center space-x-2 text-sm font-medium text-gray-600 hover:text-green-500 transition-colors"
                    >
                      <Share className="w-4 h-4" />
                      <span>Share</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Reply Form */}
              {replyingTo === post.id && currentUser && (
                <div className="px-4 py-4 border-t border-gray-100 bg-gray-50">
                  <div className="flex space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-semibold">
                        {currentUser.avatar}
                      </span>
                    </div>
                    <div className="flex-1 space-y-3">
                      <textarea
                        value={replyContent}
                        onChange={(e) => setReplyContent(e.target.value)}
                        placeholder="Write your reply..."
                        rows={3}
                        className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white"
                      />
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => setReplyingTo(null)}
                          className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-xl transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSubmitReply(post.id)}
                          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl font-medium transition-colors flex items-center space-x-2"
                        >
                          <Send className="w-4 h-4" />
                          <span>Reply</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Replies */}
              {post.showReplies && post.replies.length > 0 && (
                <div className="px-4 py-4 border-t border-gray-100 bg-gray-50">
                  <div className="space-y-4">
                    {post.replies.map(reply => (
                      <div key={reply.id} className="flex space-x-3">
                        <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-teal-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-xs font-semibold">{reply.authorAvatar}</span>
                        </div>
                        <div className="flex-1">
                          <div className="bg-white rounded-xl p-4 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-2">
                                <span className="font-medium text-gray-900 text-sm">@{reply.author}</span>
                                <span className="text-xs text-gray-500">{reply.timestamp}</span>
                              </div>
                              <button
                                onClick={() => handleReplyLike(post.id, reply.id)}
                                className={`flex items-center space-x-1 px-2 py-1 rounded-lg transition-colors ${
                                  currentUser && reply.likedBy && reply.likedBy.includes(currentUser.id) ? 'text-red-500' : 'text-gray-600 hover:text-red-500'
                                }`}
                              >
                                <Heart className={`w-3 h-3 ${currentUser && reply.likedBy && reply.likedBy.includes(currentUser.id) ? 'fill-current' : ''}`} />
                                <span className="text-xs">{reply.likes}</span>
                              </button>
                            </div>
                            <p className="text-gray-700 text-sm leading-relaxed">{reply.content}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Empty State */}
        {posts.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No posts yet</h3>
            <p className="text-gray-600 mb-6">Be the first to share your insights!</p>
            {currentUser ? (
              <button
                onClick={() => setShowNewPost(true)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-xl font-medium transition-colors"
              >
                Create First Post
              </button>
            ) : (
              <button
                onClick={() => {
                  setIsLogin(false)
                  setShowAuth(true)
                }}
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-xl font-medium transition-colors"
              >
                Sign Up to Post
              </button>
            )}
          </div>
        )}
      </main>

      {/* Floating Action Button */}
      {currentUser && (
        <div className="fixed bottom-6 right-6">
          <button
            onClick={() => setShowNewPost(true)}
            className="w-14 h-14 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-lg hover:shadow-xl flex items-center justify-center transition-all"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>
      )}
    </div>
  )
}