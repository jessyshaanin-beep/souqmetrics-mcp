export const TEST_BUSINESS_ID = "e3661b20-d16f-4435-a38f-d7a0c706be4d";

export function getStartDateFromTimeframe(timeframe) {
  const now = new Date();
  let startDate;

  if (timeframe === "today") {
    startDate = new Date(now);
    startDate.setHours(0, 0, 0, 0);
  } else if (timeframe === "last_7_days") {
    startDate = new Date(now);
    startDate.setDate(now.getDate() - 7);
  } else if (timeframe === "last_30_days") {
    startDate = new Date(now);
    startDate.setDate(now.getDate() - 30);
  } else {
    startDate = new Date(now);
    startDate.setDate(now.getDate() - 30);
  }

  return startDate.toISOString();
}