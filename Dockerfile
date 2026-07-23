# Bun API image for the BrewSpace monorepo (apps/api + @brewspace/contracts).
# apps/web is intentionally excluded so the API image never pulls Next.js/three.
# Because the workspace graph is a subset of the committed lockfile, the install
# is non-frozen (the resolved versions still come from bun.lock).
FROM oven/bun:1 AS runner
WORKDIR /app

COPY package.json bun.lock ./
COPY apps/api ./apps/api
COPY packages ./packages

RUN bun install --no-frozen-lockfile

ENV NODE_ENV=production
# Render/most PaaS inject PORT; the API reads it via env (defaults to 4000).
EXPOSE 4000

CMD ["bun", "run", "--cwd", "apps/api", "start"]
