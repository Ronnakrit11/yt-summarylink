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

    const transcript = await YoutubeTranscript.fetchTranscript(videoUrl);
    
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
  } catch (error) {
    console.error('Error fetching transcript:', error);
    
    let errorMessage = 'Failed to fetch transcript';
    if (error instanceof Error) {
      if (error.message.includes('Could not find any transcripts')) {
        errorMessage = 'This video does not have a transcript available.';
      } else {
        errorMessage = error.message;
      }
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}