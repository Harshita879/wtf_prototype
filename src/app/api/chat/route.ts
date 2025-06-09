import { NextRequest, NextResponse } from 'next/server'
import { generateResponse, getQuickResponse, getSystemStatus } from '../../../lib/ai'

export async function POST(request: NextRequest) {
  try {
    const { message, useEnhanced = false } = await request.json()
    
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Valid message is required' }, { status: 400 })
    }
    
    const cleanMessage = message.trim()
    
    if (cleanMessage.length === 0) {
      return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 })
    }
    
    // Rate limiting check (optional)
    if (cleanMessage.length > 500) {
      return NextResponse.json({ error: 'Message too long. Please keep it under 500 characters.' }, { status: 400 })
    }
    
    let response: string
    let processingTime: number
    const startTime = Date.now()
    
    try {
      // For now, use the original system (enhanced system will be integrated later)
      console.log('📝 Using RAG system...')
      response = await generateResponse(cleanMessage)
      
      processingTime = Date.now() - startTime
      console.log(`✅ Response generated in ${processingTime}ms`)
      
    } catch (error) {
      console.error('AI generation error:', error)
      response = getQuickResponse(cleanMessage)
      processingTime = Date.now() - startTime
    }
    
    // Add response metadata
    const responseData = {
      response: response,
      metadata: {
        processingTime: processingTime,
        systemUsed: useEnhanced ? 'enhanced' : 'original',
        timestamp: new Date().toISOString(),
        messageLength: cleanMessage.length
      }
    }
    
    return NextResponse.json(responseData)
    
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { 
        error: 'Something went wrong! Please try again.',
        timestamp: new Date().toISOString()
      }, 
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    
    // System status endpoint
    if (action === 'status') {
      console.log('📊 Checking system status...')
      try {
        const status = await getSystemStatus()
        return NextResponse.json({
          status: 'WTF Podcast AI is running! 🤖',
          systemDetails: JSON.parse(status),
          timestamp: new Date().toISOString()
        })
      } catch (error) {
        console.error('Status check failed:', error)
        return NextResponse.json({
          status: 'System status check failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }, { status: 500 })
      }
    }
    
    // Health check endpoint
    if (action === 'health') {
      return NextResponse.json({
        status: 'healthy',
        service: 'WTF Podcast AI',
        version: '2.0.0',
        features: {
          ragRetrieval: true,
          semanticSearch: true,
          keywordFallback: true
        },
        timestamp: new Date().toISOString()
      })
    }
    
    // Default response
    return NextResponse.json({ 
      status: 'WTF Podcast AI is running! 🤖',
      message: 'Send a POST request with your question',
      endpoints: {
        chat: 'POST /',
        status: 'GET /?action=status',
        health: 'GET /?action=health'
      },
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('GET endpoint error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to process request',
        timestamp: new Date().toISOString()
      }, 
      { status: 500 }
    )
  }
}

// Optional: Add OPTIONS for CORS if needed
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}