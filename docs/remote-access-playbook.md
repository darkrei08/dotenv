# Remote access playbook

How to reach a remote host from this workstation, run something on it, and get
the result back without leaking credentials or hanging on a prompt. Every
pattern here was exercised against `herdr-01` (Debian 13 LXC, `192.168.87.7`)
on 2026-11-08.

## Key and option conventions

```bash
K=/root/.ssh/id_ed25519
O="-i $K -o BatchMode=yes -o IdentitiesOnly=yes"
ssh $O dev@192.168.87.7 'id'
```

- `BatchMode=yes` fails immediately instead of hanging on a password or a
  passphrase prompt. A non-interactive agent must never wait on stdin.
- `IdentitiesOnly=yes` stops the agent from offering every loaded key; the
  server's `MaxAuthTries` then rejects before the right key is tried.
- The same key is authorized for both `dev` and `root` on `herdr-01`. Prefer
  `dev` and escalate with `sudo`; use `root` only for work `dev` cannot do,
  such as writing `/etc/sudoers.d`.
- `ConnectTimeout=8` keeps a dead host from stalling a batch.

## Passwordless sudo (only when a run needs it)

A non-interactive `ssh` run with `sudo` fails with:

```
sudo: a terminal is required to read the password; either use the -S option to
read the password from standard input or configure an askpass helper
sudo: a password is required
```

Grant it from `root`, one file, one line:

```bash
ssh $O root@192.168.87.7 "umask 022 \
  && printf '%s\n' 'dev ALL=(ALL) NOPASSWD: ALL' > /etc/sudoers.d/dev \
  && chmod 0440 /etc/sudoers.d/dev \
  && visudo -c -f /etc/sudoers.d/dev"
```

```bash
ssh $O dev@192.168.87.7 'sudo -n true && sudo -n whoami'
```

Rules:

- `chmod 0440` or `sudo` refuses to load the file. A world-writable fragment is
  silently ignored, which looks like "my rule does nothing".
- `visudo -c -f <file>` validates that one fragment; `visudo -c` validates the
  whole include chain. Run the whole-file check after creating a new fragment.
- `sudo -n` is the proof. `sudo -n true` exiting 0 means no password is needed.
- `NOPASSWD: ALL` is the broadest grant that exists. It is persistent, it
  survives reboots, and it applies to every command. Narrow it when the target
  commands are known, e.g.
  `dev ALL=(ALL) NOPASSWD: /usr/bin/apt-get, /usr/bin/nala`. Delete the fragment
  when the test is over: `rm /etc/sudoers.d/dev`.

## Forwarding a token without leaking it

Never put a credential in the command line. It lands in `argv` (readable by
every local process through `/proc`), in shell history, and in any harness or
CI log that echoes the command.

```bash
umask 077
gh auth token > /tmp/.ghtok
scp $O /tmp/.ghtok dev@192.168.87.7:/tmp/.ghtok
rm -f /tmp/.ghtok
```

The variable is read on the remote side, inside the remote session:

```bash
ssh $O dev@192.168.87.7 '
  trap "rm -f /tmp/.ghtok" EXIT
  cd /tmp/package || exit 90
  GITHUB_TOKEN=$(cat /tmp/.ghtok) node bin/setup-ai.mjs --only base,node,pi > /tmp/run.log 2>&1
  rc=$?
  echo "LXC_EXIT=$rc"
  exit "$rc"
'
```

- `ssh -o SendEnv=GITHUB_TOKEN` is not an option: the server must accept the
  variable in `AcceptEnv`, and default `sshd_config` does not.
- Redirect the remote command's output to a file on the remote host, then read
  the exit code with `rc=$?` in the same remote shell and finish with
  `exit "$rc"`. Without that final `exit`, the trailing `echo` becomes the last
  command, the remote shell returns 0, and `ssh` reports success for a failed
  run.
- Scan for leakage with counts, never with content: `grep -c 'gho_' <log>`. A
  `grep -o` on a token pattern prints the secret.
- Remove the staging file inside the same remote invocation, and do it with
  `trap "rm -f /tmp/.ghtok" EXIT` as the first remote statement: a trailing `rm`
  is skipped by any early `exit` or a failing `cd`, leaving the credential on
  disk.

## Long runs: one pane, one sentinel, then read the log

A multi-minute remote install outlives a single foreground tool call. Drive it
from a pane and block on a sentinel the run prints at the end.

```bash
herdr pane run wEY:p8 'bash /tmp/lxc-run.sh'
herdr pane wait-output --match LXC_RUN_DONE --source recent --timeout 900000 wEY:p8
```

- `wait-output` takes the sentinel as a flag (`--match <TEXT>` or
  `--regex <PATTERN>`) with the pane id as the positional argument; a bare
  sentinel word is rejected with `unexpected argument`.
- The script must end with `echo <sentinel>` on its own line, after capturing
  the exit code with `rc=$?`. The sentinel proves the run finished, not that it
  succeeded, and the wrapper deliberately exits 0 because the pane matches text,
  not status: read the log, or the printed `rc`, for the verdict.
- `scp` the remote log back and keep the remote copy as the primary artifact.

## Port forwarding

Local port to a service listening on the remote loopback:

```bash
ssh $O -f -N -L 18099:127.0.0.1:18099 dev@192.168.87.7
curl -s -o /dev/null -w 'http_code=%{http_code}\n' http://127.0.0.1:18099/
```

- `-f -N` backgrounds the tunnel with no command. It is a foreground-less
  daemon: nothing stops it when the local session ends, so kill it explicitly.
- Forwarding to `127.0.0.1` on the remote side requires the service to bind the
  loopback, not just a LAN interface (`--bind 127.0.0.1` for `python3 -m
  http.server`, `bind-address` for MySQL, and so on).
- Reverse direction, for exposing a local service to the remote host, is
  `-R 8080:127.0.0.1:3000`. It needs `AllowTcpForwarding` (default on) and, with
  `GatewayPorts`, an explicit bind address.
- Other useful forms: `-L 5433:db.internal:5432` tunnels through the remote host
  to a third machine it can reach; `-D 1080` gives a SOCKS proxy without root.

## Pitfalls that cost real time

- **A non-login SSH shell has a short `PATH`.** `~/.local/bin` and nvm's shims
  are added by `~/.bashrc`, which a non-interactive `ssh host 'cmd'` does not
  read. An install lands and looks missing:
  `ssh host 'command -v pi'` prints nothing, while
  `ssh host 'bash -lc "command -v pi; pi --version"'` resolves it. Always
  verify installed CLIs with a login shell.
- **`pkill -f <pattern>` matches its own `bash -c` wrapper.** The wrapper's
  command line contains the pattern, so `pkill` kills the shell running it: exit
  `143` for a plain `pkill`, `255` for an `ssh`-wrapped one. Use a bracket
  pattern (`pkill -f 'pytho[n]3 -m http.server'`), or kill by the pid you
  already have.
- **The local harness blocks pipes into `head`/`tail`.** Redirect to a file and
  read it, or the guard fails the command before it runs.
- Two `visudo` checks are not the same: `-c -f <file>` for one fragment, `-c`
  for the whole chain.

## Verification used for this playbook

- `dev` NOPASSWD grant: `sudo -n whoami` -> `root`; `visudo -c` -> all fragments
  parsed OK.
- Token forwarding: `setup-ai --only base,node,pi` on the LXC, `LXC_EXIT=0`,
  `steps_installed=13 steps_verified=11 steps_failed=0`; `/tmp/.ghtok` gone
  afterwards and `grep -c 'gho_'` = 0 in the run log.
- Tunnel: local `curl` through `-L 18099` returned `http_code=200` with the
  remote directory listing; both the tunnel and the listener removed after.
