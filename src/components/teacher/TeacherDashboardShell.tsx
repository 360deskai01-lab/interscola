'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import type {
  TeacherInvite,
  TeacherOrganizationContext,
  TeacherStudent,
} from '@/app/teacher/actions';
import type { ConversationMessage } from '@/app/messages/actions';
import type { AssessmentPayload } from '@/types/exam';
import type {
  LibraryItem,
  TeacherAssignmentProgressRow,
} from '@/app/teacher/library-actions';
import type { StudentAnalyticsData } from '@/lib/student-analytics';
import type { StudentCareerInsightForTeacher } from '@/lib/student-dashboard/teacher-career-insight';
import { parseTeacherDashboardTab } from '@/lib/teacher-dashboard/dashboard-tabs';
import { TeacherPanel } from '@/components/teacher/TeacherPanel';

export interface TeacherDashboardShellProps {
  profileEmail: string;
  displayName: string | null;
  students: TeacherStudent[];
  invites: TeacherInvite[];
  libraryItems: LibraryItem[];
  assignmentProgress: TeacherAssignmentProgressRow[];
  orgContext: TeacherOrganizationContext | null;
  onCreateInvite: () => Promise<{
    success: boolean;
    error?: string;
    inviteCode?: string;
  }>;
  onRemoveStudent: (
    linkId: string,
  ) => Promise<{ success: boolean; error?: string }>;
  onCreateLibrary: (input: {
    title: string;
    curriculum: string;
    extracted_text?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  onAssignMaterial: (
    libraryId: string,
    studentId: string,
  ) => Promise<{ success: boolean; error?: string }>;
  onAssignGeneratedExam: (
    libraryId: string,
    studentId: string,
    examPayload: AssessmentPayload,
  ) => Promise<{ success: boolean; error?: string }>;
  onGenerateExamFromLibrary: (
    libraryId: string,
    questionCount: number,
  ) => Promise<{
    success: boolean;
    error?: string;
    exam?: AssessmentPayload;
  }>;
  onLoadConversation: (
    partnerId: string,
    assignmentId?: string,
  ) => Promise<{
    success: boolean;
    error?: string;
    data?: ConversationMessage[];
  }>;
  onSendMessage: (
    receiverId: string,
    content: string,
    assignmentId?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  onMarkMessagesRead: (
    senderId: string,
    assignmentId?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  unreadByAssignment: Record<string, number>;
  unreadMessageTotal: number;
  onLoadStudentAnalytics: (studentId: string) => Promise<{
    success: boolean;
    error?: string;
    data?: StudentAnalyticsData;
  }>;
  onLoadStudentCareerInsight: (
    studentId: string,
    studentName: string,
  ) => Promise<{
    success: boolean;
    error?: string;
    data?: StudentCareerInsightForTeacher;
  }>;
  stats: {
    studentCount: number;
    pendingInvites: number;
    totalAttempts: number;
  };
  panelDataError: string | null;
}

function TeacherDashboardShellInner(props: TeacherDashboardShellProps): ReactNode {
  const searchParams = useSearchParams();
  const activeTab = parseTeacherDashboardTab(searchParams.get('tab'));
  return <TeacherPanel {...props} activeTab={activeTab} />;
}

export function TeacherDashboardShell(props: TeacherDashboardShellProps): ReactNode {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-12 text-center text-sm text-slate-400">
          Panel yükleniyor…
        </div>
      }
    >
      <TeacherDashboardShellInner {...props} />
    </Suspense>
  );
}
