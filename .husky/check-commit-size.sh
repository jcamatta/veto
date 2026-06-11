#!/usr/bin/env bash
# Enforce a commit size budget so changes stay small and reviewable.

# Merge commits aggregate changes that were already budgeted commit by
# commit on their own branches — skip them.
GIT_DIR_PATH=$(git rev-parse --git-dir)
if [ -f "$GIT_DIR_PATH/MERGE_HEAD" ]; then
  exit 0
fi

MAX_WEIGHTED_LINES=300
MAX_SOURCE_FILES=15
MIN_LINES_REQUIRING_TESTS=30

is_excluded() {
  case "$1" in
    *.lock|package-lock.json|pnpm-lock.yaml|yarn.lock) return 0 ;;
    *.snap|*generated*|dist/*|build/*|out/*) return 0 ;;
    .husky/*) return 0 ;;
    *.md) return 0 ;;
  esac
  return 1
}

is_test() {
  case "$1" in
    *.test.*|*.spec.*|*__tests__*|test/*|tests/*|*.e2e.*|e2e/*) return 0 ;;
  esac
  return 1
}

weighted=0
source_files=0
test_lines=0

while IFS=$'\t' read -r added deleted file; do
  [ "$added" = "-" ] && continue # binary
  is_excluded "$file" && continue
  lines=$((added + deleted))
  if is_test "$file"; then
    test_lines=$((test_lines + lines))
  else
    weighted=$((weighted + lines))
    source_files=$((source_files + 1))
  fi
done < <(git diff --cached --numstat)

fail=0
if [ "$weighted" -gt "$MAX_WEIGHTED_LINES" ]; then
  echo "✖ Commit too large: $weighted source lines (max $MAX_WEIGHTED_LINES). Split it."
  fail=1
fi
if [ "$source_files" -gt "$MAX_SOURCE_FILES" ]; then
  echo "✖ Too many source files: $source_files (max $MAX_SOURCE_FILES)."
  fail=1
fi
if [ "$weighted" -gt "$MIN_LINES_REQUIRING_TESTS" ] && [ "$test_lines" -eq 0 ]; then
  echo "✖ $weighted source lines changed with no test changes. Add/update tests or split."
  fail=1
fi

exit $fail
