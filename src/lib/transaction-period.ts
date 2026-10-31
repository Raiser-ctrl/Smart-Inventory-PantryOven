
export const TRANSACTION_PERIODS = [
  "today",
  "7days",
  "30days",
  "this_month",
  "last_month",
  "all",
  "custom",
] as const;

export type TransactionPeriod =
  (typeof TRANSACTION_PERIODS)[number];

export function normalizePeriod(
  value: string
): TransactionPeriod {
  return TRANSACTION_PERIODS.includes(
    value as TransactionPeriod
  )
    ? (value as TransactionPeriod)
    : "this_month";
}

export function normalizeDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return "";
  }

  const date = new Date(`${value}T00:00:00Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    return "";
  }

  return value;
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function shiftDate(
  date: string,
  days: number
) {
  const result = new Date(
    `${date}T00:00:00Z`
  );

  result.setUTCDate(
    result.getUTCDate() + days
  );

  return formatDate(result);
}

function jakartaToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function jakartaDateBoundary(
  date: string,
  nextDay = false
) {
  const timestamp =
    Date.parse(`${date}T00:00:00+07:00`) +
    (nextDay ? 86_400_000 : 0);

  return new Date(timestamp).toISOString();
}

export function resolveTransactionPeriod(
  period: TransactionPeriod,
  customStartDate = "",
  customEndDate = ""
) {
  const today = jakartaToday();

  const [year, month] = today
    .split("-")
    .map(Number);

  let startDate = "";
  let endDate = "";

  switch (period) {
    case "today":
      startDate = today;
      endDate = today;
      break;

    case "7days":
      startDate = shiftDate(today, -6);
      endDate = today;
      break;

    case "30days":
      startDate = shiftDate(today, -29);
      endDate = today;
      break;

    case "this_month":
      startDate =
        `${year}-${String(month).padStart(2, "0")}-01`;
      endDate = today;
      break;

    case "last_month": {
      const firstDay = new Date(
        Date.UTC(year, month - 2, 1)
      );

      const lastDay = new Date(
        Date.UTC(year, month - 1, 0)
      );

      startDate = formatDate(firstDay);
      endDate = formatDate(lastDay);
      break;
    }

    case "custom":
      startDate = normalizeDate(customStartDate);
      endDate = normalizeDate(customEndDate);
      break;

    case "all":
      break;
  }

  return {
    startDate,
    endDate,
    hasInvalidRange: Boolean(
      startDate &&
      endDate &&
      startDate > endDate
    ),
  };
}
