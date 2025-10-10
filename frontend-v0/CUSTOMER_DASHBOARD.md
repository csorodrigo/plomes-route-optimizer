# Customer Drill-Down Dashboard

Complete customer analytics dashboard with three-level drill-down functionality.

## 📁 File Structure

```
src/app/dashboard/customers/
├── page.tsx                          # Customer list with search
├── [id]/
│   ├── page.tsx                      # Customer detail page
│   └── pricing-modal.tsx             # Pricing history modal
```

## 🎯 Features Implemented

### 1. Customer List (`/dashboard/customers`)
- **Search functionality**: Filter by name, CNPJ, or email
- **Responsive table** with columns:
  - Customer Name (always visible)
  - CNPJ (always visible)
  - Email (hidden on mobile)
  - City/State (hidden on mobile/tablet)
  - Total Sales Count (always visible)
- **Click to drill-down**: Click any row to view customer details
- **Loading states**: Skeleton loaders while fetching
- **Error handling**: User-friendly error messages
- **Empty states**: Clear messaging when no data

### 2. Customer Detail (`/dashboard/customers/[id]`)
- **Customer header** with contact information
- **Three metric cards**:
  - Total Revenue (R$)
  - Total Sales Count
  - Average Deal Value
- **Sales history table**:
  - Date (formatted as DD/MM/YYYY)
  - Deal ID
  - Products (shows first 2, then "+ X more")
  - Total Value (formatted as R$ 1.234,56)
- **Products summary table**:
  - Product Name
  - Category (hidden on mobile)
  - Total Quantity Sold
  - Total Revenue (hidden on mobile/tablet)
  - Last Price
  - **Click product → opens pricing modal**
- **Back navigation**: Return to customer list

### 3. Product Pricing History Modal
- **Full-screen modal** with close button
- **Statistics cards** showing:
  - Min Price (green)
  - Max Price (red)
  - Average Price (blue)
  - Current Price
- **Warning alert**: Yellow banner if current price is below minimum
- **Detailed history table**:
  - Date
  - Unit Price (highlighted if min/max)
  - Quantity
  - Total
  - Deal ID
- **Visual indicators**: Min prices highlighted green, max prices red

## 🎨 Design Features

- **Clean Tailwind UI**: Professional, modern design
- **Responsive**: Mobile-first design with breakpoints
- **Loading states**: Skeleton components during data fetch
- **Error handling**: Clear error messages with red borders
- **Hover effects**: Interactive table rows
- **Color-coded stats**: Green (min), red (max), blue (average)
- **Brazilian formatting**:
  - Currency: R$ 1.234,56
  - Dates: DD/MM/YYYY
  - All labels in Portuguese

## 🔌 API Integration

### Customer List API
```typescript
GET /api/dashboard/customers
Response: Array<{
  id: number;
  nome: string;
  cnpj: string;
  cidade: string;
  estado: string;
  total_vendas: number;
  email?: string;
}>
```

### Customer Detail API
```typescript
GET /api/dashboard/customer-sales?customerId={id}
Response: {
  customer: { id, nome, cnpj, email?, cidade?, estado? };
  metrics: { totalRevenue, totalSales, avgDealValue };
  sales: Array<{ deal_id, data_venda, valor_total, produtos[] }>;
  products: Array<{ product_id, product_name, category, total_quantity, total_revenue, last_price }>;
}
```

### Product Pricing API
```typescript
GET /api/dashboard/product-pricing-history?customerId={id}&productId={id}
Response: {
  history: Array<{ date, price, quantity, total, deal_id }>;
  stats: { minPrice, maxPrice, avgPrice, currentPrice };
}
```

## 🚀 Usage

1. **View all customers**: Navigate to `/dashboard/customers`
2. **Search customers**: Type in search bar to filter
3. **View customer details**: Click any customer row
4. **View product pricing**: Click any product in customer detail
5. **Check price warnings**: Yellow alert if price below minimum
6. **Navigate back**: Use back button to return to list

## ✅ Quality Features

- **Type Safety**: Full TypeScript types for all data structures
- **Error Boundaries**: Graceful error handling at each level
- **Loading States**: Professional skeleton loaders
- **Responsive Design**: Works on mobile, tablet, desktop
- **Accessibility**: Semantic HTML with proper button/link usage
- **Performance**: Efficient data fetching with proper state management

## 🧪 Testing

```bash
# Check types
npm run type-check

# Test APIs
curl http://localhost:3003/api/dashboard/customers
curl http://localhost:3003/api/dashboard/customer-sales?customerId=123
curl http://localhost:3003/api/dashboard/product-pricing-history?customerId=123&productId=456

# View in browser
http://localhost:3003/dashboard/customers
```

## 📊 Business Intelligence Features

- **Price trend analysis**: View historical pricing patterns
- **Customer value metrics**: Total revenue, average deal value
- **Product performance**: Quantity sold, revenue per product
- **Risk detection**: Automatic warning for below-minimum pricing
- **Sales history**: Complete transaction timeline per customer
