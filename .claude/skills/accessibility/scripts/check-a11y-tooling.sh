#!/usr/bin/env bash
# Detect the project's stack and existing accessibility tooling so we reuse
# what's installed instead of adding new dependencies.
# Usage: check-a11y-tooling.sh [project-root]   (default: nearest package.json upward from cwd)
set -uo pipefail

root="${1:-}"
if [ -z "$root" ]; then
  dir="$PWD"
  while [ "$dir" != "/" ] && [ ! -f "$dir/package.json" ]; do dir="$(dirname "$dir")"; done
  root="$dir"
fi

if [ ! -f "$root/package.json" ]; then
  echo "No package.json found at or above ${1:-$PWD} — pass the project root explicitly." >&2
  exit 1
fi

echo "Project root: $root"
echo

# Collect every package.json in the workspace (excluding node_modules) so
# monorepos are covered.
manifests=$(find "$root" -name package.json -not -path '*/node_modules/*' 2>/dev/null)

has_dep() {
  # Matches the package name as a JSON key in any manifest.
  local m
  for m in $manifests; do
    if grep -q "\"$1\"" "$m" 2>/dev/null; then
      echo "$m"
      return 0
    fi
  done
  return 1
}

report() { # report <label> <package>
  local found
  found=$(has_dep "$2") || found=""
  if [ -n "$found" ]; then
    printf '  [x] %-28s (%s)\n' "$1" "${found#"$root"/}"
  else
    printf '  [ ] %-28s\n' "$1"
  fi
}

echo "Stack:"
for pkg in next vite expo react-native react vue svelte astro; do
  if found=$(has_dep "$pkg"); then
    printf '  - %-14s (%s)\n' "$pkg" "${found#"$root"/}"
  fi
done
echo

echo "Layer 1 — static / dev-time:"
report "eslint-plugin-jsx-a11y" "eslint-plugin-jsx-a11y"
report "eslint-config-next (includes jsx-a11y)" "eslint-config-next"
report "@axe-core/react (dev console)" "@axe-core/react"
echo

echo "Layer 2 — automated browser tests:"
report "@axe-core/playwright" "@axe-core/playwright"
report "playwright" "@playwright/test"
report "vitest-axe" "vitest-axe"
report "jest-axe" "jest-axe"
report "vitest" "vitest"
report "jest" "jest"
report "@testing-library/react" "@testing-library/react"
echo

echo "Accessible component primitives:"
report "radix-ui" "@radix-ui/react-dialog"
report "react-aria" "react-aria"
report "headlessui" "@headlessui/react"
echo

echo "Next: map gaps to docs/accessibility/ACCESSIBILITY_TESTING.md 'Selecting"
echo "the testing stack'. Reuse installed runners; add only maintained packages;"
echo "no paid/recurring service without Jesse's explicit approval."
