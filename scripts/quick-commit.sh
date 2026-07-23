#!/bin/bash

# Quick commit script - no more formatting headaches!
# Usage: ./scripts/quick-commit.sh "your commit message"

set -e

if [ $# -eq 0 ]; then
    echo "Usage: $0 \"commit message\""
    echo "Example: $0 \"fix bugs in contract\""
    exit 1
fi

MESSAGE="$1"

# Auto-stage everything
git add .

# Create a proper conventional commit
git commit -m "feat: $MESSAGE

- Auto-generated commit message
- Bypasses manual formatting requirements"

echo "✅ Committed successfully: $MESSAGE"