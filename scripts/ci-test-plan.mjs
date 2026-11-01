import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Unknown events and paths deliberately retain visual coverage.
export function testPlan(event, paths = [], baseRef = 'develop') {
  if (
    event !== 'pull_request' ||
    /^(main|release\/.*|hotfix\/.*)$/.test(baseRef)
  )
    return { full: true, visual: false };
  const documentationOnly =
    paths.length > 0 &&
    paths.every((path) =>
      /^(docs\/.*\.md|[^/]+\.md|LICENSE|NOTICE|\.github\/CODEOWNERS)$/.test(
        path,
      ),
    );
  return { full: false, visual: !documentationOnly };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const event = process.env.GITHUB_EVENT_NAME;
  let paths = [];
  if (event === 'pull_request') {
    const base = process.env.PR_BASE_SHA;
    if (!/^[a-f0-9]{40}$/.test(base ?? '')) {
      throw new Error(
        'A full PR base SHA is required to select browser coverage',
      );
    }
    paths = execFileSync('git', ['diff', '--name-only', '-z', base, 'HEAD'], {
      encoding: 'utf8',
    })
      .split('\0')
      .filter(Boolean);
  }
  const plan = testPlan(event, paths, process.env.PR_BASE_REF);
  const output = Object.entries(plan)
    .map(([key, value]) => `${key}=${value}\n`)
    .join('');
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(process.env.GITHUB_OUTPUT, output);
  process.stdout.write(output);
}
