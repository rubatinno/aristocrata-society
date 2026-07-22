export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = domingo ... 6 = sábado

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  0: "Domingo",
  1: "Segunda",
  2: "Terça",
  3: "Quarta",
  4: "Quinta",
  5: "Sexta",
  6: "Sábado",
};

export const WEEKDAY_SHORT_LABELS: Record<Weekday, string> = {
  0: "Dom",
  1: "Seg",
  2: "Ter",
  3: "Qua",
  4: "Qui",
  5: "Sex",
  6: "Sáb",
};

export type BookingStatus = "confirmada" | "concluida" | "cancelada" | "no_show";

// Usamos `type` (não `interface`) porque o cliente Supabase exige que cada
// tabela satisfaça `Record<string, unknown>` estruturalmente — interfaces não
// recebem um índice implícito e quebram a inferência de tipos das queries.
export type Profile = {
  id: string;
  full_name: string;
  headline: string | null;
  avatar_url: string | null;
  slug: string;
  timezone: string;
  session_duration_minutes: number;
  buffer_minutes: number;
  meeting_location: string | null;
  booking_instructions: string | null;
  recurring_enabled: boolean;
  booking_window_days: number;
  min_notice_hours: number;
  is_admin: boolean;
  created_at: string;
  rate_per_call: number | null;
  google_calendar_connected: boolean;
};

export type MentorGoogleToken = {
  mentor_id: string;
  refresh_token: string;
  connected_email: string | null;
  created_at: string;
  updated_at: string;
};

export type MentorPayment = {
  id: string;
  mentor_id: string;
  amount: number;
  paid_through: string; // yyyy-MM-dd
  notes: string | null;
  added_by: string | null;
  created_at: string;
};

export type AvailabilityRule = {
  id: string;
  mentor_id: string;
  weekday: Weekday;
  start_time: string; // "09:00:00"
  end_time: string; // "18:00:00"
  is_active: boolean;
};

export type Plan = {
  id: string;
  name: string;
  calls_per_week: number | null;
  calls_per_month: number | null;
  total_calls: number | null;
  duration_days: number | null;
  created_at: string;
};

export type MenteeStatus = "pending" | "approved" | "rejected";
export type MemberRole = "mentee" | "mentor" | "admin";

export type ApprovedMentee = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  status: MenteeStatus;
  role: MemberRole | null;
  user_id: string | null;
  plan_id: string | null;
  starts_at: string; // yyyy-MM-dd
  added_by: string | null;
  created_at: string;
  total_calls_override: number | null;
  duration_days_override: number | null;
  group_link: string | null;
};

export type MenteeProfile = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  created_at: string;
};

export function isMenteeProfileComplete(profile: Pick<MenteeProfile, "full_name" | "phone">) {
  return Boolean(profile.full_name?.trim() && profile.phone?.trim());
}

export type MenteeLink = {
  id: string;
  mentee_id: string;
  title: string;
  url: string;
  added_by: string | null;
  created_at: string;
};

export type MenteeNote = {
  id: string;
  mentee_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export type AvailabilityDate = {
  id: string;
  mentor_id: string;
  date: string; // "yyyy-MM-dd"
  start_time: string; // "09:00:00"
  end_time: string; // "18:00:00"
  is_active: boolean;
};

export type Booking = {
  id: string;
  mentor_id: string;
  mentee_id: string | null;
  mentee_name: string;
  mentee_email: string;
  mentee_phone: string;
  notes: string | null;
  starts_at: string; // ISO timestamptz
  ends_at: string; // ISO timestamptz
  status: BookingStatus;
  meeting_link: string | null;
  created_at: string;
  google_event_id: string | null;
  reminder_30_sent_at: string | null;
  reminder_5_sent_at: string | null;
  reminder_start_sent_at: string | null;
};

// Tipagem mínima do schema, no formato esperado pelo cliente Supabase.
// Gere o tipo completo com `supabase gen types typescript` quando o projeto
// estiver conectado, e substitua este arquivo pelo gerado automaticamente.
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & { id: string; full_name: string; slug: string };
        Update: Partial<Profile>;
        Relationships: [];
      };
      availability_rules: {
        Row: AvailabilityRule;
        Insert: Omit<AvailabilityRule, "id"> & { id?: string };
        Update: Partial<AvailabilityRule>;
        Relationships: [];
      };
      availability_dates: {
        Row: AvailabilityDate;
        Insert: Omit<AvailabilityDate, "id"> & { id?: string };
        Update: Partial<AvailabilityDate>;
        Relationships: [];
      };
      bookings: {
        Row: Booking;
        Insert: Omit<
          Booking,
          | "id"
          | "created_at"
          | "mentee_id"
          | "google_event_id"
          | "reminder_30_sent_at"
          | "reminder_5_sent_at"
          | "reminder_start_sent_at"
        > & {
          id?: string;
          created_at?: string;
          mentee_id?: string | null;
          google_event_id?: string | null;
          reminder_30_sent_at?: string | null;
          reminder_5_sent_at?: string | null;
          reminder_start_sent_at?: string | null;
        };
        Update: Partial<Booking>;
        Relationships: [];
      };
      approved_mentees: {
        Row: ApprovedMentee;
        Insert: Omit<
          ApprovedMentee,
          | "id"
          | "created_at"
          | "starts_at"
          | "role"
          | "user_id"
          | "total_calls_override"
          | "duration_days_override"
          | "group_link"
        > & {
          id?: string;
          created_at?: string;
          starts_at?: string;
          role?: MemberRole | null;
          user_id?: string | null;
          total_calls_override?: number | null;
          duration_days_override?: number | null;
          group_link?: string | null;
        };
        Update: Partial<ApprovedMentee>;
        Relationships: [];
      };
      plans: {
        Row: Plan;
        Insert: Omit<Plan, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Plan>;
        Relationships: [];
      };
      mentee_links: {
        Row: MenteeLink;
        Insert: Omit<MenteeLink, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<MenteeLink>;
        Relationships: [];
      };
      mentee_profiles: {
        Row: MenteeProfile;
        Insert: Partial<MenteeProfile> & { id: string; email: string };
        Update: Partial<MenteeProfile>;
        Relationships: [];
      };
      mentee_notes: {
        Row: MenteeNote;
        Insert: Omit<MenteeNote, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<MenteeNote>;
        Relationships: [];
      };
      mentor_payments: {
        Row: MentorPayment;
        Insert: Omit<MentorPayment, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<MentorPayment>;
        Relationships: [];
      };
      mentor_google_tokens: {
        Row: MentorGoogleToken;
        Insert: Omit<MentorGoogleToken, "created_at" | "updated_at" | "connected_email"> & {
          created_at?: string;
          updated_at?: string;
          connected_email?: string | null;
        };
        Update: Partial<MentorGoogleToken>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_busy_ranges: {
        Args: { p_mentor_id: string; p_from: string; p_to: string };
        Returns: { starts_at: string; ends_at: string }[];
      };
    };
  };
}
