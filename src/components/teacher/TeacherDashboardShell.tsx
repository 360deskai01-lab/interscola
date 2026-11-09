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
  LibraryAssignmentHistoryRow,
  LibraryItem,
  TeacherAssignmentProgressRow,
} from '@/app/teacher/library-actions';
import type { StudentAnalyticsData } from '@/lib/student-analytics';
import type { StudentCareerInsightForTeacher } from '@/lib/student-dashboard/teacher-career-insight';
import { parseTeacherDashboardTab } from '@/lib/teacher-dashboard/dashboard-tabs';
import { TeacherPanel } from '@/components/teacher/TeacherPanel';
import type { FacultyColleague } from '@/app/teacher/faculty-actions';
import type { WeeklyDigestRow } from '@/app/teacher/digest-actions';
import type { OfficialExamScheduleSummary } from '@/types/exam-radar';
import type {
  CreateTeacherAssignmentInput,
  TeacherAssignmentStudentOption,
} from '@/lib/b2b/teacher-assignment-actions';
import type { TeacherAssignmentReviewDetail } from '@/lib/b2b/teacher-assignment-review-types';
import type { TeacherAssignSubmitResult } from '@/components/teacher/TeacherAssignFromLibraryModal';

export interface TeacherDashboardShellProps {
  profileEmail: string;
  displayName: string | null;
  students: TeacherStudent[];
  invites: TeacherInvite[];
  libraryItems: LibraryItem[];
  assignmentProgress: TeacherAssignmentProgressRow[];
  assignmentStudentPool: TeacherAssignmentStudentOption[];
  orgContext: TeacherOrganizationContext | null;
  onJoinOrganization: (
    joinCode: string,
  ) => Promise<{ success: boolean; message: string; orgName?: string }>;
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
    dueDate?: string | null,
  ) => Promise<{ success: boolean; error?: string }>;
  onAssignGeneratedExam: (
    libraryId: string,
    studentId: string,
    examPayload: AssessmentPayload,
    dueDate?: string | null,
  ) => Promise<{ success: boolean; error?: string }>;
  onGenerateExamFromLibrary: (
    libraryId: string,
    questionCount: number,
  ) => Promise<{
    success: boolean;
    error?: string;
    exam?: AssessmentPayload;
  }>;
  onLoadLibraryAssignmentHistory: (libraryId: string) => Promise<{
    success: boolean;
    error?: string;
    data?: LibraryAssignmentHistoryRow[];
  }>;
  onCreateTeacherAssignment: (
    input: CreateTeacherAssignmentInput,
  ) => Promise<TeacherAssignSubmitResult>;
  onGetAssignmentReview: (assignmentId: string) => Promise<{
    success: boolean;
    error?: string;
    data?: TeacherAssignmentReviewDetail;
  }>;
  onLoadConversation: (
    partnerId: string,
    assignmentId?: string,
    studentContextId?: string,
  ) => Promise<{
    success: boolean;
    error?: string;
    data?: ConversationMessage[];
  }>;
  onSendMessage: (
    receiverId: string,
    content: string,
    assignmentId?: string,
    studentContextId?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  onMarkMessagesRead: (
    senderId: string,
    assignmentId?: string,
    studentContextId?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  unreadByAssignment: Record<string, number>;
  unreadMessageTotal: number;
  onLoadStudentFaculty: (studentId: string) => Promise<{
    success: boolean;
    error?: string;
    data?: FacultyColleague[];
  }>;
  onGenerateWeeklyDigest: (studentId: string) => Promise<{
    success: boolean;
    error?: string;
    data?: WeeklyDigestRow;
  }>;
  onPublishWeeklyDigest: (
    digestId: string,
    body?: string | null,
  ) => Promise<{ success: boolean; error?: string }>;
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
    libraryMaterialCount: number;
    assignmentVolume: number;
  };
  panelDataError: string | null;
  nearestOfficialExam: OfficialExamScheduleSummary | null;
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
