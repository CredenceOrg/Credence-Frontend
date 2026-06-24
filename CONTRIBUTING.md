# Contributing to Credence Frontend

Thanks for contributing! This guide covers the workflow for the Credence frontend monorepo.

## Quick Start

```bash
git clone https://github.com/CredenceOrg/Credence-Frontend.git
cd Credence-Frontend
npm install
npm run dev
```

## Development Workflow

### Branch Naming

- `feat/description` — new features
- `fix/description` — bug fixes
- `docs/description` — documentation
- `refactor/description` — code restructuring
- `chore/description` — maintenance

### Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(ui): add dark mode toggle
fix(api): correct token refresh logic
docs(readme): update installation steps
refactor(state): extract auth context
```

### PR Checklist

- [ ] Branch targets `main`
- [ ] Code follows ESLint and Prettier config
- [ ] All existing tests pass: `npm test`
- [ ] New features include tests
- [ ] Visual changes include screenshots
- [ ] No console.log left in code
- [ ] PR description links related issue

## Local Setup

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Run tests
npm test

# Run lint
npm run lint

# Build for production
npm run build
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `http://localhost:3001` |
| `VITE_NETWORK` | Stellar network | `testnet` |
| `VITE_RPC_URL` | Soroban RPC endpoint | `https://soroban-testnet.stellar.org` |

## Project Structure

```
src/
├── components/    # Reusable UI components
├── pages/         # Route pages
├── hooks/         # Custom React hooks
├── services/      # API and blockchain services
├── store/         # State management
├── utils/         # Helper functions
├── types/         # TypeScript types
└── assets/        # Static assets
```

## Testing

```bash
# Unit tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

## CI/CD

All PRs trigger GitHub Actions that run:
1. ESLint check
2. Prettier format check
3. Unit tests (Vitest)
4. Build verification

## Getting Help

- Check existing [issues](https://github.com/CredenceOrg/Credence-Frontend/issues)
- Join the [Credence Discord](https://discord.gg/credence)
- Tag maintainers in your PR for review
