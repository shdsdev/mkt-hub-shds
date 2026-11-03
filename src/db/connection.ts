export function getPostgresOptions(databaseUrl: string): {
  ssl: false | "require";
  prepare?: false;
  max: number;
  idle_timeout: number;
} {
  const url = new URL(databaseUrl);
  const isLocal = /^(127\.0\.0\.1|localhost)$/.test(url.hostname);
  const isTransactionPooler = url.port === "6543";

  return {
    ssl: isLocal ? false : "require",
    max: 3,
    idle_timeout: 20,
    ...(isTransactionPooler ? { prepare: false } : {}),
  };
}
