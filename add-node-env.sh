#!/bin/bash

# Railway project configuration
PROJECT_ID="799c5228-83f4-4c93-ba9e-9794f1f169be"
SERVICE_ID="f2b3dfb0-c206-4405-9317-53dffad8bf4c"
ENV_ID="b6eb9d54-a8be-4bef-a582-a1297567a074"
TOKEN="6e7bb63a-2d95-42c8-bf56-7f33fed3a868"

echo "Setting NODE_ENV=production on Railway..."

curl -s -X POST \
  https://backboard.railway.app/graphql/v2 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"query\": \"mutation { variableUpsert(input: { projectId: \\\"$PROJECT_ID\\\", environmentId: \\\"$ENV_ID\\\", serviceId: \\\"$SERVICE_ID\\\", name: \\\"NODE_ENV\\\", value: \\\"production\\\" }) { id } }\"
  }"

echo ""
echo "✅ NODE_ENV set to production!"