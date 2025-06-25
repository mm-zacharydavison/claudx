import type { CommandDescriptor } from "./types";

export const COMMAND_DESCRIPTORS: CommandDescriptor[] = [
  // Package managers
  { command: 'npm', argumentCount: 2 }, // npm install, npm run, npm test
  { command: 'pnpm', argumentCount: 1 }, // pnpm install, pnpm jest
  { command: 'yarn', argumentCount: 1 }, // yarn install, yarn build
  { command: 'bun', argumentCount: 1 }, // bun install, bun run

  // Version control
  { command: 'git', argumentCount: 1 }, // git commit, git push, git pull
  { command: 'gh', argumentCount: 1 }, // gh pr, gh issue

  // Build tools
  { command: 'make', argumentCount: 1 }, // make build, make test
  { command: 'cmake', argumentCount: 1 }, // cmake build, cmake configure
  { command: 'cargo', argumentCount: 1 }, // cargo build, cargo test
  { command: 'go', argumentCount: 1 }, // go build, go test

  // Testing frameworks
  { command: 'jest', argumentCount: 0 }, // jest (options come after)
  { command: 'pytest', argumentCount: 0 }, // pytest (options come after)
  { command: 'mocha', argumentCount: 0 }, // mocha (options come after)
  { command: 'vitest', argumentCount: 0 }, // vitest (options come after)

  // Compilers and transpilers
  { command: 'tsc', argumentCount: 0 }, // tsc (options come after)
  { command: 'babel', argumentCount: 0 }, // babel (options come after)
  { command: 'webpack', argumentCount: 0 }, // webpack (options come after)
  { command: 'vite', argumentCount: 1 }, // vite build, vite dev

  // Linters and formatters
  { command: 'eslint', argumentCount: 0 }, // eslint (files/options come after)
  { command: 'prettier', argumentCount: 0 }, // prettier (files/options come after)
  { command: 'ruff', argumentCount: 1 }, // ruff format, ruff check
  { command: 'black', argumentCount: 0 }, // black (files come after)

  // Docker
  { command: 'docker', argumentCount: 1 }, // docker build, docker run
  { command: 'docker-compose', argumentCount: 1 }, // docker-compose up, docker-compose down

  // Cloud tools
  { command: 'aws', argumentCount: 1 }, // aws s3, aws ec2
  { command: 'gcloud', argumentCount: 1 }, // gcloud compute, gcloud storage
  { command: 'kubectl', argumentCount: 1 }, // kubectl get, kubectl apply

  // Text processing (common for development)
  { command: 'jq', argumentCount: 1 }, // jq '.field', jq 'length'
  { command: 'curl', argumentCount: 0 }, // curl (URL and options vary)
  { command: 'wget', argumentCount: 0 }, // wget (URL and options vary)

  // Editor/IDE commands
  { command: 'code', argumentCount: 0 }, // code (files/directories come after)
  { command: 'vim', argumentCount: 0 }, // vim (files come after)
  { command: 'nvim', argumentCount: 0 }, // nvim (files come after)
];