set positional-arguments

# List available commands.
default:
    @just --list

# Install dependencies from the committed npm lockfile.
install *args:
    npm ci "$@"

# Start the development server (prepares pinned engines).
dev *args:
    npm run dev -- "$@"

# Prepare engines, check types and build the production app.
build *args:
    npm run build -- "$@"

# Serve the production build locally.
preview *args:
    npm run preview -- "$@"

# Verify and prepare the pinned browser engines.
engines-prepare:
    npm run engines:prepare

# Check TypeScript types.
typecheck *args:
    npm run typecheck -- "$@"

# Check architectural import boundaries.
check-architecture:
    npm run check:architecture

# Format source and documentation.
format *args:
    npm run format -- "$@"

# Check formatting and architectural imports.
lint:
    npm run lint

# Run unit and script tests.
test:
    npm test

# Run browser tests against a fresh production build.
test-e2e *args:
    npm run test:e2e -- "$@"

# Run formatting, architecture, type and unit checks.
check:
    npm run check

# Regenerate the example catalog index.
examples-index:
    npm run examples:index

# Check example metadata and real-engine browser scenarios.
test-examples *args:
    npm run test:examples -- "$@"

# Install the bundled Chromium used by browser checks.
install-browser:
    npx playwright install chromium
