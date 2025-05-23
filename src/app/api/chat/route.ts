import { NextRequest, NextResponse } from 'next/server'
import { generateResponse, getQuickResponse } from '../../../lib/ai'

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json()
    
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Valid message is required' }, { status: 400 })
    }
    
    const cleanMessage = message.trim()
    
    if (cleanMessage.length === 0) {
      return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 })
    }
    
    let response: string
    
    try {
      response = await generateResponse(cleanMessage)
    } catch (error) {
      console.error('AI generation error:', error)
      response = getQuickResponse(cleanMessage)
    }
    
    return NextResponse.json({ 
      response: response,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Something went wrong! Please try again.' }, 
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({ 
    status: 'WTF Podcast AI is running! 🤖',
    timestamp: new Date().toISOString()
  })
}