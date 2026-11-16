FROM node:22-slim

WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --prod=false
COPY . .
RUN pnpm build
EXPOSE 3000
CMD ["pnpm", "start"]
