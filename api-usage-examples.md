# PLOMES Route Optimizer API - Usage Examples

## Authentication Setup

### 1. Login and Get Token

```bash
# Login to get JWT token
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "gustavo.canuto@ciaramaquinas.com.br",
    "password": "ciara123@"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "gustavo.canuto@ciaramaquinas.com.br",
    "name": "Gustavo Canuto",
    "lastLogin": "2025-09-24T23:15:41.498Z"
  }
}
```

### 2. Set Environment Variable

```bash
# Store token in environment variable
export TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Or use in subsequent requests
TOKEN="your-jwt-token-here"
```

## Health Check Endpoints

### System Health
```bash
curl http://localhost:3001/api/health
```

### Ploome Connection Test
```bash
curl http://localhost:3001/api/test-connection
```

## Customer Management

### Get All Customers (Paginated)
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/customers?limit=10&offset=0"
```

### Get Customers by City
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/customers?city=FORTALEZA&limit=50"
```

### Sync Customers from Ploome
```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/api/sync/customers
```

## Statistics and Analytics

### Get System Statistics
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/api/statistics
```

## Geocoding Services

### Geocode Single Address (Public Endpoint)
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"address": "Rua das Flores, 123, São Paulo, SP"}' \
  http://localhost:3001/api/geocode/address
```

### Batch Geocoding (Protected)
```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "addresses": [
      "Rua A, 100, Fortaleza, CE",
      "Avenida B, 200, São Paulo, SP",
      "Rua C, 300, Rio de Janeiro, RJ"
    ]
  }' \
  http://localhost:3001/api/geocode/batch
```

## Route Optimization

### Optimize Route for Customers
```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customerIds": ["401245927", "401245923", "401763194"],
    "startLocation": {
      "latitude": -3.7319,
      "longitude": -38.5267
    }
  }' \
  http://localhost:3001/api/routes/optimize
```

## JavaScript SDK Examples

### Basic Setup
```javascript
class PlomesAPI {
  constructor(baseURL = 'http://localhost:3001') {
    this.baseURL = baseURL;
    this.token = null;
  }

  async login(email, password) {
    const response = await fetch(`${this.baseURL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();
    if (data.success) {
      this.token = data.token;
    }
    return data;
  }

  async getCustomers(limit = 50, city = null) {
    const params = new URLSearchParams({ limit });
    if (city) params.append('city', city);

    const response = await fetch(`${this.baseURL}/api/customers?${params}`, {
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });

    return response.json();
  }

  async syncCustomers() {
    const response = await fetch(`${this.baseURL}/api/sync/customers`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });

    return response.json();
  }

  async getStatistics() {
    const response = await fetch(`${this.baseURL}/api/statistics`, {
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });

    return response.json();
  }

  async geocodeAddress(address) {
    const response = await fetch(`${this.baseURL}/api/geocode/address`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ address })
    });

    return response.json();
  }
}
```

### Usage Example
```javascript
async function main() {
  const api = new PlomesAPI();

  // Login
  await api.login('gustavo.canuto@ciaramaquinas.com.br', 'ciara123@');

  // Get customers from Fortaleza
  const customers = await api.getCustomers(10, 'FORTALEZA');
  console.log(`Found ${customers.count} customers in Fortaleza`);

  // Get system statistics
  const stats = await api.getStatistics();
  console.log('System Stats:', stats.statistics);

  // Sync customers from Ploome
  const syncResult = await api.syncCustomers();
  console.log('Sync Result:', syncResult.message);
}

main().catch(console.error);
```

## Python SDK Example

```python
import requests
import json

class PlomesAPI:
    def __init__(self, base_url='http://localhost:3001'):
        self.base_url = base_url
        self.token = None

    def login(self, email, password):
        response = requests.post(f'{self.base_url}/api/auth/login',
            json={'email': email, 'password': password})
        data = response.json()
        if data.get('success'):
            self.token = data['token']
        return data

    def get_headers(self):
        return {'Authorization': f'Bearer {self.token}'}

    def get_customers(self, limit=50, city=None):
        params = {'limit': limit}
        if city:
            params['city'] = city

        response = requests.get(f'{self.base_url}/api/customers',
            params=params, headers=self.get_headers())
        return response.json()

    def sync_customers(self):
        response = requests.post(f'{self.base_url}/api/sync/customers',
            headers=self.get_headers())
        return response.json()

    def get_statistics(self):
        response = requests.get(f'{self.base_url}/api/statistics',
            headers=self.get_headers())
        return response.json()

    def geocode_address(self, address):
        response = requests.post(f'{self.base_url}/api/geocode/address',
            json={'address': address})
        return response.json()

# Usage
api = PlomesAPI()
api.login('gustavo.canuto@ciaramaquinas.com.br', 'ciara123@')

# Get customers
customers = api.get_customers(limit=10, city='FORTALEZA')
print(f"Found {customers['count']} customers")

# Get statistics
stats = api.get_statistics()
print("System statistics:", stats['statistics'])
```

## Error Handling

### Common Error Responses

#### Authentication Error (401)
```json
{
  "success": false,
  "error": "Unauthorized",
  "message": "Invalid or expired token"
}
```

#### Validation Error (400)
```json
{
  "success": false,
  "error": "Validation failed",
  "message": "Required fields missing"
}
```

#### Server Error (500)
```json
{
  "success": false,
  "error": "Internal server error",
  "message": "Database connection failed"
}
```

### Error Handling in JavaScript
```javascript
async function handleApiCall(apiFunction) {
  try {
    const result = await apiFunction();

    if (!result.success) {
      throw new Error(result.error || result.message);
    }

    return result;
  } catch (error) {
    console.error('API Error:', error.message);
    throw error;
  }
}

// Usage
try {
  const customers = await handleApiCall(() => api.getCustomers());
  console.log('Customers loaded:', customers.count);
} catch (error) {
  console.error('Failed to load customers:', error.message);
}
```

## Testing with Postman

### 1. Import Collection
Create a Postman collection with the following requests:

### 2. Environment Variables
Set up these Postman environment variables:
- `base_url`: `http://localhost:3001`
- `token`: Will be set automatically after login

### 3. Login Request Setup
- **Method**: POST
- **URL**: `{{base_url}}/api/auth/login`
- **Body** (JSON):
```json
{
  "email": "gustavo.canuto@ciaramaquinas.com.br",
  "password": "ciara123@"
}
```
- **Test Script** (to auto-set token):
```javascript
if (pm.response.json().success) {
  pm.environment.set("token", pm.response.json().token);
}
```

### 4. Protected Request Setup
For all protected endpoints, add to **Headers**:
- `Authorization`: `Bearer {{token}}`

## Rate Limiting & Best Practices

### Request Limits
- **Customer Sync**: Max 1 request per minute (due to Ploome API limits)
- **Geocoding**: Max 100 addresses per batch request
- **Statistics**: No specific limits

### Best Practices
1. **Always check token expiry** - Tokens expire after 7 days
2. **Handle errors gracefully** - Implement retry logic for temporary failures
3. **Cache customer data** - Don't sync frequently, use local storage
4. **Batch operations** - Use batch geocoding instead of individual requests
5. **Monitor quotas** - Keep track of Ploome and geocoding API usage

## Live Data Information

### Current Database Status (as of testing)
- **Total Customers**: 2,246 active customers
- **Geocoded**: 2,177 customers have coordinates
- **Pending Geocoding**: 10 customers awaiting geocoding
- **Routes Created**: 32 optimized routes stored
- **Last Sync**: September 24, 2025 - successful sync from Ploome

### Data Sources
- **Primary**: Supabase PostgreSQL database (persistent)
- **Sync Source**: Ploome CRM API (live integration)
- **Geocoding**: Multiple providers (Google Maps, OpenCage, etc.)
- **Route Optimization**: OpenRouteService API