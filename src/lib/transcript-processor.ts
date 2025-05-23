// Utility to process and clean transcript files
import { promises as fs } from 'fs'
import path from 'path'

export interface ProcessedTranscript {
  title: string
  summary: string
  keyTopics: string[]
  mainPoints: string[]
  actionableInsights: string[]
}

// Clean and structure transcript content
export function cleanTranscript(rawText: string): string {
  return rawText
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    // Remove timestamp patterns like [00:12:34]
    .replace(/\[\d{2}:\d{2}:\d{2}\]/g, '')
    // Remove speaker labels like "Speaker 1:" or "Host:"
    .replace(/^(Speaker \d+|Host|Guest|Interviewer):\s*/gim, '')
    // Remove filler words at sentence beginnings
    .replace(/\b(um|uh|like|you know|actually)\b/gi, '')
    // Clean up punctuation
    .replace(/\s+([,.!?])/g, '$1')
    .trim()
}

// Extract key topics from transcript
export function extractKeyTopics(transcript: string): string[] {
  const businessKeywords = [
    'startup', 'business', 'investment', 'entrepreneur', 'funding', 'revenue',
    'market', 'customer', 'product', 'strategy', 'growth', 'scaling',
    'marketing', 'branding', 'sales', 'team', 'leadership', 'innovation',
    'technology', 'digital', 'ecommerce', 'fintech', 'edtech',
    'restaurant', 'food', 'retail', 'real estate', 'venture capital'
  ]
  
  const lowerTranscript = transcript.toLowerCase()
  const foundTopics = businessKeywords.filter(keyword => 
    lowerTranscript.includes(keyword)
  )
  
  // Count occurrences and return top topics
  const topicCounts = foundTopics.reduce((acc, topic) => {
    const matches = (lowerTranscript.match(new RegExp(topic, 'g')) || []).length
    acc[topic] = matches
    return acc
  }, {} as Record<string, number>)
  
  return Object.entries(topicCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 8)
    .map(([topic]) => topic)
}

// Extract actionable insights
export function extractActionableInsights(transcript: string): string[] {
  const actionPatterns = [
    /(?:you should|need to|must|have to|important to|key is to|advice is to|recommend|suggest)\s+([^.!?]+)/gi,
    /(?:first|second|third|next|then|finally),?\s+([^.!?]+)/gi,
    /(?:tip|strategy|approach|method|way to)\s+([^.!?]+)/gi
  ]
  
  const insights: string[] = []
  
  actionPatterns.forEach(pattern => {
    const matches = transcript.match(pattern)
    if (matches) {
      matches.forEach(match => {
        const cleaned = match.replace(/^(you should|need to|must|have to|important to|key is to|advice is to|recommend|suggest|first|second|third|next|then|finally|tip|strategy|approach|method|way to),?\s*/i, '')
        if (cleaned.length > 10 && cleaned.length < 200) {
          insights.push(cleaned.trim())
        }
      })
    }
  })
  
  return insights.slice(0, 5) // Top 5 insights
}

// Generate summary from transcript
export function generateSummary(transcript: string, maxLength: number = 300): string {
  const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 20)
  
  if (sentences.length === 0) return "No summary available."
  
  // Take first few sentences and last few sentences for context
  const startSentences = sentences.slice(0, 3)
  const endSentences = sentences.slice(-2)
  
  const summary = [...startSentences, ...endSentences]
    .join('. ')
    .substring(0, maxLength)
  
  return summary + (summary.length === maxLength ? '...' : '')
}

// Process a single transcript file
export async function processTranscriptFile(filePath: string): Promise<ProcessedTranscript> {
  try {
    const rawContent = await fs.readFile(filePath, 'utf-8')
    const cleanedTranscript = cleanTranscript(rawContent)
    
    const fileName = path.basename(filePath, '.txt')
    const title = fileName
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
    
    return {
      title,
      summary: generateSummary(cleanedTranscript),
      keyTopics: extractKeyTopics(cleanedTranscript),
      mainPoints: cleanedTranscript.split(/[.!?]+/).slice(0, 10).filter(s => s.trim().length > 20),
      actionableInsights: extractActionableInsights(cleanedTranscript)
    }
  } catch (error) {
    console.error(`Error processing transcript file ${filePath}:`, error)
    throw error
  }
}

// Batch process all transcript files
export async function processAllTranscripts(): Promise<ProcessedTranscript[]> {
  try {
    const transcriptsPath = path.join(process.cwd(), 'public', 'transcripts')
    const files = await fs.readdir(transcriptsPath)
    const txtFiles = files.filter(file => file.endsWith('.txt'))
    
    const processed: ProcessedTranscript[] = []
    
    for (const file of txtFiles) {
      const filePath = path.join(transcriptsPath, file)
      const processedTranscript = await processTranscriptFile(filePath)
      processed.push(processedTranscript)
    }
    
    return processed
  } catch (error) {
    console.error('Error processing transcripts:', error)
    return []
  }
}