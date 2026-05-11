export function getStartDateFromTimeframe(timeframe) {
  const now = new Date();
  let startDate = new Date(now);

  if (timeframe === "today") {
    startDate.setHours(0, 0, 0, 0);
  } else if (timeframe === "last_7_days") {
    startDate.setDate(now.getDate() - 7);
  } else if (timeframe === "last_90_days") {
    startDate.setDate(now.getDate() - 90);
  } else {
    // default: last_30_days
    startDate.setDate(now.getDate() - 30);
  }

  return startDate.toISOString();
}

export function getPreviousStartDate(startDate) {
  const start = new Date(startDate);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - diffMs);
  return { prevStart: prevStart.toISOString(), prevEnd: prevEnd.toISOString() };
}

/**
 * Verify that a given email is a member of the given workspace.
 * workspace_members stores email alongside user_id, so no auth lookup is needed.
 *
 * Returns { ok: true } on success or { ok: false, error: string } on failure.
 */
export async function verifyEmailAccess(supabase, email, businessId) {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("email", email)
    .eq("business_id", businessId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "This email does not have access to this workspace" };
  return { ok: true };
}
