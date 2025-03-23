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

async function fetchTranscriptWithRetry(url: string, options: any = {}, retries = 3): Promise<any> {
  let lastError;
  
  for (let i = 0; i < retries; i++) {
    try {
      const transcript = await YoutubeTranscript.fetchTranscript(url, options);
      if (transcript && transcript.length > 0) {
        return transcript;
      }
    } catch (error) {
      lastError = error;
      // Wait for a short time before retrying
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  
  throw lastError;
}

export async function POST(request: NextRequest) {
  try {
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

    // Extract video ID
    const videoId = extractVideoId(videoUrl);
    if (!videoId) {
      return NextResponse.json(
        { error: 'Invalid YouTube URL format' },
        { status: 400, headers }
      );
    }

    // Create the full YouTube URL
    const fullUrl = `https://www.youtube.com/watch?v=${videoId}`;

    // Define language options to try
    const languageOptions = [
      { lang: 'th' },      // Try Thai first
      { lang: 'en' },      // Then English
      { lang: 'auto' },    // Then auto-detect
      {}                   // Finally, default options
    ];

    let successfulTranscript = null;
    let errors = [];

    // Try each language option
    for (const options of languageOptions) {
      try {
        const transcript = await fetchTranscriptWithRetry(fullUrl, options);
        if (transcript && transcript.length > 0) {
          successfulTranscript = transcript;
          break;
        }
      } catch (error) {
        errors.push({
          lang: options.lang || 'default',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        continue;
      }
    }

    interface TranscriptSegment {
      text: string;
      offset: number;
      duration: number;
    }

    if (successfulTranscript) {
      const formattedTranscript = successfulTranscript.map((segment: TranscriptSegment) => ({
        text: segment.text,
        start: segment.offset,
        duration: segment.duration
      }));

      return NextResponse.json(
        { transcript: formattedTranscript },
        { headers }
      );
    }

    // If we get here, all attempts failed
    return NextResponse.json(
      { 
        error: 'No transcript available for this video. Please try a different video.',
        details: 'Could not find captions in any supported language',
        attempts: errors
      },
      { status: 404, headers }
    );

  } catch (error) {
    console.error('General error:', error);
    const headers = {
      ...corsHeaders,
      'Content-Type': 'application/json',
    };
    return NextResponse.json(
      { 
        error: 'An unexpected error occurred while fetching the transcript.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500, headers }
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