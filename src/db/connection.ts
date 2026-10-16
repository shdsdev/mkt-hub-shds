export function getPostgresOptions(databaseUrl: string): { ssl: false | "require"; prepare?: false } {
  const url = new URL(databaseUrl);
  const isLocal = /^(127\.0\.0\.1|localhost)$/.test(url.hostname);
  const isTransactionPooler = url.port === "6543";

  return {
    ssl: isLocal ? false : "require",
    ...(isTransactionPooler ? { prepare: false } : {}),
  };
}
