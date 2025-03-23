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
            role: 'system',
            content: `คุณเป็นผู้เชี่ยวชาญในการวิเคราะห์เนื้อหาวิดีโอ หน้าที่ของคุณคือวิเคราะห์บทความวิดีโอและให้บทสรุปที่มีข้อมูลเชิงลึกและมีโครงสร้างที่ดี

จัดรูปแบบการตอบของคุณในรูปแบบ markdown ด้วยหัวข้อต่อไปนี้:
1. **บทสรุป**: สรุปสั้นๆ 2-3 ประโยคว่าวิดีโอเกี่ยวกับอะไร
2. **ประเด็นสำคัญ**: 3-5 แนวคิดหรือข้อโต้แย้งหลักที่นำเสนอในวิดีโอ
3. **ข้อมูลเชิงลึก**: 2-3 ข้อสังเกตหรือนัยสำคัญจากเนื้อหา
4. **กลุ่มเป้าหมาย**: ใครจะได้ประโยชน์จากวิดีโอนี้มากที่สุด
5. **บทสรุป**: ความคิดสรุปสั้นๆ

ให้การวิเคราะห์ของคุณเป็นมืออาชีพ ชัดเจน และอ่านง่าย ใช้หัวข้อ (##) สำหรับแต่ละส่วน`
          },
          {
            role: 'user',
            content: `กรุณาวิเคราะห์บทความวิดีโอนี้และให้การวิเคราะห์ที่ครอบคลุม: ${text}`
          }
        ],
        temperature: 0.5,
        max_tokens: 1000,
        response_format: { type: "text" }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`DeepSeek API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Return the markdown content directly
    return {
      topic: "Video Analysis",
      keyPoints: ["See full analysis below"],
      summary: content
    };
  } catch (error) {
    console.error('DeepSeek API error:', error);
    throw new Error('Failed to analyze transcript with DeepSeek AI. Please try again later.');
  }
}