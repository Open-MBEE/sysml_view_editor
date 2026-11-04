# Git Flow workflow

`develop` is the default integration branch for this sandbox. `main` holds reviewed release history. The repository follows Git Flow branch roles using ordinary Git and GitHub PRs; no Git Flow extension or new service is required.

## Branches and review

| Branch                        | Start from | Integration target                                      | GitHub requirements                                                                                                            |
| ----------------------------- | ---------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `feature/<task>`              | `develop`  | `develop`                                               | Passing `checks`, up-to-date branch and resolved conversations; zero mandatory approvals                                       |
| `docs/<task>` or `fix/<task>` | `develop`  | `develop`                                               | Same integration gate as features                                                                                              |
| `develop`                     | Long-lived | `release/<version>` when preparing a release            | Default branch; PRs and CI required, including administrators; force pushes and deletion blocked                               |
| `release/<version>`           | `develop`  | `main`, then back into `develop`                        | CI runs on pushes and PRs; force pushes blocked; `main` requires one code-owner approval                                       |
| `hotfix/<version>`            | `main`     | `main`, then back into `develop` and any active release | CI runs on pushes and PRs; force pushes blocked; `main` requires one code-owner approval                                       |
| `main`                        | Long-lived | Released history; merge-back source                     | Up-to-date CI, resolved conversations and one code-owner approval, including administrators; force pushes and deletion blocked |

The required `checks` status comes from GitHub Actions. CODEOWNERS identifies the maintainers for every path. Approval is optional on `develop`; the required main-branch approval must come from an eligible code owner other than the PR author. The branch-origin and PR-target conventions in this document are maintained by contributors; GitHub protection enforces CI, reviews and protected-ref operations.

`feature/`, `release/` and `hotfix/` are prefixes, not permanent empty branches. Create a branch for a real task or version. Existing `feat/*` branches remain valid historical feature branches. Release and hotfix branches can be deleted after their changes have reached every required target.

## Everyday work

Start from the current remote integration branch, after verifying a clean checkout and the configured Git context:

```sh
git fetch origin
git switch -c feature/short-description origin/develop
```

Implement a focused change, run the relevant checks, commit with a Conventional Commit message and push the feature branch. Open its PR against `develop`. Use a merge commit for integration so the same commits remain identifiable when they later reach `main` and are merged back. Human review remains welcome on `develop` even though it is not mandatory.

Documentation and ordinary fixes also target `develop`. Reserve `hotfix/*` for an urgent correction to code already released on `main`.

CI validates every PR. Pushes to `main`, `release/**` and `hotfix/**` run the full suite, as do release-targeted PRs, weekly schedules and manual dispatch. There is no duplicate validation push after merging into `develop`. Development PRs run all fast checks and critical browser workflows, adding visual comparisons for code changes; see [CI coverage](testing.md#ci-coverage). Local success and a hosted CI result are separate evidence.

## Prepare a release

When the sandbox is ready for a named release, start from current integration work:

```sh
git fetch origin
git switch -c release/VERSION origin/develop
```

Replace `VERSION` with the intended version before running the command. Use this branch for stabilization, version metadata, compatibility notes and release notes. Continue new feature work on `develop`.

Open a release PR against `main`. Obtain the required code-owner approval and passing CI, then merge using a merge commit. Create the corresponding annotated `v<version>` tag on the resulting `main` release commit after verifying its checks. Publishing a GitHub Release or deployment is a separate explicit action; branch creation does not publish anything.

Open a merge-back PR from updated `main` to `develop`, including release stabilization and version changes. Resolve conflicts on a temporary branch based on the target, run checks, and merge through its normal gate. Delete the release branch only after both paths are complete. No release branch or tag is created as a placeholder during sandbox setup.

## Apply a hotfix

Start `hotfix/<version>` from `origin/main`. Review and validate its PR against `main` using the same code-owner gate, merge with a merge commit, and tag the resulting patch release after its checks pass. Merge updated `main` back into `develop` through a PR. If a release is active, also bring the fix into that release branch before it ships.

Retain the hotfix branch until those integrations are complete. Do not force-push protected history or use administrative overrides to satisfy a blocked gate.

## Repository configuration

GitHub stores the live default-branch and protection settings. The release/hotfix ruleset blocks non-fast-forward updates for both prefixes, including nested branch names. `main` and `develop` use their own protection rules. Keep the default branch, protection requirements, workflow branch filters and this document consistent when changing the workflow.

The local checkout records the conventional Git Flow branch/prefix names for tools that read them: `main`, `develop`, `feature/`, `release/`, `hotfix/`, and version tag prefix `v`. Other contributors can follow the ordinary Git commands above without installing an extension or inheriting local Git configuration.

The repository remains at sandbox stage. This branch workflow does not establish a supported release, automatic versioning, deployment pipeline or release-support commitment.

References: [Git Flow branch lifecycle](https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow/) and [GitHub protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches).
