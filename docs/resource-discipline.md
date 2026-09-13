# Resource discipline: running several Pi agents on one machine

Measured on 2026-09-13 on the 16 GB Windows machine this repository targets (pagefile on the
WD SN740 NVMe system disk). Numbers come from `Get-CimInstance Win32_OperatingSystem`,
`Get-Process` working sets and `wsl -d Debian -- free -m`; estimates are marked as such.

## What one session costs

| Item | Measured |
|---|---|
| Pi session, fresh | ~150 MB working set |
| Pi session, mid-work | ~330 MB |
| Pi session, long context | ~750-950 MB |
| Six paned agents plus one long session | 2.7 GB total |
| Windows baseline commit (OS and apps, no agents) | ~11.4 GB |
| WSL2 VM (`vmmemWSL`, Debian idle with guest cache) | ~4 GB |
| `gga`/codex per run | ~100-300 MB (estimate) |
| Docker Desktop with containers | +4-6 GB (earlier pagefile peak: 7.4 GB) |

## Rules

1. **Concurrency cap.** Four to six concurrent Pi sessions is the comfortable range on 16 GB. Ten
   is possible only with short contexts, and the pagefile then carries roughly 10 GB: that costs
   latency, not stability.
2. **Close a pane when its task merges.** Each pane holds ~330 MB; a merged task left open is a
   leak.
3. **Cap the heap of paned agents.** Create their panes with
   `herdr tab create --env NODE_OPTIONS=--max-old-space-size=1024` so one runaway session cannot
   claim several GB. Never set this as a global environment variable: every Node tool on the
   machine inherits it.
4. **Keep Docker stopped while agents work**, or accept the extra ~5 GB.
5. **WSL holds memory by default.** `~/.wslconfig` needs `autoMemoryReclaim=gradual` and an
   explicit `memory=` cap; without them the VM keeps gigabytes of guest cache on a host that is
   out of free RAM. Apply with `wsl --shutdown`.
6. **Pagefile.** 24576 MB initial, 49152 MB maximum, on the NVMe system disk and never on the USB
   volume. It is a safety net for commit charge, not extra RAM.
7. **Memory compression on.** `Enable-MMAgent -MemoryCompression` (with `-PageCombining`)
   restores the Windows default this machine had disabled, so cold pages compress in RAM instead
   of going to disk.

## Measure before believing

```powershell
pwsh -NoProfile -Command '$os=Get-CimInstance Win32_OperatingSystem; "free {0:N2} GB / commit {1:N2} of {2:N2} GB" -f ($os.FreePhysicalMemory/1MB), (($os.TotalVirtualMemorySize-$os.FreeVirtualMemory)/1MB), ($os.TotalVirtualMemorySize/1MB)'
pwsh -NoProfile -Command 'Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 12 Name,Id,@{n="ws_MB";e={[int]($_.WorkingSet64/1MB)}} | Format-Table'
pwsh -NoProfile -Command '$v=Get-Process vmmemWSL -ErrorAction SilentlyContinue; if($v){"vmmemWSL {0:N2} GB" -f ($v.WorkingSet64/1GB)}'
wsl -d Debian -- bash -lc 'free -m | head -2'
```

## Observed in practice

Enabling memory compression and closing one merged pane moved free RAM from 0.88 GB to 2.35 GB
while the commit charge stayed inside the limit (18.7 -> 17.9 GB of 31.65 GB), with the pagefile
peaking at 3.2 GB of its 16 GB allocation. The same machine had earlier peaked at 7.4 GB of
pagefile use with Docker Desktop running and five containers, which is why rule 4 exists.
