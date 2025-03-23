import { NextRequest, NextResponse } from 'next/server';

// Define the structure of the analysis response
type AnalysisResponse = {
  topic: string;
  keyPoints: string[];
  summary: string;
};

// Simple in-memory rate limiting
const ipRequests = new Map<string, { count: number, timestamp: number }>();

// Rate limit function: 10 requests per minute per IP
async function rateLimiter(request: NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for') || '';
  const ip = forwardedFor.split(',')[0].trim() || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  
  const currentRequests = ipRequests.get(ip) || { count: 0, timestamp: now };
  
  // Reset if outside window
  if (now - currentRequests.timestamp > windowMs) {
    currentRequests.count = 0;
    currentRequests.timestamp = now;
  }
  
  // Increment request count
  currentRequests.count++;
  ipRequests.set(ip, currentRequests);
  
  // Check if over limit
  if (currentRequests.count > 10) {
    throw new Error('Rate limit exceeded. Please try again later.');
  }
  
  return true;
}

// Error handler
function handleApiError(error: any) {
  console.error('API Error:', error);
  
  const message = error.message || 'An unexpected error occurred';
  const status = error.status || 500;
  
  return NextResponse.json(
    { error: message },
    { status }
  );
}

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    await rateLimiter(request);

    const { transcript } = await request.json();
    
    if (!transcript || !Array.isArray(transcript) || transcript.length === 0) {
      return NextResponse.json(
        { error: 'Valid transcript is required' },
        { status: 400 }
      );
    }

    // Extract the full text from the transcript
    const fullText = transcript.map(item => item.text).join(' ');
    
    // Analyze with AI - no mock option
    const analysis = await analyzeWithDeepSeekAI(fullText);
    
    return NextResponse.json({ analysis });
  } catch (error) {
    return handleApiError(error);
  }
}

async function analyzeWithDeepSeekAI(text: string): Promise<AnalysisResponse> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const apiUrl = 'https://api.deepseek.com/v1/chat/completions';
  
  if (!apiKey) {
    throw new Error('DeepSeek API key is not configured. Please add your API key to the .env file.');
  }

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: "system",
            content: "You are an expert analyst who analyzes video transcripts."
          },
          {
            role: "user",
            content: `Analyze the following YouTube video transcript and provide:
            1. What the video is about (core topic/subject)
            2. 3-5 key points or insights from the video
            3. A concise summary (2-3 paragraphs)
            
            Format your response as JSON with the following structure:
            {
              "topic": "Core topic of the video",
              "keyPoints": ["Key point 1", "Key point 2", "Key point 3", "Key point 4", "Key point 5"],
              "summary": "Concise summary of the video content"
            }
            
            Here is the transcript: ${text}`
          }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`DeepSeek API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Try to parse the JSON response
    try {
      const parsedContent = JSON.parse(content);
      return {
        topic: parsedContent.topic || 'Video Analysis',
        keyPoints: parsedContent.keyPoints || ['No specific key points identified.'],
        summary: parsedContent.summary || 'No summary available.'
      };
    } catch (parseError) {
      // If parsing fails, return an error
      throw new Error('Failed to parse AI response. The analysis could not be completed.');
    }
  } catch (error) {
    console.error('DeepSeek API error:', error);
    throw new Error('Failed to analyze transcript with DeepSeek AI. Please try again later.');
  }
}