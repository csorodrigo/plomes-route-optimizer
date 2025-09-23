# POLYLINE MANUAL TEST CHECKLIST

## Quick Verification Steps

### ✅ Pre-Test Verification
- [ ] Backend running on http://localhost:3001
- [ ] Frontend running on http://localhost:3000
- [ ] Both servers started without errors

### 🌐 Step 1: Application Loading (2 minutes)
- [ ] Open http://localhost:3000 in browser
- [ ] Map loads and displays correctly
- [ ] No console errors related to Leaflet/CSS
- [ ] Leaflet map tiles are visible

### 📍 Step 2: Origin Setup (1 minute)
- [ ] Enter CEP: `60175-047` in origin field
- [ ] Click 📍 button
- [ ] "Origem definida" message appears
- [ ] Red origin marker visible on map
- [ ] Origin marker is draggable

### 👥 Step 3: Customer Loading (2 minutes)
- [ ] Click "📥 Carregar Clientes" button
- [ ] Success message appears (X clientes carregados)
- [ ] Blue customer markers appear on map
- [ ] Can click markers to open popups
- [ ] Can select customers via popup buttons

### 🚀 Step 4: Route Optimization (3 minutes)
- [ ] Select 3-5 customers using map markers
- [ ] Selected customers appear in sidebar list
- [ ] Click "🚀 Otimizar Rota" button
- [ ] Route optimization completes successfully
- [ ] **CRITICAL: RED POLYLINE VISIBLE on map**
- [ ] Polyline connects origin → customers → origin
- [ ] Route info card appears with details

### 🐛 Step 5: Debug Features (1 minute)
**In Development Mode:**
- [ ] Debug panel visible in top-right corner
- [ ] Debug panel shows polyline status
- [ ] Green test polyline visible if no route optimized

### 📄 Step 6: PDF Export (1 minute)
- [ ] PDF export button enabled after route optimization
- [ ] Can click PDF export button
- [ ] No errors during PDF generation

## PASS/FAIL CRITERIA

### ✅ PASS: Polyline Fixes Working
- Red polylines visible after route optimization
- No React-Leaflet console errors
- Map functionality works smoothly
- All major features operational

### ❌ FAIL: Issues Detected
- No polylines visible after route optimization
- React-Leaflet errors in console
- Map fails to load or crashes
- Route optimization fails

## COMMON ISSUES & SOLUTIONS

### Issue: No Polylines Visible
**Check:**
- Browser console for errors
- Route optimization completed successfully
- Debug panel shows valid coordinates
- Polyline color is correct (red #FF0000)

### Issue: Map Not Loading
**Check:**
- Leaflet CSS imported correctly
- No network blocking of tile requests
- React-Leaflet version compatibility

### Issue: Route Optimization Fails
**Check:**
- Origin is set properly
- Customers are selected
- Backend API responding correctly
- Authentication working

## TIME ESTIMATE
**Total Test Time:** ~10 minutes for complete verification

## RESULTS LOG
Date: ___________
Tester: ___________

**Overall Result:** [ ] PASS [ ] FAIL

**Issues Found:**
_________________________________
_________________________________
_________________________________

**Notes:**
_________________________________
_________________________________
_________________________________