// lib/ai.ts
// Enhanced podcast Q&A system with improved response formatting

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

interface EnhancedChunk {
  text: string
  episode: string
  episodeTitle: string
  speaker?: 'host' | 'guest' | 'unknown'
  guestName?: string
  timestamp?: string
  topics: string[]
  index: number
  embedding?: number[]
  context: string
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface RetrievalResult {
  chunk: EnhancedChunk
  relevanceScore: number
  confidenceLevel: 'high' | 'medium' | 'low'
  matchReason: string
}

// --- GLOBAL STATE ---
let chunks: Chunk[] = []
let enhancedChunks: EnhancedChunk[] = []
let isReady = false
let isEnhancedReady = false
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

// Enhanced cosine similarity (handles undefined)
function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0
  
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
async function getEmbedding(text: string): Promise<number[] | undefined> {
  if (!OPENAI_API_KEY) {
    log('❌ No OpenAI API key provided')
    return undefined
  }
  
  if (!text.trim() || text.trim().length < 10) {
    log('❌ Text too short for embedding')
    return undefined
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
      return undefined
    }
    
    const data = await response.json()
    
    if (!data.data || !data.data[0] || !data.data[0].embedding) {
      log('❌ Invalid embedding response structure:', data)
      return undefined
    }
    
    log('✅ Embedding created successfully')
    return data.data[0].embedding
    
  } catch (error) {
    log('❌ Embedding request failed:', error)
    return undefined
  }
}

// --- ENHANCED CHUNKING ---

// Create smart chunks that preserve context and speaker boundaries
function createSmartChunks(content: string, episodeName: string): EnhancedChunk[] {
  const chunks: EnhancedChunk[] = []
  
  // Split by natural boundaries (paragraphs, speaker changes)
  const sections = content.split(/\n\s*\n|\n(?=[A-Z][a-z]*:)/).filter(s => s.trim().length > 50)
  
  let chunkIndex = 0
  
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i].trim()
    
    // If section is too long, split smartly
    if (section.length > 800) {
      const sentences = section.split(/[.!?]+/).filter(s => s.trim().length > 20)
      let currentChunk = ''
      
      for (const sentence of sentences) {
        if ((currentChunk + sentence).length > 600) {
          if (currentChunk.trim()) {
            chunks.push(createChunkWithMetadata(currentChunk.trim(), episodeName, chunkIndex++, {
              prevContext: i > 0 ? sections[i-1].slice(-100) : '',
              nextContext: i < sections.length - 1 ? sections[i+1].slice(0, 100) : ''
            }))
          }
          currentChunk = sentence
        } else {
          currentChunk += sentence + '. '
        }
      }
      
      if (currentChunk.trim()) {
        chunks.push(createChunkWithMetadata(currentChunk.trim(), episodeName, chunkIndex++, {
          prevContext: i > 0 ? sections[i-1].slice(-100) : '',
          nextContext: i < sections.length - 1 ? sections[i+1].slice(0, 100) : ''
        }))
      }
    } else {
      // Section is good size, keep as-is
      chunks.push(createChunkWithMetadata(section, episodeName, chunkIndex++, {
        prevContext: i > 0 ? sections[i-1].slice(-100) : '',
        nextContext: i < sections.length - 1 ? sections[i+1].slice(0, 100) : ''
      }))
    }
  }
  
  return chunks
}

// Create chunk with enhanced metadata
function createChunkWithMetadata(
  text: string, 
  episodeName: string, 
  index: number, 
  context: { prevContext: string, nextContext: string }
): EnhancedChunk {
  
  // Extract speaker information
  const speakerMatch = text.match(/^([A-Z][a-z\s]+):\s*(.+)/)
  let speaker: 'host' | 'guest' | 'unknown' = 'unknown'
  let guestName: string | undefined
  let cleanText = text
  
  if (speakerMatch) {
    const speakerName = speakerMatch[1].toLowerCase()
    cleanText = speakerMatch[2]
    
    if (speakerName.includes('nikhil') || speakerName.includes('host')) {
      speaker = 'host'
    } else {
      speaker = 'guest'
      guestName = speakerMatch[1]
    }
  }
  
  // Extract topics using enhanced keyword detection
  const topics = extractTopics(cleanText + ' ' + context.prevContext + ' ' + context.nextContext)
  
  // Extract timestamp if present
  const timestampMatch = text.match(/\[(\d{1,2}:\d{2}(?::\d{2})?)\]/)
  const timestamp = timestampMatch ? timestampMatch[1] : undefined
  
  return {
    text: cleanText,
    episode: episodeName,
    episodeTitle: formatEpisodeTitle(episodeName),
    speaker,
    guestName,
    timestamp,
    topics,
    index,
    context: context.prevContext + ' [...] ' + context.nextContext
  }
}

// Enhanced topic extraction
function extractTopics(text: string): string[] {
  const topicPatterns = {
    'real-estate': /real estate|property|housing|construction|builder|apartment|rent/gi,
    'gaming': /game|gaming|esports|mobile gaming|pc gaming|console|developer/gi,
    'startup': /startup|entrepreneur|business|company|venture|founder/gi,
    'fintech': /fintech|financial|banking|payment|wallet|upi|digital payment/gi,
    'edtech': /education|learning|online course|skill|training|edtech/gi,
    'food': /restaurant|food|dining|kitchen|chef|delivery|zomato|swiggy/gi,
    'ev': /electric vehicle|ev|battery|automotive|car|vehicle|charging/gi,
    'investment': /investment|funding|vc|investor|capital|valuation|ipo/gi,
    'marketing': /marketing|brand|advertising|content|social media|influencer/gi,
    'healthcare': /healthcare|medical|hospital|doctor|telemedicine|pharma/gi
  }
  
  const detectedTopics: string[] = []
  
  Object.entries(topicPatterns).forEach(([topic, pattern]) => {
    if (pattern.test(text)) {
      detectedTopics.push(topic)
    }
  })
  
  return detectedTopics
}

function formatEpisodeTitle(episodeName: string): string {
  return episodeName.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

// --- ORIGINAL SYSTEM (IMPROVED) ---

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
              episode: filename.replace('.txt', ''),
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
    
    let embeddedCount = 0
    let consecutiveFailures = 0
    
    for (let i = 0; i < chunksToEmbed.length; i++) {
      const chunk = chunksToEmbed[i]
      
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
        
        if (consecutiveFailures >= 5) {
          log('❌ Too many consecutive embedding failures, stopping')
          break
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    
    log(`✅ Successfully embedded ${embeddedCount}/${chunksToEmbed.length} chunks`)
    
    isReady = true
    log('🎉 System ready!')
    
  } catch (error) {
    initError = `Initialization failed: ${error}`
    log(initError)
  }
}

// Enhanced keyword search with better relevance
function searchByKeywordsEnhanced(query: string): Chunk[] {
  const queryWords = query.toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 2)
  
  if (queryWords.length === 0) return []
  
  const results = chunks
    .map(chunk => {
      const text = chunk.text.toLowerCase()
      let score = 0
      let matchedWords = 0
      
      queryWords.forEach(word => {
        const matches = (text.match(new RegExp(word, 'g')) || []).length
        if (matches > 0) {
          score += matches
          matchedWords++
        }
      })
      
      if (text.includes(query.toLowerCase())) {
        score += 5
      }
      
      const coverage = matchedWords / queryWords.length
      if (coverage < 0.3) {
        score *= 0.5
      }
      
      return { chunk, score }
    })
    .filter(result => result.score > 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
  
  return results.map(r => r.chunk)
}

// Enhanced search with better query understanding
async function findRelevantChunks(query: string): Promise<Chunk[]> {
  await initialize()
  
  if (!isReady) {
    log('❌ System not ready')
    return []
  }
  
  // First try semantic search with embeddings
  const queryEmbedding = await getEmbedding(query)
  
  if (queryEmbedding) {
    log('🎯 Using semantic search')
    
    const withEmbeddings = chunks.filter(chunk => chunk.embedding)
    
    if (withEmbeddings.length > 0) {
      const results = withEmbeddings
        .map(chunk => ({
          chunk,
          score: similarity(queryEmbedding, chunk.embedding!)
        }))
        .filter(result => result.score > 0.2)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
      
      if (results.length > 0) {
        log(`✅ Found ${results.length} semantic matches`)
        return results.map(r => r.chunk)
      }
    }
  }
  
  // Fallback to enhanced keyword search
  log('⚠️ Falling back to enhanced keyword search')
  return searchByKeywordsEnhanced(query)
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
        max_tokens: 800,
        temperature: 0.2 // Lower temperature for less hallucination
      })
    })
    
    log(`Groq response status: ${response.status}`)
    
    if (!response.ok) {
      const errorText = await response.text()
      log('Groq error:', errorText)
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

// --- ENHANCED SYSTEM ---

// Initialize enhanced system
async function initializeEnhanced(): Promise<void> {
  if (isEnhancedReady) return
  
  log('🚀 Initializing enhanced system...')
  
  try {
    const transcriptPath = path.join(process.cwd(), 'public', 'transcripts')
    const files = await fs.readdir(transcriptPath)
    const txtFiles = files.filter(f => f.endsWith('.txt'))
    
    for (const filename of txtFiles) {
      const filePath = path.join(transcriptPath, filename)
      const content = await fs.readFile(filePath, 'utf-8')
      const episodeName = filename.replace('.txt', '')
      
      const chunks = createSmartChunks(content, episodeName)
      enhancedChunks.push(...chunks)
      
      log(`Processed ${filename}: ${chunks.length} smart chunks`)
    }
    
    // Create embeddings for a subset (for testing)
    const chunksToEmbed = enhancedChunks.slice(0, 30)
    for (const chunk of chunksToEmbed) {
      const embedding = await getEmbedding(chunk.text)
      if (embedding) {
        chunk.embedding = embedding
      }
      await new Promise(resolve => setTimeout(resolve, 500)) // Rate limit
    }
    
    isEnhancedReady = true
    log(`✅ Enhanced system ready with ${enhancedChunks.length} chunks`)
    
  } catch (error) {
    log('Enhanced initialization failed:', error)
  }
}

// Multi-stage retrieval for enhanced system
async function performMultiStageRetrieval(query: string): Promise<RetrievalResult[]> {
  const results: RetrievalResult[] = []
  
  // Stage 1: Topic-based filtering
  const queryTopics = extractTopics(query)
  const topicFilteredChunks = queryTopics.length > 0 
    ? enhancedChunks.filter(chunk => 
        chunk.topics.some(topic => queryTopics.includes(topic))
      )
    : enhancedChunks
  
  log(`Stage 1: Filtered to ${topicFilteredChunks.length} chunks by topics: ${queryTopics.join(', ')}`)
  
  // Stage 2: Semantic similarity (if embeddings available)
  const queryEmbedding = await getEmbedding(query)
  let semanticCandidates: EnhancedChunk[] = []
  
  if (queryEmbedding) {
    const semanticResults = topicFilteredChunks
      .filter(chunk => chunk.embedding)
      .map(chunk => ({
        chunk,
        similarity: cosineSimilarity(queryEmbedding, chunk.embedding || [])
      }))
      .filter(result => result.similarity > 0.25)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 10)
    
    semanticCandidates = semanticResults.map(r => r.chunk)
    log(`Stage 2: Found ${semanticCandidates.length} semantic matches`)
  }
  
  // Stage 3: Enhanced keyword matching
  const keywordCandidates = enhancedKeywordSearch(query, topicFilteredChunks)
  
  // Stage 4: Combine and re-rank results
  const combinedCandidates = [...semanticCandidates, ...keywordCandidates]
  const uniqueCandidatesMap = new Map<string, EnhancedChunk>()
  
  combinedCandidates.forEach(chunk => {
    const key = `${chunk.episode}-${chunk.index}`
    if (!uniqueCandidatesMap.has(key)) {
      uniqueCandidatesMap.set(key, chunk)
    }
  })
  
  const allCandidates = Array.from(uniqueCandidatesMap.values())
  
  for (const chunk of allCandidates) {
    const relevanceScore = calculateEnhancedRelevance(query, chunk, queryEmbedding || undefined)
    const confidenceLevel = determineConfidenceLevel(relevanceScore, chunk, query)
    const matchReason = explainMatch(query, chunk, relevanceScore)
    
    if (relevanceScore > 0.3) {
      results.push({
        chunk,
        relevanceScore,
        confidenceLevel,
        matchReason
      })
    }
  }
  
  return results
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 5)
}

function enhancedKeywordSearch(query: string, chunks: EnhancedChunk[]): EnhancedChunk[] {
  const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2)
  
  return chunks
    .map(chunk => ({
      chunk,
      score: calculateKeywordRelevance(query, chunk.text + ' ' + chunk.context)
    }))
    .filter(result => result.score > 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(r => r.chunk)
}

function calculateKeywordRelevance(query: string, text: string): number {
  const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2)
  const textLower = text.toLowerCase()
  
  let score = 0
  queryWords.forEach(word => {
    const matches = (textLower.match(new RegExp(word, 'g')) || []).length
    score += matches * (word.length / 10)
  })
  
  if (textLower.includes(query.toLowerCase())) {
    score += 2
  }
  
  return Math.min(score / (queryWords.length * 2), 1)
}

function calculateEnhancedRelevance(query: string, chunk: EnhancedChunk, queryEmbedding?: number[]): number {
  let score = 0
  
  // Semantic similarity (40% weight)
  if (queryEmbedding && chunk.embedding) {
    const semanticScore = cosineSimilarity(queryEmbedding, chunk.embedding)
    score += semanticScore * 0.4
  }
  
  // Keyword relevance (30% weight)
  const keywordScore = calculateKeywordRelevance(query, chunk.text)
  score += keywordScore * 0.3
  
  // Topic alignment (20% weight)
  const queryTopics = extractTopics(query)
  const topicOverlap = chunk.topics.filter(topic => queryTopics.includes(topic)).length
  const topicScore = queryTopics.length > 0 ? topicOverlap / queryTopics.length : 0.5
  score += topicScore * 0.2
  
  // Context relevance (10% weight)
  const contextScore = calculateKeywordRelevance(query, chunk.context)
  score += contextScore * 0.1
  
  return Math.min(score, 1)
}

function determineConfidenceLevel(score: number, chunk: EnhancedChunk, query: string): 'high' | 'medium' | 'low' {
  if (score > 0.7 && chunk.topics.length > 0) {
    const queryTopics = extractTopics(query)
    if (queryTopics.some(topic => chunk.topics.includes(topic))) {
      return 'high'
    }
  }
  
  if (score > 0.5) {
    return 'medium'
  }
  
  return 'low'
}

function explainMatch(query: string, chunk: EnhancedChunk, score: number): string {
  const reasons: string[] = []
  
  if (chunk.topics.length > 0) {
    const queryTopics = extractTopics(query)
    const matchingTopics = chunk.topics.filter(topic => queryTopics.includes(topic))
    if (matchingTopics.length > 0) {
      reasons.push(`Topic match: ${matchingTopics.join(', ')}`)
    }
  }
  
  const keywordMatches = findKeywordMatches(query, chunk.text)
  if (keywordMatches.length > 0) {
    reasons.push(`Keywords: ${keywordMatches.slice(0, 3).join(', ')}`)
  }
  
  if (score > 0.7) {
    reasons.push('High semantic similarity')
  }
  
  return reasons.length > 0 ? reasons.join('; ') : 'General relevance'
}

function findKeywordMatches(query: string, text: string): string[] {
  const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2)
  const textLower = text.toLowerCase()
  
  return queryWords.filter(word => textLower.includes(word))
}

// Improved prompt for cleaner, more professional responses
function createCleanResponsePrompt(results: RetrievalResult[]): string {
  const highConfidenceResults = results.filter(r => r.confidenceLevel === 'high')
  const mediumConfidenceResults = results.filter(r => r.confidenceLevel === 'medium')
  
  return `You are a professional podcast analyst. Provide clean, well-structured responses based strictly on the provided transcript content.

**RESPONSE STRUCTURE:**
1. Start with a clear, direct answer to the question
2. Provide key insights with specific details from the episodes
3. Include relevant episode sources naturally in the text
4. End with actionable takeaways when applicable

**FORMATTING RULES:**
- Write in natural, flowing prose - NO asterisks, bullet points, or formatting markers
- NO section headers like "Direct Answer" or "Key Insights" 
- Integrate source citations naturally (e.g., "According to the episode with [Guest Name]...")
- Use confident, professional language
- Keep paragraphs focused and readable

**CONTENT GUIDELINES:**
- Only use information directly from the provided transcripts
- Cite specific episodes and speakers naturally in your response
- If information is limited, acknowledge this briefly without being apologetic
- Focus on practical, actionable insights when possible
- Distinguish between high-confidence (${highConfidenceResults.length} sources) and medium-confidence (${mediumConfidenceResults.length} sources) information when relevant

**TONE:**
- Professional but conversational
- Confident and authoritative
- Helpful and informative
- No unnecessary qualifiers or hedging

Write your response as if you're a knowledgeable consultant sharing insights from the podcast content.`
}

function getAvailableTopics(): string[] {
  const allTopicsSet = new Set<string>()
  enhancedChunks.forEach(chunk => {
    chunk.topics.forEach(topic => allTopicsSet.add(topic))
  })
  return Array.from(allTopicsSet).slice(0, 10)
}

// Clean response formatting helper
function cleanResponse(response: string): string {
  // Remove markdown-style formatting
  let cleaned = response
    // Remove bold/italic markers
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    // Remove section headers that look like "**Direct Answer:**"
    .replace(/\*\*[^*]+\*\*:\s*/g, '')
    // Remove bullet points and convert to flowing text
    .replace(/^\s*[-•]\s*/gm, '')
    // Remove numbered lists formatting
    .replace(/^\s*\d+\.\s*/gm, '')
    // Clean up extra whitespace
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .replace(/^\s+|\s+$/g, '')
  
  return cleaned
}

// --- PUBLIC API ---

// Main function to generate response (improved with better formatting)
export async function generateResponse(query: string): Promise<string> {
  log('=== NEW QUERY ===')
  log(`Query: "${query}"`)
  
  if (!query?.trim()) {
    return 'Please ask me a question about the podcast!'
  }
  
  if (!GROQ_API_KEY) {
    return '⚠️ GROQ_API_KEY environment variable not set'
  }
  if (!OPENAI_API_KEY) {
    return '⚠️ OPENAI_API_KEY environment variable not set'
  }
  
  try {
    const relevantChunks = await findRelevantChunks(query)
    
    if (relevantChunks.length === 0) {
      if (initError) {
        return `System error: ${initError}`
      }
      return `I don't have relevant information about "${query}" in the available episodes. Try asking about topics that were specifically discussed in the podcast.`
    }
    
    const context = relevantChunks
      .map((chunk, i) => `Episode: ${chunk.episode}
${chunk.text}`)
      .join('\n\n---\n\n')
    
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are a professional podcast analyst who provides insightful, well-structured responses. 

**RESPONSE GUIDELINES:**
- Write in natural, flowing prose without any formatting markers (**, *, bullets, etc.)
- Start directly with your answer - no section headers or labels
- Integrate episode citations naturally into your response
- Focus on actionable insights and practical value
- Use confident, professional language
- Keep responses conversational but authoritative

**CONTENT RULES:**
- Only use information from the provided transcript content
- When referencing content, mention the episode naturally (e.g., "In the episode about...")
- If information is limited, briefly acknowledge this without being apologetic
- Provide strategic analysis, not just summary
- Connect insights to practical implications when possible

Write your response as if you're a knowledgeable consultant sharing insights from the podcast episodes. No formatting markers, section headers, or bullet points - just clean, professional prose.`
      },
      {
        role: 'user',
        content: `Podcast content:\n\n${context}\n\nQuestion: ${query}\n\nProvide a clear, insightful response based on this content. Write in natural prose without any formatting markers or section headers.`
      }
    ]
    
    const response = await generateWithGroq(messages)
    const cleanedResponse = cleanResponse(response)
    log('Response generated and cleaned successfully')
    return cleanedResponse
    
  } catch (error) {
    log('Error in generateResponse:', error)
    return `Something went wrong: ${error}`
  }
}

// Enhanced response generation with improved formatting
export async function generateEnhancedResponse(query: string): Promise<string> {
  log('=== ENHANCED QUERY PROCESSING ===')
  log(`Query: "${query}"`)
  
  try {
    await initializeEnhanced()
    
    if (!isEnhancedReady) {
      return 'Enhanced system not ready. Please check transcript files and API keys.'
    }
    
    const results = await performMultiStageRetrieval(query)
    
    if (results.length === 0) {
      return `I don't have specific information about "${query}" in the available podcast episodes. Try asking about topics that were explicitly discussed, such as: ${getAvailableTopics().join(', ')}.`
    }
    
    const context = results.map((result, i) => {
      return `Episode: ${result.chunk.episodeTitle}
${result.chunk.speaker === 'guest' && result.chunk.guestName ? `Speaker: ${result.chunk.guestName}` : `Speaker: ${result.chunk.speaker}`}
${result.chunk.timestamp ? `Time: ${result.chunk.timestamp}` : ''}
Confidence: ${result.confidenceLevel}

Content: ${result.chunk.text}`
    }).join('\n\n---\n\n')
    
    const messages: Array<{role: 'system' | 'user' | 'assistant', content: string}> = [
      {
        role: 'system',
        content: createCleanResponsePrompt(results)
      },
      {
        role: 'user',
        content: `TRANSCRIPT CONTENT:\n\n${context}\n\nQUESTION: ${query}\n\nProvide a professional response using only the information above. Write in clean, natural prose without formatting markers, section headers, or bullet points.`
      }
    ]
    
    const response = await generateWithGroq(messages)
    const cleanedResponse = cleanResponse(response)
    log('Enhanced response generated and cleaned successfully')
    return cleanedResponse
    
  } catch (error) {
    log('Error in enhanced generation:', error)
    return `I encountered an error processing your question. Please try again.`
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
    enhancedReady: isEnhancedReady,
    error: initError,
    totalChunks: chunks.length,
    enhancedChunks: enhancedChunks.length,
    embeddedChunks: chunks.filter(c => c.embedding).length,
    enhancedEmbeddedChunks: enhancedChunks.filter(c => c.embedding).length,
    hasGroqKey: !!GROQ_API_KEY,
    hasOpenAIKey: !!OPENAI_API_KEY,
    availableTopics: isEnhancedReady ? getAvailableTopics() : []
  }
  
  return JSON.stringify(status, null, 2)
}