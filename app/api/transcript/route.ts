import { NextRequest, NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';

export async function POST(request: NextRequest) {
  try {
    const { videoUrl } = await request.json();
    
    if (!videoUrl) {
      return NextResponse.json(
        { error: 'YouTube URL is required' },
        { status: 400 }
      );
    }

    // Extract video ID from URL
    const videoId = extractVideoId(videoUrl);
    if (!videoId) {
      return NextResponse.json(
        { error: 'Invalid YouTube URL format' },
        { status: 400 }
      );
    }

    try {
      const transcript = await YoutubeTranscript.fetchTranscript(videoId);
      
      if (!transcript || transcript.length === 0) {
        return NextResponse.json(
          { error: 'No transcript content available' },
          { status: 404 }
        );
      }

      // Transform the transcript to match our expected format
      const formattedTranscript = transcript.map(segment => ({
        text: segment.text,
        start: segment.offset,
        duration: segment.duration
      }));

      return NextResponse.json({ transcript: formattedTranscript });
    } catch (transcriptError: any) {
      // Handle specific transcript errors
      if (transcriptError.message?.includes('Could not find any transcripts')) {
        return NextResponse.json(
          { error: 'This video does not have captions available. Please try a different video.' },
          { status: 404 }
        );
      }

      if (transcriptError.message?.includes('Transcript is disabled')) {
        return NextResponse.json(
          { error: 'Captions are disabled for this video. Please try a different video.' },
          { status: 403 }
        );
      }

      // Generic error handling
      console.error('Transcript fetch error:', transcriptError);
      return NextResponse.json(
        { error: 'Failed to fetch video captions. Please try again or use a different video.' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('General error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
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