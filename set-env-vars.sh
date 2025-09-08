#!/bin/bash

# Railway project configuration
PROJECT_ID="799c5228-83f4-4c93-ba9e-9794f1f169be"
SERVICE_ID="f2b3dfb0-c206-4405-9317-53dffad8bf4c"
ENV_ID="b6eb9d54-a8be-4bef-a582-a1297567a074"
TOKEN="6e7bb63a-2d95-42c8-bf56-7f33fed3a868"

# Function to set environment variable
set_env_var() {
    local key=$1
    local value=$2
    
    echo "Setting $key..."
    curl -s -X POST \
      https://backboard.railway.app/graphql/v2 \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"query\": \"mutation { variableUpsert(input: { projectId: \\\"$PROJECT_ID\\\", environmentId: \\\"$ENV_ID\\\", serviceId: \\\"$SERVICE_ID\\\", name: \\\"$key\\\", value: \\\"$value\\\" }) { id } }\"
      }" > /dev/null
    
    if [ $? -eq 0 ]; then
        echo "✓ $key set successfully"
    else
        echo "✗ Failed to set $key"
    fi
}

# Set all environment variables
echo "Setting environment variables for Railway deployment..."

set_env_var "PLOOME_API_KEY" "A7EEF49A41433800AFDF42AE5BBF22755D1FC4B863C9B70A87F4CE300F38164058CD54A3E8590E78CDBF986FC8C0F9F4E7FF32884F3D37D58178DD8749EFA1D3"
set_env_var "PLOOME_API_URL" "https://public-api2.ploomes.com"
set_env_var "NODE_ENV" "production"
set_env_var "DATABASE_PATH" "./backend/cache/customers.db"
set_env_var "JWT_SECRET" "your-super-secret-jwt-key-please-change-this-in-production"
set_env_var "JWT_EXPIRES_IN" "7d"
set_env_var "API_RATE_LIMIT_PER_MINUTE" "120"
set_env_var "GEOCODING_DELAY_MS" "1000"
set_env_var "CACHE_TTL_CUSTOMERS" "86400"
set_env_var "CACHE_TTL_GEOCODING" "2592000"
set_env_var "CACHE_TTL_ROUTES" "3600"
set_env_var "GOOGLE_MAPS_API_KEY" "AIzaSyBKyuYzhwmPsk0tEk2N4qnELPFV-7nuvHk"
set_env_var "POSITIONSTACK_API_KEY" "af855cf79ef4194561e7ee8faf3f9dc4"
set_env_var "PORT" "3001"

echo ""
echo "All environment variables have been set!"
echo "Project ID: $PROJECT_ID"
echo "Service ID: $SERVICE_ID"
echo "Environment ID: $ENV_ID"