#!/usr/bin/env bash
# Commits must come from a Conventional Branch (https://conventionalbranch.org), never from main.

# Merging a finished branch into main is how work lands; let merge commits through.
if git rev-parse -q --verify MERGE_HEAD >/dev/null; then
  exit 0
fi

branch="$(git symbolic-ref --quiet --short HEAD)"

if [ -z "$branch" ]; then
  echo "✖ Detached HEAD. Commit from a conventional branch (e.g. feature/add-login)."
  exit 1
fi

if [ "$branch" = "main" ]; then
  echo "✖ Direct commits to main are not allowed."
  echo "  Create a branch first: git switch -c feat/<description>"
  exit 1
fi

pattern='^(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test)/[a-z0-9]+([.-][a-z0-9]+)*$'
if ! printf '%s\n' "$branch" | grep -Eq "$pattern"; then
  echo "✖ Branch '$branch' does not follow the Conventional Branch spec."
  echo "  Expected <type>/<description> with type in build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test"
  echo "  (the same types as Conventional Commits — feat not feature, fix not bugfix)"
  echo "  and a lowercase a-z0-9 description with single hyphens (dots allowed for versions)."
  exit 1
fi
