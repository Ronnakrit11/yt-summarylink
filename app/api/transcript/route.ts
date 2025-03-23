
import { NextRequest, NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  const responseHeaders = {
    ...corsHeaders,
    'Content-Type': 'application/json',
  };

  try {
    const { videoUrl } = await request.json();
    
    if (!videoUrl) {
      return NextResponse.json(
        { error: 'YouTube URL is required' },
        { status: 400, headers: responseHeaders }
      );
    }

    // First try to get the video ID
    const videoId = extractVideoId(videoUrl);
    if (!videoId) {
      return NextResponse.json(
        { error: 'Invalid YouTube URL format' },
        { status: 400, headers: responseHeaders }
      );
    }

    // Create the full YouTube URL
    const fullUrl = `https://www.youtube.com/watch?v=${videoId}`;

    // Try to fetch transcript with different approaches
    let transcript = null;
    const options = [
      { lang: 'th' },
      { lang: 'en' },
      {} // Default/auto-detect
    ];

    for (const opt of options) {
      try {
        // Use the full URL instead of just the ID
        transcript = await YoutubeTranscript.fetchTranscript(fullUrl, opt);
        if (transcript && transcript.length > 0) {
          // Format and return successful transcript
          const formattedTranscript = transcript.map(segment => ({
            text: segment.text,
            start: segment.offset,
            duration: segment.duration
          }));

          return NextResponse.json(
            { transcript: formattedTranscript },
            { headers: responseHeaders }
          );
        }
      } catch (err) {
        console.log(`Attempt failed with options ${JSON.stringify(opt)}:`, (err as Error).message);
        continue; // Try next option
      }
    }

    // If we get here, all attempts failed
    return NextResponse.json(
      { 
        error: 'No transcript available for this video. Please try a different video.',
        details: 'Could not find captions in any supported language'
      },
      { status: 404, headers: responseHeaders }
    );

  } catch (error) {
    console.error('General error:', error);
    return NextResponse.json(
      { 
        error: 'An unexpected error occurred while fetching the transcript.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500, headers: responseHeaders }
    );
  }
}

function extractVideoId(url: string): string | null {
  try {
    // Handle various YouTube URL formats
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

    // Handle direct video ID input
    if (url.length === 11 && /^[a-zA-Z0-9_-]{11}$/.test(url)) {
      return url;
    }

    return null;
  } catch (error) {
    console.error('Error extracting video ID:', error);
    return null;
  }
}