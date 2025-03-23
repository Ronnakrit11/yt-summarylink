import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { transcript } = await request.json();
    
    if (!transcript || transcript.length === 0) {
      return NextResponse.json(
        { error: 'Transcript is required' },
        { status: 400 }
      );
    }

    // Prepare the transcript text for analysis
    const transcriptText = transcript
      .map((entry: { text: string }) => entry.text)
      .join(' ');

    // Use DeepSeek AI API for analysis
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
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
            content: `กรุณาวิเคราะห์บทความวิดีโอนี้และให้การวิเคราะห์ที่ครอบคลุม: ${transcriptText}`
          }
        ],
        temperature: 0.5,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Failed to analyze transcript');
    }

    const data = await response.json();
    const analysis = data.choices[0].message.content;

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error('Error analyzing transcript:', error);
    return NextResponse.json(
      { error: 'Failed to analyze transcript' },
      { status: 500 }
    );
  }
}