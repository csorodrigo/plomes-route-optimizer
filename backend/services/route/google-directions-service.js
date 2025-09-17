/**
 * Google Directions Service - Provides routing using Google Directions API
 * Used for high-accuracy route optimization and real-world driving directions
 */

const axios = require('axios');

class GoogleDirectionsService {
    constructor() {
        this.apiKey = process.env.GOOGLE_MAPS_API_KEY;
        this.baseUrl = 'https://maps.googleapis.com/maps/api/directions/json';
        this.rateLimiter = null;
        this.cache = new Map();
        this.cacheTimeout = 24 * 60 * 60 * 1000; // 24 hours
    }

    /**
     * Get directions between multiple waypoints
     * @param {Object} origin - Starting point {lat, lng}
     * @param {Object} destination - End point {lat, lng}
     * @param {Array} waypoints - Array of intermediate points [{lat, lng}]
     * @param {Object} options - Additional options
     * @returns {Object} Route data with distance, duration, and polyline
     */
    async getDirections(origin, destination, waypoints = [], options = {}) {
        if (!this.apiKey) {
            console.warn('⚠️  Google Maps API key not configured, falling back to straight-line calculations');
            return this.getStraightLineRoute(origin, destination, waypoints);
        }

        try {
            const cacheKey = this.getCacheKey(origin, destination, waypoints, options);

            // Check cache first
            if (this.cache.has(cacheKey)) {
                const cached = this.cache.get(cacheKey);
                if (Date.now() - cached.timestamp < this.cacheTimeout) {
                    return cached.data;
                }
            }

            const params = {
                origin: `${origin.lat},${origin.lng}`,
                destination: `${destination.lat},${destination.lng}`,
                key: this.apiKey,
                units: 'metric',
                language: 'pt-BR',
                region: 'BR',
                mode: options.mode || 'driving',
                avoid: options.avoid || undefined,
                optimize: true
            };

            // Add waypoints if provided
            if (waypoints && waypoints.length > 0) {
                const waypointStr = waypoints
                    .map(wp => `${wp.lat},${wp.lng}`)
                    .join('|');
                params.waypoints = `optimize:true|${waypointStr}`;
            }

            console.log(`🗺️  Getting Google directions from ${origin.lat},${origin.lng} to ${destination.lat},${destination.lng} with ${waypoints.length} waypoints`);

            const response = await axios.get(this.baseUrl, { params });

            if (response.data.status === 'OK' && response.data.routes.length > 0) {
                const route = this.parseGoogleRoute(response.data.routes[0]);

                // Cache the result
                this.cache.set(cacheKey, {
                    data: route,
                    timestamp: Date.now()
                });

                return route;
            } else {
                console.warn(`⚠️  Google Directions API error: ${response.data.status}`);
                return this.getStraightLineRoute(origin, destination, waypoints);
            }

        } catch (error) {
            console.error('❌ Error getting Google directions:', error.message);
            return this.getStraightLineRoute(origin, destination, waypoints);
        }
    }

    /**
     * Get route matrix between multiple points
     * @param {Array} origins - Array of origin points
     * @param {Array} destinations - Array of destination points
     * @returns {Object} Distance matrix
     */
    async getDistanceMatrix(origins, destinations) {
        if (!this.apiKey) {
            console.warn('⚠️  Google Maps API key not configured, using straight-line distances');
            return this.getStraightLineMatrix(origins, destinations);
        }

        try {
            const params = {
                origins: origins.map(o => `${o.lat},${o.lng}`).join('|'),
                destinations: destinations.map(d => `${d.lat},${d.lng}`).join('|'),
                key: this.apiKey,
                units: 'metric',
                language: 'pt-BR',
                region: 'BR',
                mode: 'driving'
            };

            const response = await axios.get('https://maps.googleapis.com/maps/api/distancematrix/json', { params });

            if (response.data.status === 'OK') {
                return this.parseDistanceMatrix(response.data);
            } else {
                console.warn(`⚠️  Distance Matrix API error: ${response.data.status}`);
                return this.getStraightLineMatrix(origins, destinations);
            }

        } catch (error) {
            console.error('❌ Error getting distance matrix:', error.message);
            return this.getStraightLineMatrix(origins, destinations);
        }
    }

    /**
     * Parse Google route response
     */
    parseGoogleRoute(route) {
        const leg = route.legs[0] || {};

        return {
            distance: leg.distance ? leg.distance.value : 0, // meters
            duration: leg.duration ? leg.duration.value : 0, // seconds
            polyline: route.overview_polyline ? route.overview_polyline.points : '',
            bounds: route.bounds,
            waypoint_order: route.waypoint_order || [],
            legs: route.legs.map(leg => ({
                distance: leg.distance ? leg.distance.value : 0,
                duration: leg.duration ? leg.duration.value : 0,
                start_location: leg.start_location,
                end_location: leg.end_location
            }))
        };
    }

    /**
     * Parse distance matrix response
     */
    parseDistanceMatrix(data) {
        const matrix = [];

        for (let i = 0; i < data.rows.length; i++) {
            const row = [];
            for (let j = 0; j < data.rows[i].elements.length; j++) {
                const element = data.rows[i].elements[j];
                if (element.status === 'OK') {
                    row.push({
                        distance: element.distance.value,
                        duration: element.duration.value
                    });
                } else {
                    row.push({
                        distance: null,
                        duration: null
                    });
                }
            }
            matrix.push(row);
        }

        return matrix;
    }

    /**
     * Fallback: Calculate straight-line route when Google API is unavailable
     */
    getStraightLineRoute(origin, destination, waypoints = []) {
        const haversineDistance = require('haversine-distance');

        let totalDistance = 0;
        let points = [origin, ...waypoints, destination];

        for (let i = 0; i < points.length - 1; i++) {
            totalDistance += haversineDistance(points[i], points[i + 1]);
        }

        // Estimate driving time (assuming 50 km/h average speed in urban areas)
        const estimatedDuration = Math.round((totalDistance / 1000) * 72); // seconds

        return {
            distance: totalDistance,
            duration: estimatedDuration,
            polyline: '',
            bounds: {
                northeast: {
                    lat: Math.max(origin.lat, destination.lat),
                    lng: Math.max(origin.lng, destination.lng)
                },
                southwest: {
                    lat: Math.min(origin.lat, destination.lat),
                    lng: Math.min(origin.lng, destination.lng)
                }
            },
            waypoint_order: waypoints.map((_, index) => index),
            legs: [{
                distance: totalDistance,
                duration: estimatedDuration,
                start_location: origin,
                end_location: destination
            }],
            fallback: true
        };
    }

    /**
     * Fallback: Calculate straight-line distance matrix
     */
    getStraightLineMatrix(origins, destinations) {
        const haversineDistance = require('haversine-distance');
        const matrix = [];

        for (const origin of origins) {
            const row = [];
            for (const destination of destinations) {
                const distance = haversineDistance(origin, destination);
                const duration = Math.round((distance / 1000) * 72); // Estimate driving time

                row.push({
                    distance,
                    duration
                });
            }
            matrix.push(row);
        }

        return matrix;
    }

    /**
     * Generate cache key for directions
     */
    getCacheKey(origin, destination, waypoints, options) {
        const key = [
            `${origin.lat},${origin.lng}`,
            `${destination.lat},${destination.lng}`,
            waypoints.map(wp => `${wp.lat},${wp.lng}`).join('|'),
            JSON.stringify(options)
        ].join('::');

        return key;
    }

    /**
     * Clear expired cache entries
     */
    clearExpiredCache() {
        const now = Date.now();
        for (const [key, value] of this.cache.entries()) {
            if (now - value.timestamp > this.cacheTimeout) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            timeout: this.cacheTimeout
        };
    }
}

module.exports = GoogleDirectionsService;