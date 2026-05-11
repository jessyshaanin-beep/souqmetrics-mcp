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
 * Verify that a given user_id (from the OAuth token) is a member of the workspace.
 * Returns { ok: true } on success or { ok: false, error: string } on failure.
 */
export async function verifyUserAccess(supabase, userId, businessId) {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("user_id", userId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Access denied to this workspace" };
  return { ok: true };
}
