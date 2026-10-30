# Security

Use minimal, non-sensitive example models in public reports. Do not include credentials, proprietary model files or raw browser storage.

For a suspected vulnerability, contact repository maintainers privately using an agreed channel before posting reproduction details publicly. A dedicated private reporting channel and supported release policy have not yet been configured.

Maintainers should retain engine checksums and notices, review dependency updates and run the repository checks before releases. The application uses browser workers and local files; a valid schema does not establish that modeled content is semantically valid or safe to execute.

## Public content

Before publishing, review tracked source, documentation and captures for unintended personal details, absolute workstation paths, credentials and private model data. Use repository-relative paths in documentation and keep local setup, reports and captures under ignored `sandbox/`. Keep credentials out of files and URLs. Retain required upstream license and provenance attribution.

Git author and committer attribution is public metadata. Removing text in a new commit does not remove it from earlier commits; review history separately when sensitive information has been published. Local remotes, SSH configuration and ignored files are not part of the tracked repository.
