export type AssistantPhase =
  | 'chat'
  | 'booking_contact'
  | 'booking_slots'
  | 'booking_done';

export type ChatMessage = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  link?: { href: string; label: string };
};

export type QuickChipId =
  | 'diagnostic'
  | 'exams'
  | 'corporate'
  | 'booking';

export type BookingContact = {
  fullName: string;
  email: string;
  phone: string;
};

export type BookingSlot = {
  dateIso: string;
  dateLabel: string;
  time: string;
};

export type StoredBooking = BookingContact &
  BookingSlot & {
    id: string;
    meetLink: string;
    createdAt: string;
  };

export const ASSISTANT_BOOKINGS_STORAGE_KEY = 'interscola_assistant_bookings';
