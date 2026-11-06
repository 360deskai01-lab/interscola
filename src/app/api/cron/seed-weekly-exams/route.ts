import { NextResponse } from 'next/server';
import { seedWeeklyPublicExams } from '@/lib/exam/seed-weekly-exams';

export const maxDuration = 300;

function isAuthorizedCron(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authHeader = request.headers.get('authorization');
  if (
    cronSecret &&
    authHeader === `Bearer ${cronSecret}`
  ) {
    return true;
  }
  const vercelCron = request.headers.get('x-vercel-cron');
  if (vercelCron === '1' || vercelCron === 'true') {
    return true;
  }
  return false;
}

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json(
      { success: false, error: 'Yetkisiz cron çağrısı.' },
      { status: 401 },
    );
  }

  const result = await seedWeeklyPublicExams();

  if (!result.success) {
    return NextResponse.json(
      {
        success: false,
        seededCount: result.seededCount,
        examIds: result.examIds,
        errors: result.errors,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    seededCount: result.seededCount,
    examIds: result.examIds,
    errors: result.errors.length > 0 ? result.errors : undefined,
  });
}

export async function POST(request: Request) {
  return GET(request);
}
