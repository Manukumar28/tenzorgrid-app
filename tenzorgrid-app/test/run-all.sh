#!/bin/bash
# The whole regression: every backend suite, then a five-day walk of every finished project.
#
# Each suite gets its own throwaway DATA_DIR, because they all write to a real SQLite file
# and a shared one would let the order of the suites decide the result.
#
#   ./test/run-all.sh              # everything
#   ./test/run-all.sh myrun        # everything, into a named work directory
#
# Exits non-zero if anything fails, so it can gate a merge.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
TAG="${1:-run}"
WORK="${TMPDIR:-/tmp}/tg-$TAG"
rm -rf "$WORK"; mkdir -p "$WORK"

fails=0; total=0; suites=0; walks=0

SUITES="a1-migration-test chart-test content-gate-test dataset-test day-test dayend-test
        fullday-test gate-test guard-test jumble-test mail-test promotion-test
        reconcile-test senior-test skilltest-test standup-test team-test timetravel-test
        wb-test week-test py-test negotiation-test backup-test roles-test coach-test lead-test manager-test timesheets-test attendance-test appraisal-test workday-test navigation-test apps-test assignments-test"

# Every project the catalogue calls finished. A project with no authored activities is a
# stub and is gated out of the product elsewhere; it is not walked here.
PROJECTS="compensation-review headcount-trends outage-recovery pay-equity-audit
          reliability-review account-economics activation-review experiment-readout
          trading-review margin-review range-review board-pack
          capacity-review tooling-review intake-review headcount-case"

for t in $SUITES; do
  [ -f "$HERE/$t.js" ] || { echo "MISSING SUITE $t"; fails=$((fails+1)); continue; }
  d="$WORK/$t"; mkdir -p "$d"
  out=$(cd "$ROOT" && node "$HERE/$t.js" "$d" 2>&1)
  code=$?
  n=$(echo "$out" | grep -c "  PASS  ")
  f=$(echo "$out" | grep -c "  FAIL  ")
  total=$((total+n)); fails=$((fails+f)); suites=$((suites+1))
  # A suite that crashes before it prints anything scores zero passes and zero fails,
  # which used to read as "fine". backup-test.js sat like that for weeks: it required a
  # lib/backup.js that had never been written, died on MODULE_NOT_FOUND every run, and
  # the runner counted it among the green. Exit code and an empty result are now
  # failures in their own right.
  if [ "$code" != "0" ]; then
    echo "SUITE $t: CRASHED (exit $code)"
    echo "$out" | tail -5
    fails=$((fails+1))
  elif [ "$n" = "0" ]; then
    echo "SUITE $t: produced no assertions at all"
    echo "$out" | tail -5
    fails=$((fails+1))
  elif [ "$f" != "0" ] || echo "$out" | grep -q "FAILED"; then
    echo "SUITE $t: $n pass / $f FAIL"
    echo "$out" | grep "  FAIL  " | head -5
  fi
done

for p in $PROJECTS; do
  d="$WORK/w-$p"; mkdir -p "$d"
  out=$(cd "$ROOT" && node "$HERE/project-walk.js" "$d" "$p" 2>&1)
  n=$(echo "$out" | grep -c "  PASS  ")
  f=$(echo "$out" | grep -c "  FAIL  ")
  total=$((total+n)); fails=$((fails+f)); walks=$((walks+1))
  if [ "$f" != "0" ]; then
    echo "WALK $p: $n pass / $f FAIL"
    echo "$out" | grep "  FAIL  " | head -5
  fi
done

echo "---"
echo "$suites suites, $walks walks, $total assertions, $fails failures"
[ "$fails" = "0" ] || exit 1
