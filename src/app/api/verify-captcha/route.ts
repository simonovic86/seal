import { NextRequest, NextResponse } from 'next/server';

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

interface TurnstileVerifyResponse {
  success: boolean;
  'error-codes'?: string[];
  challenge_ts?: string;
  hostname?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Missing token' },
        { status: 400 },
      );
    }

    // Skip verification in development mode
    if (token === 'development-mode') {
      console.warn('CAPTCHA verification skipped (development mode)');
      return NextResponse.json({ success: true });
    }

    const secretKey = process.env.TURNSTILE_SECRET_KEY;

    if (!secretKey) {
      console.warn('TURNSTILE_SECRET_KEY not configured, skipping verification');
      return NextResponse.json({ success: true });
    }

    // Get client IP for additional security
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
               request.headers.get('x-real-ip') || 
               undefined;

    // Verify with Cloudflare
    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', token);
    if (ip) {
      formData.append('remoteip', ip);
    }

    const verifyResponse = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const result: TurnstileVerifyResponse = await verifyResponse.json();

    if (!result.success) {
      console.error('Turnstile verification failed:', result['error-codes']);
      return NextResponse.json(
        { success: false, error: 'CAPTCHA verification failed' },
        { status: 403 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('CAPTCHA verification error:', error);
    return NextResponse.json(
      { success: false, error: 'Verification error' },
      { status: 500 },
    );
  }
}
