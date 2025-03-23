import { NextRequest, NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';

// Configure CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Handle OPTIONS request for CORS
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    // Add CORS headers to the response
    const headers = {
      ...corsHeaders,
      'Content-Type': 'application/json',
    };

    const { videoUrl } = await request.json();
    
    if (!videoUrl) {
      return NextResponse.json(
        { error: 'YouTube URL is required' },
        { status: 400, headers }
      );
    }

    // Extract video ID from URL
    const videoId = extractVideoId(videoUrl);
    if (!videoId) {
      return NextResponse.json(
        { error: 'Invalid YouTube URL format' },
        { status: 400, headers }
      );
    }

    try {
      // Use the video ID directly with the YouTube API
      const transcript = await YoutubeTranscript.fetchTranscript(videoId, {
        lang: 'en' // Specify language preference
      });
      
      if (!transcript || transcript.length === 0) {
        return NextResponse.json(
          { error: 'No transcript content available' },
          { status: 404, headers }
        );
      }

      // Transform the transcript to match our expected format
      const formattedTranscript = transcript.map(segment => ({
        text: segment.text,
        start: segment.offset,
        duration: segment.duration
      }));

      return NextResponse.json(
        { transcript: formattedTranscript },
        { headers }
      );
    } catch (transcriptError: any) {
      console.error('Transcript error details:', transcriptError);

      // Handle specific transcript errors
      if (transcriptError.message?.includes('Could not find any transcripts')) {
        return NextResponse.json(
          { error: 'This video does not have captions available. Please try a different video.' },
          { status: 404, headers }
        );
      }

      if (transcriptError.message?.includes('Transcript is disabled')) {
        return NextResponse.json(
          { error: 'Captions are disabled for this video. Please try a different video.' },
          { status: 403, headers }
        );
      }

      // Generic error handling
      return NextResponse.json(
        { 
          error: 'Failed to fetch video captions. Please try again or use a different video.',
          details: transcriptError.message
        },
        { status: 500, headers }
      );
    }
  } catch (error) {
    console.error('General error:', error);
    return NextResponse.json(
      { 
        error: 'An unexpected error occurred. Please try again.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { 
        status: 500,
        headers: corsHeaders
      }
    );
  }
}

function extractVideoId(url: string): string | null {
  try {
    // Handle different YouTube URL formats
    const patterns = [
      /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i,
      /^[a-zA-Z0-9_-]{11}$/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    // If it's already a video ID (11 characters)
    if (url.length === 11 && /^[a-zA-Z0-9_-]{11}$/.test(url)) {
      return url;
    }

    return null;
  } catch (error) {
    console.error('Error extracting video ID:', error);
    return null;
  }
}