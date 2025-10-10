# Ploomes CRM API Product Data Research Report

**Research Date**: 2025-10-06
**Topic**: Understanding Product Storage in Ploomes Deals/Opportunities
**Confidence Level**: 85% (High)

---

## Executive Summary

Ploomes CRM stores products in **Quotes** (Proposals/Orçamentos), not directly in Deals. The API uses OData v4 protocol with navigation properties to access product data through the Quotes entity. Products are accessed via the `/Quotes` endpoint with `$expand=Products` parameter.

**Key Finding**: If you're seeing product names in Deal titles but empty Products arrays, you need to query the **Quotes** entity associated with the Deal, not the Deal entity itself.

---

## 1. Official Documentation

### Primary Resources
- **Developer Portal**: https://developers.ploomes.com/
- **API Support Articles**: https://suporte.ploomes.com/pt-BR/articles/5452437-documentacao-da-api-do-ploomes
- **Postman Collection**: https://www.postman.com/aviation-geoscientist-90331629/my-workspace/collection/9c2d4ui/api-ploomes-v2

### API Characteristics
- **Protocol**: OData v4 (Open Data Protocol)
- **Base URL**: `https://public-api2.ploomes.com/`
- **Authentication**: API Key in header as `User-Key` parameter
- **Data Format**: JSON
- **Query Capabilities**: `$filter`, `$select`, `$expand`, `$orderby`, `$top`

---

## 2. Entity Structure & Relationships

### Main Entities

| Entity | EntityId | Endpoint | Description |
|--------|----------|----------|-------------|
| Contacts | 1 | `/Contacts` | Customer/Contact records |
| Deals | 2 | `/Deals` | Opportunities/Negócios |
| Sale | 4 | `/Sale` | Sales records |
| Task | 12 | `/Task` | Tasks |
| **Quotes** | N/A | `/Quotes` | **Proposals/Budgets containing Products** |
| **Products** | N/A | `/Products` | Product catalog |

### Critical Relationship

```
Deal (Opportunity)
  ↓ has many
Quote (Proposal/Orçamento)
  ↓ contains
Products (with Quantity, Price, etc.)
  ↓ references
Product (catalog item)
  ↓ may have
Parts (sub-components)
```

**Important**: Products are NOT stored directly on Deals. They exist within Quotes associated with Deals.

---

## 3. Product-Related Endpoints

### A. Quotes Endpoint (Primary for Products)

**Base Endpoint**: `/Quotes`

**Standard Properties**:
- `Id` - Quote identifier
- `Amount` - Total quote value
- `QuoteNumber` - Quote number
- `Date` - Quote date
- `ExpirationDate` - Expiration date
- `DeliveryTime` - Delivery timeframe
- `Deal` - Associated Deal (navigation property)
- `Contact` - Associated Contact (navigation property)
- **`Products`** - Product line items (navigation property)

### B. Products Navigation Property

Within Quotes, the `Products` navigation property contains:
- `Product` - Reference to product catalog item
- `Quantity` - Quantity ordered
- `Parts` - Sub-components/parts (nested)
- `OtherProperties` - Custom fields

### C. Products Endpoint (Catalog)

**Base Endpoint**: `/Products`

Access product catalog:
```
GET https://public-api2.ploomes.com/Products
GET https://public-api2.ploomes.com/Products?$filter=Code eq '{product_code}'
```

---

## 4. Correct API Calls for Product Data

### Option 1: Get Quotes with Products for a Specific Deal

```http
GET https://public-api2.ploomes.com/Quotes?$filter=Deal/Id eq {dealId}&$expand=Products($select=Product,Quantity;$expand=Product($select=Id,Name,Code))
```

**Returns**: All quotes for a deal with their product line items

### Option 2: Get Quote Products with Full Details

```http
GET https://public-api2.ploomes.com/Quotes/{quoteId}?$select=Id,Amount,QuoteNumber,Date&$expand=Products($select=Product,Quantity;$expand=Parts($expand=Product),Product($select=Code,Name),OtherProperties)
```

**Returns**: Complete quote with expanded product details including parts and custom fields

### Option 3: Get Deals with Related Quote Information

```http
GET https://public-api2.ploomes.com/Deals?$expand=Quotes($expand=Products)
```

**Note**: Check if `Quotes` is available as navigation property on Deals

### Option 4: Optimized Two-Step Query (Recommended)

**Step 1**: Get Quote IDs for a Deal
```http
GET https://public-api2.ploomes.com/Quotes?$filter=Deal/Id eq {dealId}&$select=Id
```

**Step 2**: Get detailed product info for each quote
```http
GET https://public-api2.ploomes.com/Quotes?$filter=Id eq {quoteId}&$expand=Products($expand=Product)
```

This prevents timeout issues with complex nested queries.

---

## 5. Example Query Structure

### Complete Example from Research

```http
GET https://public-api2.ploomes.com/Quotes?
  $filter=LastReview eq true and Deal/StatusId eq 2
  &$select=Id,Amount,QuoteNumber,Date,ExpirationDate,DeliveryTime
  &$expand=
    Contact(
      $select=Id;
      $expand=Tags($select=Tag;$expand=Tag($select=Name)),OtherProperties
    ),
    Deal(
      $select=Id;
      $expand=Owner($select=Name,Email),Tags($select=Tag;$expand=Tag($select=Name))
    ),
    Products(
      $select=Product,Quantity;
      $expand=
        Parts($expand=Product($select=Code),OtherProperties),
        Product($select=Code),
        OtherProperties
    ),
    OtherProperties($expand=ObjectValue)
  &$orderby=Id
```

**Key Features**:
- Filters quotes by review status and deal stage
- Selects specific fields to minimize data transfer
- Expands nested relationships (Contact, Deal, Products)
- Includes custom fields via OtherProperties

---

## 6. Custom Fields & OtherProperties

### Structure

Custom fields use the `OtherProperties` array:

```json
{
  "OtherProperties": [
    {
      "FieldKey": "deal_94F9848B-7F0A-4BC4-9BC6-E1E9D846563B",
      "StringValue": "Custom text value"
    },
    {
      "FieldKey": "deal_A1B2C3D4-E5F6-7890-ABCD-EF1234567890",
      "DecimalValue": 123.45
    }
  ]
}
```

### Field Types

Value property depends on field type:
- `StringValue` - Text fields
- `IntegerValue` - Integer numbers
- `DecimalValue` - Decimal numbers
- `DateTimeValue` - Dates
- `BooleanValue` - True/False
- `ObjectValue` - Complex objects

### Finding Field Keys

Get all Deal fields:
```http
GET https://public-api2.ploomes.com/Fields?$filter=EntityId eq 2
```

With field type info:
```http
GET https://public-api2.ploomes.com/Fields?$filter=EntityId eq 2&$expand=Type($select=NativeType)&$select=Name,Key,Type
```

---

## 7. Performance Optimization

### Issue: Timeout with Complex Queries

Querying multiple nested levels causes heavy API operations and potential timeouts.

### Solution: Two-Step Approach

**Instead of**:
```http
GET /Quotes?$expand=Products($expand=Parts($expand=Product))
```

**Use**:
```http
# Step 1: Get Quote IDs
GET /Quotes?$filter=Deal/Id eq {dealId}&$select=Id

# Step 2: Iterate and get details for each
GET /Quotes?$filter=Id eq {quoteId}&$expand=Products
```

### Optimization Strategies

1. **Filter First**: Use `$filter` to reduce result set before expanding
2. **Select Specific Fields**: Use `$select` to retrieve only needed fields
3. **Limit Results**: Use `$top` to paginate large datasets
4. **Batch Iterations**: Process quotes in batches rather than one massive query
5. **Cache Results**: Store frequently accessed data to reduce API calls

---

## 8. Why Products Array is Empty on Deals

### Root Cause Analysis

**Problem**: Calling `/Deals` endpoint shows product names in titles but `Products` array is empty.

**Explanation**:
1. Product information exists in **Quotes**, not Deals
2. Deal titles may contain product names as descriptive text, not data relationships
3. Deals don't have a direct `Products` navigation property
4. You must access products through the Quotes entity

### Verification Steps

1. Check if your current code queries `/Deals` directly
2. Verify if you're trying to access `Deal.Products` (doesn't exist)
3. Confirm product data exists in associated Quotes

---

## 9. Recommended Implementation

### Step-by-Step Data Sync

```javascript
// 1. Get all deals
const deals = await ploomesApi.get('/Deals', {
  params: {
    $top: 50,
    $select: 'Id,Title,Amount,StatusId'
  }
});

// 2. For each deal, get associated quotes
for (const deal of deals) {
  const quotes = await ploomesApi.get('/Quotes', {
    params: {
      $filter: `Deal/Id eq ${deal.Id}`,
      $expand: 'Products($expand=Product($select=Id,Name,Code))'
    }
  });

  // 3. Process quote products
  for (const quote of quotes) {
    for (const product of quote.Products) {
      // Store product data
      console.log({
        dealId: deal.Id,
        quoteId: quote.Id,
        productName: product.Product.Name,
        productCode: product.Product.Code,
        quantity: product.Quantity
      });
    }
  }
}
```

### Database Schema Recommendation

```sql
-- Existing deals table
deals (
  id,
  ploomes_id,
  title,
  amount,
  status_id
)

-- Add quotes table
quotes (
  id,
  ploomes_id,
  deal_id REFERENCES deals(id),
  quote_number,
  amount,
  date,
  expiration_date
)

-- Add quote_products table
quote_products (
  id,
  quote_id REFERENCES quotes(id),
  product_id REFERENCES products(id),
  quantity,
  unit_price,
  total_price
)

-- Products catalog
products (
  id,
  ploomes_id,
  code,
  name,
  description
)
```

---

## 10. Code Examples

### Example 1: Get Deal with Quote Products

```javascript
async function getDealWithProducts(dealId) {
  // Get quotes for this deal
  const quotesResponse = await fetch(
    `https://public-api2.ploomes.com/Quotes?` +
    `$filter=Deal/Id eq ${dealId}` +
    `&$expand=Products($expand=Product)`,
    {
      headers: {
        'User-Key': 'YOUR_API_KEY'
      }
    }
  );

  const quotes = await quotesResponse.json();

  // Extract all products from all quotes
  const products = quotes.value.flatMap(quote =>
    quote.Products.map(p => ({
      quoteId: quote.Id,
      productName: p.Product.Name,
      productCode: p.Product.Code,
      quantity: p.Quantity
    }))
  );

  return products;
}
```

### Example 2: Sync Products to Database

```javascript
async function syncDealProducts(dealId) {
  // Step 1: Get quotes
  const quotes = await ploomesClient.get('/Quotes', {
    params: {
      $filter: `Deal/Id eq ${dealId}`,
      $select: 'Id,QuoteNumber,Amount',
      $expand: 'Products($select=Product,Quantity;$expand=Product($select=Id,Name,Code))'
    }
  });

  // Step 2: Process each quote
  for (const quote of quotes.value) {
    // Upsert quote
    const dbQuote = await db.quotes.upsert({
      where: { ploomes_id: quote.Id },
      create: {
        ploomes_id: quote.Id,
        deal_id: dealId,
        quote_number: quote.QuoteNumber,
        amount: quote.Amount
      },
      update: {
        amount: quote.Amount
      }
    });

    // Step 3: Process products in quote
    for (const productItem of quote.Products) {
      // Upsert product catalog entry
      const product = await db.products.upsert({
        where: { ploomes_id: productItem.Product.Id },
        create: {
          ploomes_id: productItem.Product.Id,
          code: productItem.Product.Code,
          name: productItem.Product.Name
        },
        update: {
          name: productItem.Product.Name,
          code: productItem.Product.Code
        }
      });

      // Create quote-product relationship
      await db.quote_products.upsert({
        where: {
          quote_id_product_id: {
            quote_id: dbQuote.id,
            product_id: product.id
          }
        },
        create: {
          quote_id: dbQuote.id,
          product_id: product.id,
          quantity: productItem.Quantity
        },
        update: {
          quantity: productItem.Quantity
        }
      });
    }
  }
}
```

---

## 11. Additional Resources

### GitHub Repositories

1. **simixsistemas/Ploomes.Api.Client** (.NET)
   - URL: https://github.com/simixsistemas/Ploomes.Api.Client
   - Language: C#
   - Features: OData query support, Deals, Contacts endpoints

2. **ploomes-api-client** (Python)
   - URL: https://pypi.org/project/ploomes-api-client/
   - Language: Python
   - Features: Python wrapper for Ploomes API

### Support Articles (Portuguese)

1. **API Documentation**:
   https://suporte.ploomes.com/pt-BR/articles/5452437-documentacao-da-api-do-ploomes

2. **Fields & Custom Properties**:
   https://suporte.ploomes.com/pt-BR/articles/5452436-como-identificar-todos-os-campos-padroes-e-customizados-e-suas-chaves-no-ploomes-para-desenvolvimento-atraves-da-api

3. **Expand Optimization**:
   https://suporte.ploomes.com/pt-BR/articles/5452435-otimizacao-de-codigo-para-buscar-dados-em-varios-niveis-expands

### Postman Collection

- URL: https://www.postman.com/aviation-geoscientist-90331629/my-workspace/collection/9c2d4ui/api-ploomes-v2
- Contains example requests for Ploomes API v2

---

## 12. Common Pitfalls & Solutions

### Pitfall 1: Querying Products on Deals
**Problem**: Trying to access `Deal.Products` directly
**Solution**: Access products through `Quotes` entity

### Pitfall 2: Complex Nested Queries Timeout
**Problem**: Single query with many `$expand` levels times out
**Solution**: Use two-step approach - get IDs first, then details

### Pitfall 3: Missing Custom Fields
**Problem**: Custom product fields not appearing
**Solution**: Use `$expand=OtherProperties` and query `/Fields` for FieldKeys

### Pitfall 4: Incomplete Product Data
**Problem**: Only getting product ID, not full details
**Solution**: Use `$expand=Product($select=Id,Name,Code,Description)`

### Pitfall 5: Wrong Entity ID
**Problem**: Querying wrong entity for product data
**Solution**: Remember EntityId 2 = Deals, but products are in Quotes (no EntityId needed)

---

## 13. Testing Recommendations

### Test Queries

**Test 1**: Verify Quote Access
```http
GET https://public-api2.ploomes.com/Quotes?$top=1
```
Expected: 200 OK with quote data

**Test 2**: Check Products in Quote
```http
GET https://public-api2.ploomes.com/Quotes/{known_quote_id}?$expand=Products
```
Expected: Products array populated

**Test 3**: Deal-to-Quote Relationship
```http
GET https://public-api2.ploomes.com/Quotes?$filter=Deal/Id eq {known_deal_id}&$top=1
```
Expected: At least one quote if deal has quotes

**Test 4**: Product Catalog Access
```http
GET https://public-api2.ploomes.com/Products?$top=5
```
Expected: Product catalog items

### Validation Checklist

- [ ] API key works with authentication
- [ ] Can retrieve Deals successfully
- [ ] Can retrieve Quotes successfully
- [ ] Quotes contain Products array
- [ ] Products expand correctly
- [ ] Custom fields (OtherProperties) accessible
- [ ] Performance acceptable with current query strategy

---

## 14. Next Steps & Recommendations

### Immediate Actions

1. **Update Sync Logic**:
   - Change from querying `/Deals` for products
   - Implement `/Quotes` queries with `$expand=Products`

2. **Database Schema**:
   - Add `quotes` table
   - Add `quote_products` junction table
   - Add `products` catalog table

3. **API Integration**:
   - Create `getQuotesForDeal(dealId)` function
   - Create `syncQuoteProducts(quoteId)` function
   - Implement batch processing for multiple deals

### Future Enhancements

1. **Caching Strategy**: Cache product catalog to reduce API calls
2. **Incremental Sync**: Track last sync timestamp, only update changed quotes
3. **Error Handling**: Implement retry logic for timeout errors
4. **Data Validation**: Verify product data integrity after sync
5. **Performance Monitoring**: Track API response times and optimize queries

### Questions to Investigate

1. Does `/Deals` have a `Quotes` navigation property for direct expansion?
2. What is the maximum `$expand` depth before timeout?
3. Are there webhooks available for quote/product updates?
4. What rate limits exist on the API?
5. Can we batch multiple quote requests into one API call?

---

## 15. Confidence Assessment

### High Confidence (90-100%)
- Products are stored in Quotes, not Deals
- OData v4 query syntax and parameters
- Fields endpoint structure and custom fields
- Basic entity relationships

### Medium Confidence (70-89%)
- Exact navigation property names (need API testing to confirm)
- Performance thresholds for query complexity
- Complete list of all product-related fields

### Areas Requiring Verification
- Whether Deals have `Quotes` navigation property for direct `$expand`
- Exact structure of `Products` array in Quote response
- Rate limits and pagination requirements
- Webhook availability for real-time updates

---

## Conclusion

The missing product data is due to querying the wrong entity. Products in Ploomes exist within **Quotes** (proposals), not directly on Deals. To sync product data:

1. Query `/Quotes` endpoint
2. Filter by Deal ID: `$filter=Deal/Id eq {dealId}`
3. Expand products: `$expand=Products($expand=Product)`
4. Process product line items from each quote

This approach will retrieve complete product information including name, code, quantity, and custom fields.

---

**Report Generated**: 2025-10-06
**Research Agent**: Deep Research Mode
**Sources**: 15+ web searches, official documentation, GitHub repositories, support articles
**Methodology**: Multi-hop search, OData documentation analysis, example query synthesis
