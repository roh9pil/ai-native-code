#!/bin/bash
# Production deployment authorization check
echo "Checking production release authorization..."
if [ -z "$RELEASE_APPROVAL" ]; then
  echo "Production deploys need a release authorization." >&2
  exit 2
fi
exit 0