'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentProfile, type ProfileRecord } from '@/lib/auth';
import { getSupabaseAdmin, PROFILES_SCHEMA } from '@/lib/supabase';
import { getSupabaseServer } from '@/lib/supabase/server';
import {
  UNREAD_GENERAL_AGGREGATE_KEY,
  unreadGeneralScopeKey,
} from '@/lib/message-unread-scopes';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_MESSAGE_LENGTH = 4000;

export interface MessageActionResult<T = undefined> {
  success: boolean;
  error?: string;
  data?: T;
}

export interface ConversationMessage {
  id: string;
  senderId: string;
  receiverId: string;
  assignmentId: string | null;
  content: string;
  isRead: boolean;
  createdAt: string;
  isMine: boolean;
}

type MessageRow = {
  id: string;
  sender_id: string;
  receiver_id: string;
  assignment_id: string | null;
  content: string;
  is_read: boolean;
  created_at: string;
};

async function getProfilesClient() {
  const admin = getSupabaseAdmin(PROFILES_SCHEMA);
  if (admin) return admin;
  return await getSupabaseServer(PROFILES_SCHEMA);
}

function isApprovedMessenger(profile: ProfileRecord): boolean {
  if (profile.status !== 'approved') return false;
  return (
    profile.role === 'student' ||
    profile.role === 'teacher' ||
    profile.role === 'admin'
  );
}

async function resolveTeacherStudentPair(
  client: NonNullable<Awaited<ReturnType<typeof getProfilesClient>>>,
  currentUserId: string,
  currentRole: string,
  partnerId: string,
): Promise<{ teacherId: string; studentId: string } | null> {
  let teacherId: string;
  let studentId: string;

  if (currentRole === 'student') {
    teacherId = partnerId;
    studentId = currentUserId;
  } else if (currentRole === 'teacher' || currentRole === 'admin') {
    teacherId = currentUserId;
    studentId = partnerId;
  } else {
    return null;
  }

  const { data, error } = await client
    .from('student_teachers')
    .select('id')
    .eq('teacher_id', teacherId)
    .eq('student_id', studentId)
    .eq('status', 'active')
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.error('[messages] Bağlantı doğrulanamadı:', error.message);
    }
    return null;
  }

  return { teacherId, studentId };
}

async function verifyAssignmentScope(
  client: NonNullable<Awaited<ReturnType<typeof getProfilesClient>>>,
  assignmentId: string,
  teacherId: string,
  studentId: string,
): Promise<boolean> {
  const { data, error } = await client
    .from('assignments')
    .select('id')
    .eq('id', assignmentId)
    .eq('teacher_id', teacherId)
    .eq('student_id', studentId)
    .maybeSingle();

  if (error) {
    console.error('[messages] Ödev kapsamı doğrulanamadı:', error.message);
    return false;
  }

  return Boolean(data);
}

function mapMessageRow(row: MessageRow, currentUserId: string): ConversationMessage {
  return {
    id: row.id,
    senderId: row.sender_id,
    receiverId: row.receiver_id,
    assignmentId: row.assignment_id,
    content: row.content,
    isRead: row.is_read,
    createdAt: row.created_at,
    isMine: row.sender_id === currentUserId,
  };
}

/**
 * İki taraf arasında mesaj gönderir; gönderen oturumdaki kullanıcıdır.
 */
export async function sendMessageAction(
  receiverId: string,
  content: string,
  assignmentId?: string,
): Promise<MessageActionResult> {
  try {
    const current = await getCurrentProfile();
    if (!current || !isApprovedMessenger(current.profile)) {
      return { success: false, error: 'Bu işlem için onaylı öğrenci veya öğretmen hesabı gerekiyor.' };
    }

    if (!UUID_PATTERN.test(receiverId)) {
      return { success: false, error: 'Geçersiz alıcı.' };
    }

    const trimmed = content.trim();
    if (trimmed.length < 1) {
      return { success: false, error: 'Mesaj boş olamaz.' };
    }
    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      return { success: false, error: 'Mesaj çok uzun.' };
    }

    if (assignmentId !== undefined && assignmentId !== null && assignmentId !== '') {
      if (!UUID_PATTERN.test(assignmentId)) {
        return { success: false, error: 'Geçersiz ödev referansı.' };
      }
    }

    const client = await getProfilesClient();
    if (!client) {
      return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const pair = await resolveTeacherStudentPair(
      client,
      current.user.id,
      current.profile.role,
      receiverId,
    );
    if (!pair) {
      return { success: false, error: 'Bu kullanıcıyla mesajlaşma yetkin yok.' };
    }

    const scopedAssignmentId =
      assignmentId && assignmentId.trim() ? assignmentId.trim() : null;

    if (scopedAssignmentId) {
      const ok = await verifyAssignmentScope(
        client,
        scopedAssignmentId,
        pair.teacherId,
        pair.studentId,
      );
      if (!ok) {
        return { success: false, error: 'Ödev bu konuşmaya ait değil.' };
      }
    }

    const { error } = await client.from('messages').insert({
      sender_id: current.user.id,
      receiver_id: receiverId,
      assignment_id: scopedAssignmentId,
      content: trimmed,
      is_read: false,
    });

    if (error) {
      console.error('[messages] Mesaj kaydedilemedi:', error.message);
      return { success: false, error: 'Mesaj gönderilemedi.' };
    }

    revalidatePath('/student/dashboard');
    revalidatePath('/teacher/dashboard');

    return { success: true };
  } catch (error) {
    console.error(
      '[messages] sendMessageAction hatası:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Beklenmeyen bir hata oluştu.' };
  }
}

/**
 * İki kullanıcı arasındaki mesaj geçmişi (created_at artan).
 */
export async function getConversationAction(
  partnerId: string,
  assignmentId?: string,
): Promise<MessageActionResult<ConversationMessage[]>> {
  try {
    const current = await getCurrentProfile();
    if (!current || !isApprovedMessenger(current.profile)) {
      return { success: false, error: 'Bu veri için onaylı hesap gerekiyor.' };
    }

    if (!UUID_PATTERN.test(partnerId)) {
      return { success: false, error: 'Geçersiz konuşma partneri.' };
    }

    const client = await getProfilesClient();
    if (!client) {
      return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const pair = await resolveTeacherStudentPair(
      client,
      current.user.id,
      current.profile.role,
      partnerId,
    );
    if (!pair) {
      return { success: false, error: 'Bu konuşmaya erişim yok.' };
    }

    const scopedAssignmentId =
      assignmentId && assignmentId.trim() ? assignmentId.trim() : null;

    if (scopedAssignmentId && !UUID_PATTERN.test(scopedAssignmentId)) {
      return { success: false, error: 'Geçersiz ödev filtresi.' };
    }

    if (scopedAssignmentId) {
      const ok = await verifyAssignmentScope(
        client,
        scopedAssignmentId,
        pair.teacherId,
        pair.studentId,
      );
      if (!ok) {
        return { success: false, error: 'Ödev bu konuşmaya ait değil.' };
      }
    }

    const me = current.user.id;
    let query = client
      .from('messages')
      .select(
        'id, sender_id, receiver_id, assignment_id, content, is_read, created_at',
      )
      .or(
        `and(sender_id.eq.${me},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${me})`,
      )
      .order('created_at', { ascending: true });

    if (scopedAssignmentId) {
      query = query.eq('assignment_id', scopedAssignmentId);
    } else {
      query = query.is('assignment_id', null);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[messages] Konuşma okunamadı:', error.message);
      return { success: false, error: 'Mesajlar yüklenemedi.' };
    }

    const messages = ((data ?? []) as MessageRow[]).map((row) =>
      mapMessageRow(row, me),
    );

    return { success: true, data: messages };
  } catch (error) {
    console.error(
      '[messages] getConversationAction hatası:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Konuşma yüklenemedi.' };
  }
}

/**
 * Karşı taraftan gelen okunmamış mesajları okundu işaretler.
 */
export async function markMessagesAsReadAction(
  senderId: string,
  assignmentId?: string | null,
): Promise<MessageActionResult> {
  try {
    const current = await getCurrentProfile();
    if (!current || !isApprovedMessenger(current.profile)) {
      return { success: false, error: 'Bu işlem için onaylı hesap gerekiyor.' };
    }

    if (!UUID_PATTERN.test(senderId)) {
      return { success: false, error: 'Geçersiz gönderen.' };
    }

    const scopedAssignmentId =
      assignmentId !== undefined &&
      assignmentId !== null &&
      String(assignmentId).trim() !== ''
        ? String(assignmentId).trim()
        : null;

    if (scopedAssignmentId && !UUID_PATTERN.test(scopedAssignmentId)) {
      return { success: false, error: 'Geçersiz ödev referansı.' };
    }

    const client = await getProfilesClient();
    if (!client) {
      return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const pair = await resolveTeacherStudentPair(
      client,
      current.user.id,
      current.profile.role,
      senderId,
    );
    if (!pair) {
      return { success: false, error: 'Bu mesajları okundu işaretleme yetkin yok.' };
    }

    if (scopedAssignmentId) {
      const ok = await verifyAssignmentScope(
        client,
        scopedAssignmentId,
        pair.teacherId,
        pair.studentId,
      );
      if (!ok) {
        return { success: false, error: 'Ödev bu konuşmaya ait değil.' };
      }
    }

    let updateQuery = client
      .from('messages')
      .update({ is_read: true })
      .eq('receiver_id', current.user.id)
      .eq('sender_id', senderId)
      .eq('is_read', false);

    if (scopedAssignmentId) {
      updateQuery = updateQuery.eq('assignment_id', scopedAssignmentId);
    } else {
      updateQuery = updateQuery.is('assignment_id', null);
    }

    const { error } = await updateQuery;

    if (error) {
      console.error('[messages] Okundu güncellenemedi:', error.message);
      return { success: false, error: 'Okundu bilgisi güncellenemedi.' };
    }

    revalidatePath('/student/dashboard');
    revalidatePath('/teacher/dashboard');

    return { success: true };
  } catch (error) {
    console.error(
      '[messages] markMessagesAsReadAction hatası:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Beklenmeyen bir hata oluştu.' };
  }
}

export interface UnreadMessagesSummary {
  total: number;
  bySenderId: Record<string, number>;
}

export type UnreadCountsByAssignment = Record<string, number>;

/**
 * Oturum sahibine gelen okunmamış mesaj özeti (rozetler için).
 */
export async function getUnreadMessagesSummaryAction(): Promise<{
  success: boolean;
  error?: string;
  summary?: UnreadMessagesSummary;
}> {
  try {
    const current = await getCurrentProfile();
    if (!current || !isApprovedMessenger(current.profile)) {
      return { success: true, summary: { total: 0, bySenderId: {} } };
    }

    const client = await getProfilesClient();
    if (!client) {
      return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const { data, error } = await client
      .from('messages')
      .select('sender_id')
      .eq('receiver_id', current.user.id)
      .eq('is_read', false);

    if (error) {
      console.error('[messages] Okunmamış sayım hatası:', error.message);
      return { success: false, error: 'Mesaj bildirimi yüklenemedi.' };
    }

    const bySenderId: Record<string, number> = {};
    for (const row of data ?? []) {
      const senderId = (row as { sender_id: string }).sender_id;
      if (typeof senderId === 'string') {
        bySenderId[senderId] = (bySenderId[senderId] ?? 0) + 1;
      }
    }

    const total = Object.values(bySenderId).reduce(
      (sum, count) => sum + count,
      0,
    );

    return { success: true, summary: { total, bySenderId } };
  } catch (error) {
    console.error(
      '[messages] getUnreadMessagesSummaryAction hatası:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Mesaj bildirimi yüklenemedi.' };
  }
}

/**
 * Ödev / genel kapsamda okunmamış mesaj sayıları (rozet izolasyonu).
 * - Ödev mesajları: anahtar = assignment UUID
 * - Genel mesajlar: anahtar = `general:{partnerSenderId}` ve toplam `general`
 */
export async function getUnreadCountsByAssignmentAction(): Promise<{
  success: boolean;
  error?: string;
  counts?: UnreadCountsByAssignment;
}> {
  try {
    const current = await getCurrentProfile();
    if (!current || !isApprovedMessenger(current.profile)) {
      return { success: true, counts: {} };
    }

    const client = await getProfilesClient();
    if (!client) {
      return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const { data, error } = await client
      .from('messages')
      .select('sender_id, assignment_id')
      .eq('receiver_id', current.user.id)
      .eq('is_read', false);

    if (error) {
      console.error('[messages] Ödev bazlı okunmamış sayım hatası:', error.message);
      return { success: false, error: 'Mesaj bildirimi yüklenemedi.' };
    }

    const counts: UnreadCountsByAssignment = {};
    let generalTotal = 0;

    for (const row of data ?? []) {
      const senderId = (row as { sender_id: string }).sender_id;
      const assignmentId = (row as { assignment_id: string | null })
        .assignment_id;

      if (typeof senderId !== 'string') continue;

      if (assignmentId && UUID_PATTERN.test(assignmentId)) {
        counts[assignmentId] = (counts[assignmentId] ?? 0) + 1;
      } else {
        generalTotal += 1;
        const scopeKey = unreadGeneralScopeKey(senderId);
        counts[scopeKey] = (counts[scopeKey] ?? 0) + 1;
      }
    }

    if (generalTotal > 0) {
      counts[UNREAD_GENERAL_AGGREGATE_KEY] = generalTotal;
    }

    return { success: true, counts };
  } catch (error) {
    console.error(
      '[messages] getUnreadCountsByAssignmentAction hatası:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Mesaj bildirimi yüklenemedi.' };
  }
}

export async function sendMessageFormAction(
  receiverId: string,
  content: string,
  assignmentId?: string,
): Promise<MessageActionResult> {
  return sendMessageAction(receiverId, content, assignmentId);
}

export async function getConversationFormAction(
  partnerId: string,
  assignmentId?: string,
): Promise<MessageActionResult<ConversationMessage[]>> {
  return getConversationAction(partnerId, assignmentId);
}

export async function markMessagesAsReadFormAction(
  senderId: string,
  assignmentId?: string,
): Promise<MessageActionResult> {
  return markMessagesAsReadAction(senderId, assignmentId);
}
