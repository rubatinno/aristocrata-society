import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedIntegrationRequest, unauthorizedIntegrationResponse } from "@/lib/integration-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isAuthorizedIntegrationRequest(request)) return unauthorizedIntegrationResponse();

  const admin = createAdminClient();
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name, slug, headline, session_duration_minutes, meeting_location, timezone")
    .neq("full_name", "")
    .order("full_name");

  return NextResponse.json({
    mentors: (profiles ?? []).map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.full_name,
      headline: p.headline,
      sessionDurationMinutes: p.session_duration_minutes,
      meetingLocation: p.meeting_location,
      timezone: p.timezone,
    })),
  });
}
