# Polyline Rendering Testing Guide
## PLOMES-ROTA-CEP Route Optimization System

### Overview
This guide provides comprehensive testing procedures to verify that the polyline rendering functionality works correctly in the RouteOptimizer component. The polylines should display as red lines (color: #FF0000, weight: 6, opacity: 1.0) on the map after successful route optimization.

---

## 🧪 Automated Test Suite

### Unit Tests
**Location**: `frontend/src/components/__tests__/RouteOptimizer.polyline.test.js`

Run the unit tests:
```bash
cd frontend
npm test -- RouteOptimizer.polyline.test.js
```

**What it tests**:
- ✅ Polyline rendering with real route data
- ✅ Fallback to waypoint coordinates when real data unavailable
- ✅ Error handling for invalid coordinates
- ✅ Debug panel display in development mode
- ✅ Console logging verification
- ✅ Proper styling properties (red, thick, opaque)

### Integration Tests
**Location**: `frontend/src/components/__tests__/RouteOptimizer.integration.test.js`

Run the integration tests:
```bash
cd frontend
npm test -- RouteOptimizer.integration.test.js
```

**What it tests**:
- ✅ Complete workflow from customer loading to polyline rendering
- ✅ Map interaction and polyline updates
- ✅ Performance with complex routes
- ✅ Error handling and graceful fallbacks
- ✅ Memory usage and rapid interactions

### E2E Tests
**Location**: `frontend/src/__tests__/e2e/polyline.e2e.test.js`

Setup and run E2E tests:
```bash
# Install Puppeteer if not already installed
npm install --save-dev puppeteer

# Run E2E tests
npm run test:e2e
```

**What it tests**:
- ✅ Real browser polyline rendering
- ✅ User interaction workflows
- ✅ Visual regression testing
- ✅ Network error handling
- ✅ Cross-browser compatibility

---

## 📋 Manual Testing Checklist

### Prerequisites
- [ ] Backend server running on http://localhost:3001
- [ ] Frontend server running on http://localhost:3000
- [ ] Test data loaded in database (customers with valid coordinates)
- [ ] Browser developer tools open (Console tab for debugging)

### Test Scenario 1: Basic Polyline Rendering
**Objective**: Verify polyline appears after successful route optimization

1. **Setup**:
   - [ ] Navigate to http://localhost:3000
   - [ ] Open browser Developer Tools (F12)
   - [ ] Switch to Console tab

2. **Load Customers**:
   - [ ] Click "📥 Carregar Clientes" button
   - [ ] Verify success message shows customer count
   - [ ] Verify blue customer markers appear on map

3. **Set Origin**:
   - [ ] Enter valid CEP (e.g., "01000-000") in origin field
   - [ ] Click "📍" button
   - [ ] Verify success message with address
   - [ ] Verify red origin marker appears on map
   - [ ] Verify blue coverage circle appears around origin

4. **Select Customers**:
   - [ ] Click on at least 2 customer markers
   - [ ] Verify markers turn green when selected
   - [ ] Verify selected customer count updates in sidebar

5. **Optimize Route**:
   - [ ] Click "🚀 Otimizar Rota" button
   - [ ] Wait for optimization to complete
   - [ ] **CRITICAL**: Verify red polyline appears on map
   - [ ] Verify polyline connects selected customers in optimized order

6. **Verify Polyline Properties**:
   - [ ] Polyline should be **RED** (color: #FF0000)
   - [ ] Polyline should be **THICK** (weight: 6)
   - [ ] Polyline should be **OPAQUE** (opacity: 1.0)
   - [ ] Polyline should follow route path (real route data if available)

7. **Check Console Logs**:
   ```
   Expected console messages:
   🗺️ Route data structure: {...}
   🗺️ Real route data: {...}
   🗺️ Using real route polyline with X decoded points
   OR
   🗺️ Using waypoint straight-line polyline with X points
   🗺️ Rendering polyline with X valid points
   ```

### Test Scenario 2: Real Route Data vs Waypoint Fallback
**Objective**: Test different polyline data sources

1. **Test with Real Route Data**:
   - [ ] Complete basic setup (steps 1-5 above)
   - [ ] Check console for "Using real route polyline" message
   - [ ] Verify polyline follows detailed road paths (curved lines)
   - [ ] Route info card should show optimized route details

2. **Test Waypoint Fallback**:
   - [ ] If real route fails, verify fallback occurs
   - [ ] Check console for "Using waypoint straight-line polyline" message
   - [ ] Verify polyline shows straight lines between points
   - [ ] Route should still be functional

### Test Scenario 3: Error Handling
**Objective**: Verify graceful error handling

1. **No Route Data**:
   - [ ] Load page without optimizing route
   - [ ] Verify no polyline is rendered
   - [ ] Check console for "No route data available for polyline"

2. **Invalid Coordinates**:
   - [ ] Force invalid coordinate data (developer testing only)
   - [ ] Verify no polyline renders with invalid data
   - [ ] Check console for "Invalid coordinate format detected"

3. **Insufficient Coordinates**:
   - [ ] Test with single waypoint
   - [ ] Verify no polyline renders
   - [ ] Check console for "Insufficient coordinates for polyline"

### Test Scenario 4: Debug Information (Development Mode)
**Objective**: Verify debug panel functionality

1. **Enable Development Mode**:
   - [ ] Ensure NODE_ENV=development
   - [ ] Refresh page
   - [ ] Complete route optimization

2. **Verify Debug Panel**:
   - [ ] Look for debug panel in top-right corner of map
   - [ ] Panel should show "🐛 Debug: Polyline Info"
   - [ ] Verify information displays:
     - Real Route Available: Yes/No
     - Decoded Path Points: X (if real route)
     - Waypoints: X

### Test Scenario 5: Interactive Features
**Objective**: Test map interactions affecting polylines

1. **Origin Dragging**:
   - [ ] After route optimization, drag origin marker to new location
   - [ ] Verify "Origem atualizada" notification appears
   - [ ] Verify map centers on new origin position

2. **Customer Reordering** (if implemented):
   - [ ] Try reordering customers in sidebar
   - [ ] Verify polyline updates with new route order

3. **Route Information Card**:
   - [ ] Verify route card appears at bottom of map
   - [ ] Check distance and time calculations
   - [ ] Verify "📄 Exportar PDF" button is enabled

### Test Scenario 6: Performance Testing
**Objective**: Verify system handles complex routes

1. **Many Customers**:
   - [ ] Select 10+ customers for route optimization
   - [ ] Verify polyline renders within reasonable time (< 5 seconds)
   - [ ] Check for any performance warnings in console

2. **Rapid Interactions**:
   - [ ] Quickly select/deselect multiple customers
   - [ ] Verify system remains responsive
   - [ ] No memory leaks or performance degradation

---

## 🐛 Debugging Guide

### Common Issues and Solutions

#### Issue: Polyline Not Appearing
**Symptoms**: Route optimization succeeds but no red line on map

**Debug Steps**:
1. Check browser console for error messages
2. Look for these log messages:
   - "🗺️ Route data structure:" - Should show route object
   - "🗺️ Rendering polyline with X valid points" - Should appear
3. Verify route object has valid waypoints or realRoute.decodedPath
4. Check if coordinates are in correct format: `[lat, lng]`

**Possible Solutions**:
- Verify backend API returns proper route structure
- Check coordinate validation in frontend code
- Ensure react-leaflet Polyline component is imported correctly

#### Issue: Wrong Polyline Color/Style
**Symptoms**: Polyline appears but not red/thick/opaque

**Debug Steps**:
1. Inspect polyline element in browser DevTools
2. Check data attributes: `data-color`, `data-weight`, `data-opacity`
3. Verify CSS is not overriding polyline styles

**Expected Properties**:
```html
<polyline
  data-color="#FF0000"
  data-weight="6"
  data-opacity="1"
  data-pane="overlayPane"
/>
```

#### Issue: Console Errors
**Common Error Messages**:

1. **"Invalid coordinate format detected"**:
   - Solution: Check API response for coordinate data types
   - Ensure lat/lng are numbers, not strings

2. **"Insufficient coordinates for polyline"**:
   - Solution: Verify route has at least 2 points
   - Check waypoints array length

3. **"No route data available for polyline"**:
   - Solution: Ensure route optimization completes successfully
   - Check route state is properly set

### Development Tools

#### Browser Console Commands
Test polyline data directly in console:
```javascript
// Check current route data
console.log(window.routeDebugData);

// Check polyline elements
document.querySelectorAll('[data-testid="polyline"]');

// Verify coordinate format
const polyline = document.querySelector('[data-testid="polyline"]');
const positions = JSON.parse(polyline.getAttribute('data-positions'));
console.log('Polyline coordinates:', positions);
```

#### Network Tab Verification
Check API responses:
1. Open Network tab in DevTools
2. Optimize route and look for `/api/optimize-route` request
3. Verify response contains:
   ```json
   {
     "success": true,
     "route": {
       "waypoints": [...],
       "realRoute": {
         "decodedPath": [...]
       }
     }
   }
   ```

---

## 📊 Test Results Documentation

### Test Execution Checklist
Track your testing progress:

#### Automated Tests
- [ ] Unit tests passing (all scenarios)
- [ ] Integration tests passing (complete workflow)
- [ ] E2E tests passing (real browser testing)

#### Manual Tests
- [ ] Basic polyline rendering ✅
- [ ] Real route data vs waypoint fallback ✅
- [ ] Error handling scenarios ✅
- [ ] Debug information display ✅
- [ ] Interactive features ✅
- [ ] Performance testing ✅

#### Browser Compatibility
Test in multiple browsers:
- [ ] Chrome/Chromium ✅
- [ ] Firefox ✅
- [ ] Safari ✅
- [ ] Edge ✅

#### Mobile Responsiveness
- [ ] Mobile portrait mode ✅
- [ ] Mobile landscape mode ✅
- [ ] Tablet mode ✅

### Performance Benchmarks
Record performance metrics:
- Route optimization time: _____ ms
- Polyline rendering time: _____ ms
- Memory usage: _____ MB
- Maximum tested waypoints: _____

### Issues Found
Document any issues:
| Issue | Severity | Status | Notes |
|-------|----------|---------|-------|
| | | | |

---

## ✅ Success Criteria

### Polyline rendering is considered SUCCESSFUL when:

1. **Visual Verification**:
   - ✅ Red polyline appears on map after route optimization
   - ✅ Polyline is thick (weight: 6) and fully opaque (opacity: 1.0)
   - ✅ Polyline connects all selected customers in route order

2. **Functional Verification**:
   - ✅ Real route data used when available (detailed road paths)
   - ✅ Waypoint fallback works when real data unavailable
   - ✅ Error handling prevents crashes with invalid data

3. **Technical Verification**:
   - ✅ Console shows proper debug messages
   - ✅ Debug panel displays correct information (development mode)
   - ✅ No JavaScript errors in browser console

4. **Performance Verification**:
   - ✅ Polyline renders within 5 seconds for normal routes
   - ✅ System handles 50+ waypoints without performance issues
   - ✅ Memory usage remains stable during interactions

### Final Validation
The polyline functionality is FULLY WORKING when all test scenarios pass and users can:
1. Load customers and see markers on map
2. Set origin point with coverage radius
3. Select multiple customers for route optimization
4. Click optimize button and see red polyline appear
5. View detailed route information card
6. Export route as PDF (if needed)

---

**For technical support or questions about this testing guide, refer to the codebase documentation or development team.**