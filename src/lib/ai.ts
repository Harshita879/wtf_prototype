// ai.ts
// Simple, reliable podcast Q&A system

import { promises as fs } from 'fs'
import path from 'path'

// --- CONFIGURATION ---
const GROQ_API_KEY = process.env.GROQ_API_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

if (!GROQ_API_KEY) {
  console.error('❌ GROQ_API_KEY environment variable is required')
}
if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY environment variable is required')
}

// --- TYPES ---
interface Chunk {
  text: string
  episode: string
  index: number
  embedding?: number[]
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

// --- GLOBAL STATE ---
let chunks: Chunk[] = []
let isReady = false
let initError: string | null = null

// --- HELPER FUNCTIONS ---
function log(message: string, data?: any) {
  console.log(`[AI] ${message}`, data ? JSON.stringify(data, null, 2) : '')
}

// Calculate similarity between two vectors
function similarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0
  
  let dot = 0, magA = 0, magB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }
  
  const magnitude = Math.sqrt(magA * magB)
  return magnitude > 0 ? dot / magnitude : 0
}

// Get embedding from OpenAI with detailed error handling
async function getEmbedding(text: string): Promise<number[] | null> {
  if (!OPENAI_API_KEY) {
    log('❌ No OpenAI API key provided')
    return null
  }
  
  if (!text.trim() || text.trim().length < 10) {
    log('❌ Text too short for embedding')
    return null
  }
  
  try {
    log(`🔄 Creating embedding for text: "${text.slice(0, 50)}..."`)
    
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input: text.trim()
      })
    })
    
    log(`OpenAI response status: ${response.status}`)
    
    if (!response.ok) {
      const errorBody = await response.text()
      log(`❌ OpenAI API error ${response.status}:`, errorBody)
      
      if (response.status === 401) {
        log('❌ Invalid OpenAI API key - check your OPENAI_API_KEY')
      } else if (response.status === 429) {
        log('❌ Rate limit exceeded - waiting before retry')
      } else if (response.status === 403) {
        log('❌ API quota exceeded or billing issue')
      }
      
      return null
    }
    
    const data = await response.json()
    
    if (!data.data || !data.data[0] || !data.data[0].embedding) {
      log('❌ Invalid embedding response structure:', data)
      return null
    }
    
    log('✅ Embedding created successfully')
    return data.data[0].embedding
    
  } catch (error) {
    log('❌ Embedding request failed:', error)
    return null
  }
}

// Initialize the system - load and embed transcripts
async function initialize(): Promise<void> {
  if (isReady || initError) return
  
  try {
    log('🚀 Initializing transcript system...')
    
    // Find transcript files
    const transcriptPath = path.join(process.cwd(), 'public', 'transcripts')
    log(`Looking for transcripts in: ${transcriptPath}`)
    
    let files: string[] = []
    try {
      files = await fs.readdir(transcriptPath)
      files = files.filter(f => f.endsWith('.txt'))
    } catch (error) {
      initError = `Cannot access transcript directory: ${transcriptPath}`
      log(initError)
      return
    }
    
    if (files.length === 0) {
      initError = 'No .txt transcript files found'
      log(initError)
      return
    }
    
    log(`Found ${files.length} transcript files`)
    
    // Process each transcript file
    let totalChunks = 0
    for (const filename of files) {
      try {
        const filePath = path.join(transcriptPath, filename)
        const content = await fs.readFile(filePath, 'utf-8')
        const episodeName = filename.replace('.txt', '')
        
        if (content.trim().length < 100) {
          log(`Skipping ${filename} - too short`)
          continue
        }
        
        // Split into chunks of ~500 characters
        const chunkSize = 500
        let chunkIndex = 0
        
        for (let i = 0; i < content.length; i += chunkSize) {
          const chunkText = content.slice(i, i + chunkSize).trim()
          if (chunkText.length > 50) {
            chunks.push({
              text: chunkText,
              episode: filename.replace('.txt', ''), // Remove .txt extension
              index: chunkIndex++
            })
            totalChunks++
          }
        }
        
        log(`Processed ${filename}: ${chunkIndex} chunks`)
        
      } catch (error) {
        log(`Error reading ${filename}:`, error)
      }
    }
    
    if (totalChunks === 0) {
      initError = 'No valid content chunks created from transcripts'
      log(initError)
      return
    }
    
    log(`📄 Created ${totalChunks} total chunks`)
    
    // Create embeddings with better error handling
    const chunksToEmbed = chunks.slice(0, 50) // Limit to first 50 chunks for testing
    log(`🔄 Creating embeddings for ${chunksToEmbed.length} chunks...`)
    log('⚠️ Note: If this fails, the system will use keyword search instead')
    
    let embeddedCount = 0
    let consecutiveFailures = 0
    
    for (let i = 0; i < chunksToEmbed.length; i++) {
      const chunk = chunksToEmbed[i]
      
      // Show progress every 5 chunks
      if (i % 5 === 0) {
        log(`Embedding progress: ${i + 1}/${chunksToEmbed.length} (${embeddedCount} successful)`)
      }
      
      const embedding = await getEmbedding(chunk.text)
      if (embedding) {
        chunk.embedding = embedding
        embeddedCount++
        consecutiveFailures = 0
      } else {
        consecutiveFailures++
        
        // If we have too many consecutive failures, stop trying
        if (consecutiveFailures >= 5) {
          log('❌ Too many consecutive embedding failures, stopping')
          break
        }
      }
      
      // Add delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    
    log(`✅ Successfully embedded ${embeddedCount}/${chunksToEmbed.length} chunks`)
    
    // Don't fail if we have no embeddings - we'll use keyword search instead
    if (embeddedCount === 0) {
      log('⚠️ No embeddings created, but system will use keyword search fallback')
    }
    
    isReady = true
    log('🎉 System ready!')
    
  } catch (error) {
    initError = `Initialization failed: ${error}`
    log(initError)
  }
}

// Enhanced keyword search with better relevance
function searchByKeywordsEnhanced(query: string): Chunk[] {
  log('🔍 Using enhanced keyword search')
  
  const expandedQuery = expandQueryTerms(query)
  const queryWords = expandedQuery.toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 2)
  
  if (queryWords.length === 0) return []
  
  // Detect query topics for episode filtering
  const queryTopics = detectQueryTopics(query.toLowerCase())
  log(`🎯 Detected topics: ${queryTopics.join(', ')}`)
  
  const results = chunks
    .map(chunk => {
      const text = chunk.text.toLowerCase()
      const episodeName = chunk.episode.toLowerCase()
      
      // Calculate multiple relevance signals
      const contentRelevance = calculateContentRelevance(query, chunk.text)
      const topicRelevance = calculateTopicRelevance(queryTopics, episodeName)
      const keywordScore = calculateKeywordScore(queryWords, text, query.toLowerCase())
      
      // Combined score with weights
      const totalScore = (contentRelevance * 0.4) + (topicRelevance * 0.3) + (keywordScore * 0.3)
      
      return { 
        chunk, 
        score: totalScore, 
        contentRelevance,
        topicRelevance,
        keywordScore
      }
    })
    .filter(result => result.score > 0.2) // Higher threshold
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
  
  log(`Found ${results.length} enhanced matches`)
  results.forEach(r => {
    log(`  ${r.chunk.episode} (total: ${r.score.toFixed(3)}, content: ${r.contentRelevance.toFixed(3)}, topic: ${r.topicRelevance.toFixed(3)}): ${r.chunk.text.slice(0, 80)}...`)
  })
  
  return results.map(r => r.chunk)
}

function calculateTopicRelevance(queryTopics: string[], episodeName: string): number {
  if (queryTopics.length === 0) return 0.5 // Neutral if no topics detected
  
  let relevance = 0
  queryTopics.forEach(topic => {
    if (episodeName.includes(topic)) {
      relevance += 1
    }
  })
  
  return Math.min(relevance / queryTopics.length, 1)
}

function calculateKeywordScore(queryWords: string[], text: string, originalQuery: string): number {
  let score = 0
  let matchedWords = 0
  
  queryWords.forEach(word => {
    const matches = (text.match(new RegExp(word, 'g')) || []).length
    if (matches > 0) {
      score += matches
      matchedWords++
    }
  })
  
  // Boost for exact phrase
  if (text.includes(originalQuery)) {
    score += 5
  }
  
  // Require reasonable word coverage
  const coverage = matchedWords / queryWords.length
  if (coverage < 0.3) {
    score *= 0.5 // Penalize poor coverage
  }
  
  return Math.min(score / 10, 1) // Normalize
}

// Detect query topics to filter relevant episodes
function detectQueryTopics(query: string): string[] {
  const topicKeywords = [
    { keywords: ['gaming', 'game', 'games', 'esports', 'mobile gaming', 'pc gaming'], topic: 'gaming' },
    { keywords: ['startup', 'business', 'entrepreneur', 'company', 'venture'], topic: 'startup' },
    { keywords: ['restaurant', 'food', 'dining', 'kitchen', 'chef', 'menu'], topic: 'restaurant' },
    { keywords: ['tech', 'technology', 'software', 'coding', 'programming', 'ai'], topic: 'tech' },
    { keywords: ['investing', 'investment', 'finance', 'money', 'funding', 'vc'], topic: 'investing' },
    { keywords: ['marketing', 'brand', 'advertising', 'content', 'social media'], topic: 'marketing' },
    { keywords: ['real estate', 'property', 'housing', 'construction'], topic: 'real estate' },
    { keywords: ['ev', 'electric vehicle', 'automotive', 'car', 'vehicle', 'battery'], topic: 'ev' }
  ]
  
  const detectedTopics: string[] = []
  
  topicKeywords.forEach(({ keywords, topic }) => {
    if (keywords.some(keyword => query.includes(keyword))) {
      detectedTopics.push(topic)
    }
  })
  
  return detectedTopics
}
// Enhanced search with better query understanding
async function findRelevantChunks(query: string): Promise<Chunk[]> {
  await initialize()
  
  if (!isReady) {
    log('❌ System not ready')
    return []
  }
  
  // Expand query with synonyms and related terms for better matching
  const expandedQuery = expandQueryTerms(query)
  log(`🔍 Expanded query: "${query}" → "${expandedQuery}"`)
  
  // First try semantic search with embeddings
  const queryEmbedding = await getEmbedding(expandedQuery)
  
  if (queryEmbedding) {
    log('🎯 Using semantic search')
    
    const withEmbeddings = chunks.filter(chunk => chunk.embedding)
    log(`Searching ${withEmbeddings.length} embedded chunks`)
    
    if (withEmbeddings.length > 0) {
      const results = withEmbeddings
        .map(chunk => ({
          chunk,
          score: similarity(queryEmbedding, chunk.embedding!),
          contentRelevance: calculateContentRelevance(query, chunk.text)
        }))
        .filter(result => result.score > 0.15 && result.contentRelevance > 0.3) // Dual threshold
        .sort((a, b) => (b.score * 0.7 + b.contentRelevance * 0.3) - (a.score * 0.7 + a.contentRelevance * 0.3)) // Weighted scoring
        .slice(0, 5) // Get more candidates initially
      
      if (results.length > 0) {
        log(`✅ Found ${results.length} semantic matches`)
        results.forEach(r => {
          log(`  ${r.chunk.episode} (semantic: ${r.score.toFixed(3)}, content: ${r.contentRelevance.toFixed(3)}): ${r.chunk.text.slice(0, 100)}...`)
        })
        
        // Take top 3 after filtering
        return results.slice(0, 3).map(r => r.chunk)
      }
    }
  }
  
  // Fallback to enhanced keyword search
  log('⚠️ Falling back to enhanced keyword search')
  return searchByKeywordsEnhanced(query)
}

// Expand query with synonyms and related terms
function expandQueryTerms(query: string): string {
  const expansions: { [key: string]: string[] } = {
    'edtech': ['education technology', 'online learning', 'educational software', 'learning platforms'],
    'fintech': ['financial technology', 'digital payments', 'banking technology', 'financial services'],
    'games': ['gaming', 'video games', 'mobile games', 'game development', 'esports'],
    'startup': ['business', 'entrepreneur', 'company', 'venture', 'new business'],
    'restaurant': ['food business', 'dining', 'food service', 'hospitality', 'culinary'],
    'build': ['create', 'develop', 'start', 'establish', 'launch', 'make'],
    'opportunities': ['chances', 'prospects', 'possibilities', 'potential', 'options']
  }
  
  let expandedQuery = query.toLowerCase()
  
  Object.entries(expansions).forEach(([key, synonyms]) => {
    if (expandedQuery.includes(key)) {
      expandedQuery += ' ' + synonyms.join(' ')
    }
  })
  
  return expandedQuery
}

// Calculate content relevance based on keyword density and context
function calculateContentRelevance(query: string, text: string): number {
  const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2)
  const textLower = text.toLowerCase()
  
  let relevanceScore = 0
  let totalMatches = 0
  
  queryWords.forEach(word => {
    const wordCount = (textLower.match(new RegExp(word, 'g')) || []).length
    if (wordCount > 0) {
      relevanceScore += wordCount * (word.length / 10) // Longer words get more weight
      totalMatches += wordCount
    }
  })
  
  // Boost for exact phrase matches
  if (textLower.includes(query.toLowerCase())) {
    relevanceScore += 2
  }
  
  // Normalize by text length to avoid bias toward longer texts
  const normalizedScore = relevanceScore / (text.length / 100)
  
  return Math.min(normalizedScore, 1) // Cap at 1
}

// Call Groq API to generate response
async function generateWithGroq(messages: ChatMessage[]): Promise<string> {
  if (!GROQ_API_KEY) {
    return 'Error: GROQ_API_KEY not configured'
  }
  
  log('Calling Groq API...')
  
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: messages,
        max_tokens: 800, // Longer responses for better analysis
        temperature: 0.3 // Slightly more creative for synthesis
      })
    })
    
    log(`Groq response status: ${response.status}`)
    
    if (!response.ok) {
      const errorText = await response.text()
      log('Groq error:', errorText)
      
      if (response.status === 401) {
        return 'Authentication error: Check your GROQ_API_KEY'
      }
      if (response.status === 429) {
        return 'Rate limit exceeded. Please try again in a moment.'
      }
      
      return `Groq API error (${response.status})`
    }
    
    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    
    if (!content) {
      log('No content in Groq response')
      return 'No response generated'
    }
    
    log(`Generated response (${content.length} chars)`)
    return content.trim()
    
  } catch (error) {
    log('Groq request failed:', error)
    return `Request failed: ${error}`
  }
}

// --- PUBLIC API ---

// Main function to generate response
export async function generateResponse(query: string): Promise<string> {
  log('=== NEW QUERY ===')
  log(`Query: "${query}"`)
  
  if (!query?.trim()) {
    return 'Please ask me a question about the podcast!'
  }
  
  // Check API keys first
  if (!GROQ_API_KEY) {
    return '⚠️ GROQ_API_KEY environment variable not set'
  }
  if (!OPENAI_API_KEY) {
    return '⚠️ OPENAI_API_KEY environment variable not set'
  }
  
  try {
    // Find relevant content
    const relevantChunks = await findRelevantChunks(query)
    
    if (relevantChunks.length === 0) {
      if (initError) {
        return `System error: ${initError}`
      }
      return `I don't have relevant information about "${query}" in the available episodes. Try asking about topics that were specifically discussed in the podcast.`
    }
    
    // Build the prompt with better context formatting
    const context = relevantChunks
      .map((chunk, i) => `## From: ${chunk.episode}
${chunk.text}`)
      .join('\n\n---\n\n')
    
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are an expert podcast analyst who provides deep, actionable insights. When answering:

**QUALITY OVER QUANTITY:**
- Only use content that directly and meaningfully relates to the question
- If content seems forced or tangentially related, ignore it completely
- Better to say "insufficient information" than use irrelevant content

**DEEP ANALYSIS:**
- Don't just summarize - analyze WHY things matter
- Connect insights to practical implications
- Provide strategic thinking, not just facts
- Show cause-and-effect relationships

**STRUCTURE YOUR RESPONSE:**
1. **Direct Answer**: Clear, specific response to the question
2. **Key Insights**: 2-3 deep, interconnected points with analysis
3. **Strategic Implications**: What this means for someone taking action
4. **Next Steps**: Specific, actionable recommendations

**AVOID:**
- Generic bullet points without analysis
- Forced connections between unrelated topics
- Surface-level observations
- "Honest gaps" sections that admit insufficient info

**TONE:**
- Confident and insightful
- Like a strategic consultant who really understands the space
- Focus on practical value for the person asking

If you truly don't have relevant information, give a brief response and suggest what type of content would be more helpful.`
      },
      {
        role: 'user',
        content: `Podcast content:\n\n${context}\n\nQuestion: ${query}\n\nProvide deep, strategic analysis based on this content. Focus on insights that would actually help someone make decisions or take action. Ignore any content that doesn't directly relate to the question.`
      }
    ]
    
    // Generate response
    const response = await generateWithGroq(messages)
    log('Response generated successfully')
    return response
    
  } catch (error) {
    log('Error in generateResponse:', error)
    return `Something went wrong: ${error}`
  }
}

// Simple fallback function
export function getQuickResponse(query?: string): string {
  if (query) {
    return `I'm having trouble processing your question about "${query}". Please try again or ask something else about the podcast!`
  }
  return 'Hi! Ask me about the podcast and I\'ll search through the available transcripts.'
}

// System status check
export async function getSystemStatus(): Promise<string> {
  await initialize()
  
  const status = {
    ready: isReady,
    error: initError,
    totalChunks: chunks.length,
    embeddedChunks: chunks.filter(c => c.embedding).length,
    hasGroqKey: !!GROQ_API_KEY,
    hasOpenAIKey: !!OPENAI_API_KEY
  }
  
  return JSON.stringify(status, null, 2)
}
