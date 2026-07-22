process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "postgres://postgres:postgres@localhost:5432/brewspace_test";
process.env.REDIS_URL ??= "redis://localhost:6379/1";
process.env.SESSION_SECRET ??= "test-only-secret-do-not-use-in-prod-0000";
process.env.COOKIE_SECURE ??= "false";
