---
name: container-test-matrix
description: Verify a change on every platform it claims, by running the actual commands and scripts in Docker containers (each Linux distribution family, Windows where possible) and with the multi-platform toolchains the project uses (npm, bun, node, pwsh). Use when a change touches scripts, installers, CLI entrypoints, packaging, or anything whose behaviour differs by OS, shell, or distribution.
---

# Container test matrix

A change is verified on the platforms it claims, in those platforms' own runtimes.
Reading a script and reasoning about portability is not verification.

## What your host can run

| Host | Linux containers | Windows containers | macOS |
|---|---|---|---|
| Linux | yes, native | no (needs a Windows host with a compatible kernel) | no (real Mac or a macOS CI runner) |
| Windows with Docker Desktop | yes, through the Linux VM | yes, when Docker is switched to Windows containers and the image matches the host build | no |
| macOS | yes, through the Linux VM | no | the host itself |

State plainly which cell you used and which you could not. "Not runnable from this host"
is an honest result; "should work" is not a result.

## The Linux matrix

Cover the families the project claims, one image per family, tags pinned:

| Family | Image example | Package manager | Watches for |
|---|---|---|---|
| Debian / Ubuntu | `debian:13`, `ubuntu:24.04` | apt | plain POSIX shell, GNU coreutils |
| Fedora / RHEL / Rocky | `fedora:latest`, `rockylinux:9` | dnf | SELinux, newer glibc, `curl` absent from minimal images |
| Arch and derivatives (CachyOS, Manjaro) | `archlinux:latest` | pacman | rolling packages, `python` not always present |
| openSUSE | `opensuse/tumbleweed` | zypper | different package names, `nodejs22` style versions |
| Alpine | `alpine:latest` | apk | musl, busybox, no `bash` by default |

Derivatives matter: a distribution that is not in the project's list may still resolve
through `ID_LIKE` (CachyOS reports `ID_LIKE=arch`). Test the mapping, not only the names.

## Recipe

```sh
docker run --rm -v "$PWD:/w:ro" -w /w <image> sh -ceu '
  <install the project dependencies with that distribution package manager>
  <run the exact test or entrypoint command>
'
```

- `--rm` always; leave no container, image layer or state behind.
- Mount read-only unless the test must write; then mount a scratch path, never the repo.
- `sh -ceu` inside, so a failing step fails the run instead of being masked.
- One container per family, pulled in parallel, but respect the machine's memory: many
  parallel containers plus a build is how a 16 GB box starts swapping.
- Provide the runtime the test needs explicitly (a container ships no `sudo`, no `systemd`,
  and often no `curl`, `git` or `node`). A missing tool is a finding about the project's
  assumptions, not a reason to skip the row.

## Multi-platform toolchains

- Node projects: `npm ci && npm test` and `npm pack` (packaging failures surface only there)
  inside each container, plus `bun install && bun test` where bun is a supported runtime.
- Run the project's own entrypoints, not only the test suite: a CLI, a script, an installer.
- Windows-specific hazards the matrix catches: spawning a `.cmd`/`.bat` shim without a shell
  (`ENOENT` even though the command resolves in a shell), `PATH` shim resolution, drive letters,
  CRLF, case-insensitive paths, file locks on `rename` (`EPERM`/`EBUSY`), reserved names.
- Shell hazards between platforms: `sh` versus `pwsh`/PowerShell 7, `#!/usr/bin/env` lines,
  quoting rules, `mktemp`/`$TMPDIR`, locale and UTF-8 (`chcp 65001`, `LANG`).
- When a script has parallel implementations per platform (`.sh` and `.ps1`, or a Node
  launcher), every row must exercise each implementation; parity is a test, not a comment.

## Evidence

For every row record: host, image tag, exact command, exit code, and the output that proves
the assertion. Then record what could not run and why (no Windows host, no macOS runner, no
ARM machine). A test against a fake dependency is not a test against the real one: say which
was used, because the fake can hide exactly the failure the row exists to find.

## Cost

Containers are cheap per run and expensive in aggregate: images are hundreds of megabytes,
and a full matrix on every commit is waste. Run the rows the change can affect, keep the full
matrix for release candidates, and reuse the same base image across rows so the second pull is
free.
