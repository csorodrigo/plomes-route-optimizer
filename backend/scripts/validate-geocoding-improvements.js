#!/usr/bin/env node

/**
 * 🔍 GEOCODING VALIDATION & IMPROVEMENT ANALYZER
 *
 * Analyzes geocoding results and identifies improvements made
 * Provides detailed performance metrics and quality assessment
 */

const DatabaseService = require('../services/sync/database-service');
const GeocodingService = require('../services/geocoding/geocoding-service');

class GeocodingValidator {
    constructor() {
        this.db = new DatabaseService();
        this.geocodingService = null;
    }

    async initialize() {
        await this.db.ensureInitialized();
        this.geocodingService = new GeocodingService(this.db);
        console.log('🔍 Geocoding Validator initialized');
    }

    async validateAllCoordinates() {
        console.log('\n📊 VALIDATING ALL GEOCODED COORDINATES');
        console.log('='.repeat(50));

        try {
            // Get all geocoded customers
            const { data: customers } = await this.db.client
                .from('customers')
                .select('*')
                .not('latitude', 'is', null)
                .not('longitude', 'is', null);

            if (!customers || customers.length === 0) {
                console.log('❌ No geocoded customers found');
                return;
            }

            console.log(`🔍 Validating ${customers.length} geocoded customers...\n`);

            let validCount = 0;
            let invalidCount = 0;
            let noStateCount = 0;
            let outsideBrazilCount = 0;

            const invalidCustomers = [];
            const stateStats = new Map();

            for (const customer of customers) {
                const lat = parseFloat(customer.latitude);
                const lng = parseFloat(customer.longitude);
                const state = this.inferStateFromCustomer(customer);

                // Track by state
                if (state) {
                    if (!stateStats.has(state)) {
                        stateStats.set(state, { total: 0, valid: 0, invalid: 0 });
                    }
                    stateStats.get(state).total++;
                }

                // Validate coordinates
                if (!this.geocodingService.isInBrazil(lat, lng)) {
                    outsideBrazilCount++;
                    invalidCount++;
                    invalidCustomers.push({
                        ...customer,
                        issueType: 'Outside Brazil',
                        coordinates: `${lat}, ${lng}`
                    });
                    if (state) stateStats.get(state).invalid++;
                    continue;
                }

                if (state) {
                    const isValid = this.geocodingService.validateCoordinates(lat, lng, state);
                    if (isValid) {
                        validCount++;
                        stateStats.get(state).valid++;
                    } else {
                        invalidCount++;
                        stateStats.get(state).invalid++;
                        invalidCustomers.push({
                            ...customer,
                            issueType: 'Wrong state boundaries',
                            coordinates: `${lat}, ${lng}`,
                            expectedState: state
                        });
                    }
                } else {
                    noStateCount++;
                    // Without state, we can only validate if it's in Brazil
                    validCount++;
                }
            }

            // Display results
            console.log('📈 VALIDATION RESULTS:');
            console.log(`   Total geocoded: ${customers.length.toLocaleString()}`);
            console.log(`   ✅ Valid coordinates: ${validCount.toLocaleString()} (${Math.round(validCount/customers.length*100)}%)`);
            console.log(`   ❌ Invalid coordinates: ${invalidCount.toLocaleString()} (${Math.round(invalidCount/customers.length*100)}%)`);
            console.log(`   🌎 Outside Brazil: ${outsideBrazilCount.toLocaleString()}`);
            console.log(`   ❓ Unknown state: ${noStateCount.toLocaleString()}`);

            // State-by-state breakdown
            if (stateStats.size > 0) {
                console.log('\n🗺️  STATE-BY-STATE VALIDATION:');
                const sortedStates = Array.from(stateStats.entries())
                    .sort(([,a], [,b]) => b.total - a.total);

                for (const [state, stats] of sortedStates) {
                    const validRate = Math.round(stats.valid / stats.total * 100);
                    console.log(`   ${state}: ${stats.valid}/${stats.total} valid (${validRate}%)`);
                }
            }

            // Show top invalid customers
            if (invalidCustomers.length > 0) {
                console.log('\n🚨 TOP INVALID COORDINATES:');
                console.log('-'.repeat(80));
                console.log('NAME'.padEnd(25) + 'ISSUE'.padEnd(20) + 'COORDINATES'.padEnd(20) + 'EXPECTED');
                console.log('-'.repeat(80));

                invalidCustomers.slice(0, 10).forEach(customer => {
                    const name = (customer.name || '').substring(0, 24).padEnd(25);
                    const issue = customer.issueType.substring(0, 19).padEnd(20);
                    const coords = customer.coordinates.padEnd(20);
                    const expected = customer.expectedState || 'N/A';

                    console.log(`${name}${issue}${coords}${expected}`);
                });

                if (invalidCustomers.length > 10) {
                    console.log(`... and ${invalidCustomers.length - 10} more`);
                }
            }

            return {
                total: customers.length,
                valid: validCount,
                invalid: invalidCount,
                validationRate: Math.round(validCount / customers.length * 100),
                stateStats: Object.fromEntries(stateStats),
                invalidCustomers: invalidCustomers.slice(0, 20)
            };

        } catch (error) {
            console.error('❌ Validation error:', error.message);
            throw error;
        }
    }

    async analyzeProviderPerformance() {
        console.log('\n⚡ ANALYZING PROVIDER PERFORMANCE');
        console.log('='.repeat(50));

        try {
            // Get geocoding cache data to analyze provider performance
            const { data: cacheData } = await this.db.client
                .from('geocoding_cache')
                .select('provider, latitude, longitude, created_at');

            if (!cacheData || cacheData.length === 0) {
                console.log('❌ No geocoding cache data found');
                return;
            }

            const providerStats = new Map();

            cacheData.forEach(entry => {
                const provider = entry.provider || 'unknown';
                if (!providerStats.has(provider)) {
                    providerStats.set(provider, {
                        count: 0,
                        validCoords: 0,
                        avgLat: 0,
                        avgLng: 0,
                        latSum: 0,
                        lngSum: 0
                    });
                }

                const stats = providerStats.get(provider);
                stats.count++;

                const lat = parseFloat(entry.latitude);
                const lng = parseFloat(entry.longitude);

                if (this.geocodingService.isInBrazil(lat, lng)) {
                    stats.validCoords++;
                }

                stats.latSum += lat;
                stats.lngSum += lng;
                stats.avgLat = stats.latSum / stats.count;
                stats.avgLng = stats.lngSum / stats.count;
            });

            // Sort by count
            const sortedProviders = Array.from(providerStats.entries())
                .sort(([,a], [,b]) => b.count - a.count);

            console.log('🏆 PROVIDER PERFORMANCE RANKING:');
            console.log('-'.repeat(70));
            console.log('PROVIDER'.padEnd(20) + 'COUNT'.padEnd(10) + 'VALID%'.padEnd(10) + 'AVG_COORDS');
            console.log('-'.repeat(70));

            sortedProviders.forEach(([provider, stats]) => {
                const validRate = Math.round(stats.validCoords / stats.count * 100);
                const avgCoords = `${stats.avgLat.toFixed(2)}, ${stats.avgLng.toFixed(2)}`;

                const name = provider.padEnd(20);
                const count = stats.count.toString().padEnd(10);
                const valid = `${validRate}%`.padEnd(10);

                console.log(`${name}${count}${valid}${avgCoords}`);
            });

            return Object.fromEntries(providerStats);

        } catch (error) {
            console.error('❌ Provider analysis error:', error.message);
            throw error;
        }
    }

    async analyzeGeocodingQuality() {
        console.log('\n🎯 ANALYZING GEOCODING QUALITY');
        console.log('='.repeat(50));

        try {
            // Analyze different quality metrics
            const qualityMetrics = {
                withCEP: { total: 0, geocoded: 0 },
                withoutCEP: { total: 0, geocoded: 0 },
                withFullAddress: { total: 0, geocoded: 0 },
                cityOnly: { total: 0, geocoded: 0 }
            };

            const { data: allCustomers } = await this.db.client
                .from('customers')
                .select('cep, full_address, city, latitude, longitude');

            allCustomers.forEach(customer => {
                const hasCoords = customer.latitude && customer.longitude;
                const hasCEP = Boolean(customer.cep);
                const hasFullAddress = customer.full_address && customer.full_address.includes(',');
                const hasCityOnly = Boolean(customer.city) && !hasFullAddress && !hasCEP;

                if (hasCEP) {
                    qualityMetrics.withCEP.total++;
                    if (hasCoords) qualityMetrics.withCEP.geocoded++;
                } else {
                    qualityMetrics.withoutCEP.total++;
                    if (hasCoords) qualityMetrics.withoutCEP.geocoded++;
                }

                if (hasFullAddress) {
                    qualityMetrics.withFullAddress.total++;
                    if (hasCoords) qualityMetrics.withFullAddress.geocoded++;
                }

                if (hasCityOnly) {
                    qualityMetrics.cityOnly.total++;
                    if (hasCoords) qualityMetrics.cityOnly.geocoded++;
                }
            });

            console.log('📊 GEOCODING SUCCESS BY DATA QUALITY:');
            console.log('-'.repeat(50));

            Object.entries(qualityMetrics).forEach(([category, metrics]) => {
                const successRate = metrics.total > 0
                    ? Math.round(metrics.geocoded / metrics.total * 100)
                    : 0;

                const label = category.replace(/([A-Z])/g, ' $1').toLowerCase();
                console.log(`   ${label}: ${metrics.geocoded}/${metrics.total} (${successRate}%)`);
            });

            // Calculate overall quality score
            const totalGeocoded = qualityMetrics.withCEP.geocoded + qualityMetrics.withoutCEP.geocoded;
            const totalCustomers = qualityMetrics.withCEP.total + qualityMetrics.withoutCEP.total;
            const overallRate = Math.round(totalGeocoded / totalCustomers * 100);

            console.log(`\n🏆 OVERALL SUCCESS RATE: ${totalGeocoded}/${totalCustomers} (${overallRate}%)`);

            return {
                qualityMetrics,
                overallRate,
                totalGeocoded,
                totalCustomers
            };

        } catch (error) {
            console.error('❌ Quality analysis error:', error.message);
            throw error;
        }
    }

    async generateImprovementSuggestions() {
        console.log('\n💡 IMPROVEMENT SUGGESTIONS');
        console.log('='.repeat(50));

        try {
            const { data: failedCustomers } = await this.db.client
                .from('customers')
                .select('*')
                .eq('geocoding_status', 'failed')
                .limit(100);

            if (!failedCustomers || failedCustomers.length === 0) {
                console.log('✅ No failed customers to analyze!');
                return [];
            }

            const suggestions = [];

            // Analyze failure patterns
            const withoutCEP = failedCustomers.filter(c => !c.cep).length;
            const withCEP = failedCustomers.filter(c => c.cep).length;
            const withoutCity = failedCustomers.filter(c => !c.city).length;
            const shortAddress = failedCustomers.filter(c =>
                c.full_address && c.full_address.length < 20
            ).length;

            if (withoutCEP > failedCustomers.length * 0.5) {
                suggestions.push({
                    type: 'Data Quality',
                    priority: 'High',
                    suggestion: `${withoutCEP} clientes sem CEP. Considere buscar CEPs via APIs de correção de endereço.`
                });
            }

            if (withoutCity > failedCustomers.length * 0.3) {
                suggestions.push({
                    type: 'Data Quality',
                    priority: 'Medium',
                    suggestion: `${withoutCity} clientes sem cidade definida. Melhore a qualidade dos dados de entrada.`
                });
            }

            if (shortAddress > failedCustomers.length * 0.4) {
                suggestions.push({
                    type: 'Address Quality',
                    priority: 'Medium',
                    suggestion: `${shortAddress} clientes com endereços muito curtos. Enriqueça os dados de endereço.`
                });
            }

            // API suggestions
            if (withCEP > 0) {
                suggestions.push({
                    type: 'API Enhancement',
                    priority: 'High',
                    suggestion: 'Configure API keys do Google Maps ou Mapbox para melhor precisão com CEPs.'
                });
            }

            suggestions.push({
                type: 'Process Optimization',
                priority: 'Low',
                suggestion: 'Execute novamente após melhorias de dados para pegar clientes anteriormente falhados.'
            });

            // Display suggestions
            suggestions.forEach((suggestion, index) => {
                console.log(`${index + 1}. [${suggestion.priority}] ${suggestion.type}:`);
                console.log(`   ${suggestion.suggestion}\n`);
            });

            return suggestions;

        } catch (error) {
            console.error('❌ Suggestion generation error:', error.message);
            throw error;
        }
    }

    inferStateFromCustomer(customer) {
        if (customer.state) return customer.state;

        // Try to infer from CEP
        if (customer.cep) {
            const prefix = customer.cep.substring(0, 2);
            const cepStates = {
                '60': 'CE', '61': 'CE', '62': 'CE', '63': 'CE',
                '59': 'RN', '58': 'PB', '50': 'PE', '51': 'PE', '52': 'PE',
                '53': 'PE', '54': 'PE', '55': 'PE', '56': 'PE',
                '57': 'AL', '40': 'BA', '41': 'BA', '42': 'BA', '43': 'BA',
                '44': 'BA', '45': 'BA', '46': 'BA', '47': 'BA', '48': 'BA',
                '64': 'PI', '65': 'MA'
            };
            return cepStates[prefix] || null;
        }

        return null;
    }
}

// Main execution
async function main() {
    const validator = new GeocodingValidator();

    try {
        await validator.initialize();

        console.log('🔍 GEOCODING VALIDATION & IMPROVEMENT ANALYZER');
        console.log('='.repeat(60));

        // Run all analyses
        await validator.validateAllCoordinates();
        await validator.analyzeProviderPerformance();
        await validator.analyzeGeocodingQuality();
        await validator.generateImprovementSuggestions();

        console.log('\n✅ Validation analysis completed!');

    } catch (error) {
        console.error('❌ Analysis failed:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = GeocodingValidator;