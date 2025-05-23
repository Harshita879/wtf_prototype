'use client'

import { useState } from 'react'
import ChatInterface from '../components/ui/ChatInterface'
import { MessageCircle, Users, Sparkles, Search, Bell, Menu } from 'lucide-react'
import Link from 'next/link'

export default function Home() {
  const [activeTab, setActiveTab] = useState('chat')

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">WTF Podcast AI</h1>
                <p className="text-sm text-gray-500">Ask Nikhil anything</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <Search className="w-5 h-5 text-gray-600" />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <Bell className="w-5 h-5 text-gray-600" />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <Menu className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex space-x-1">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex items-center space-x-2 px-4 py-3 rounded-t-lg font-medium text-sm transition-colors ${
                activeTab === 'chat'
                  ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <MessageCircle className="w-4 h-4" />
              <span>Chat</span>
            </button>
            <Link href="/community">
              <button className="flex items-center space-x-2 px-4 py-3 rounded-t-lg font-medium text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors">
                <Users className="w-4 h-4" />
                <span>Community</span>
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {activeTab === 'chat' && (
          <div className="space-y-6">
            {/* Welcome Section */}
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                Ask Nikhil Anything
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Get insights from podcast episodes on startups, real estate, gaming, and more
              </p>
            </div>

            {/* Topic Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[
                { title: "Real Estate", emoji: "🏠", color: "from-red-400 to-red-500", bg: "bg-red-50" },
                { title: "Gaming", emoji: "🎮", color: "from-blue-400 to-blue-500", bg: "bg-blue-50" },
                { title: "Startups", emoji: "🚀", color: "from-green-400 to-green-500", bg: "bg-green-50" },
                { title: "Investing", emoji: "💰", color: "from-yellow-400 to-yellow-500", bg: "bg-yellow-50" },
              ].map((topic, index) => (
                <div
                  key={index}
                  className={`${topic.bg} p-4 rounded-2xl hover:shadow-md transition-all cursor-pointer group`}
                >
                  <div className={`w-12 h-12 bg-gradient-to-r ${topic.color} rounded-xl flex items-center justify-center mb-3 group-hover:scale-105 transition-transform`}>
                    <span className="text-xl">{topic.emoji}</span>
                  </div>
                  <h3 className="font-semibold text-gray-900">{topic.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">Explore insights</p>
                </div>
              ))}
            </div>
            
            <ChatInterface />
          </div>
        )}
      </main>
    </div>
  )
}