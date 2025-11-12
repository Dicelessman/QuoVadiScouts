// Config Sentry locale (opzionale). Lascia DSN vuoto per disabilitare.
window.SENTRY_CONFIG = {
  dsn: "", // es. "https://<key>@oXXXX.ingest.sentry.io/XXXX"
  tracesSampleRate: 0.0, // 0 in locale (no APM)
  environment: "development"
};
