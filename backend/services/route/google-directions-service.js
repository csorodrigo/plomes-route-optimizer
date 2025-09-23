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
     * @param {Array} waypointsArray - Array of waypoints including origin and destination [{lat, lng}]
     * @param {Object} options - Additional options
     * @returns {Object} Route data with distance, duration, and polyline
     */
    async getDirections(waypointsArray, options = {}) {
        // Handle both old signature (origin, destination, waypoints) and new signature (waypointsArray)
        let origin, destination, waypoints = [];

        if (Array.isArray(waypointsArray)) {
            // New signature: single array of all waypoints
            if (waypointsArray.length < 2) {
                throw new Error('At least 2 waypoints required');
            }

            origin = waypointsArray[0];
            destination = waypointsArray[waypointsArray.length - 1];
            waypoints = waypointsArray.slice(1, -1); // Middle waypoints
        } else {
            // Old signature: separate parameters
            origin = waypointsArray;
            destination = arguments[1];
            waypoints = arguments[2] || [];
            options = arguments[3] || {};
        }
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
                const parsedRoute = this.parseGoogleRoute(response.data.routes[0]);

                const result = {
                    success: true,
                    route: parsedRoute
                };

                // Cache the result
                this.cache.set(cacheKey, {
                    data: result,
                    timestamp: Date.now()
                });

                return result;
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
        // Calculate total distance and duration from all legs
        let totalDistance = 0;
        let totalDuration = 0;

        route.legs.forEach(leg => {
            totalDistance += leg.distance ? leg.distance.value : 0;
            totalDuration += leg.duration ? leg.duration.value : 0;
        });

        return {
            distance: {
                text: `${(totalDistance / 1000).toFixed(1)} km`,
                value: totalDistance
            },
            duration: {
                text: `${Math.round(totalDuration / 60)} min`,
                value: totalDuration
            },
            polyline: route.overview_polyline ? route.overview_polyline.points : '',
            bounds: route.bounds,
            waypoint_order: route.waypoint_order || [],
            legs: route.legs.map(leg => ({
                distance: {
                    text: leg.distance ? leg.distance.text : '0 km',
                    value: leg.distance ? leg.distance.value : 0
                },
                duration: {
                    text: leg.duration ? leg.duration.text : '0 min',
                    value: leg.duration ? leg.duration.value : 0
                },
                start_location: leg.start_location,
                end_location: leg.end_location
            })),
            decodedPath: this.decodePolyline(route.overview_polyline ? route.overview_polyline.points : '')
        };
    }

    /**
     * Decode Google's polyline encoding
     */
    decodePolyline(encoded) {
        if (!encoded) return [];

        try {
            const polyline = require('@mapbox/polyline');
            const decoded = polyline.decode(encoded);
            return decoded.map(point => ({
                lat: point[0],
                lng: point[1]
            }));
        } catch (error) {
            console.warn('Error decoding Google polyline:', error);
            return [];
        }
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
            success: true,
            route: {
                distance: {
                    text: `${(totalDistance / 1000).toFixed(1)} km`,
                    value: totalDistance
                },
                duration: {
                    text: `${Math.round(estimatedDuration / 60)} min`,
                    value: estimatedDuration
                },
                polyline: '',
                bounds: {
                    northeast: {
                        lat: Math.max(...points.map(p => p.lat)),
                        lng: Math.max(...points.map(p => p.lng))
                    },
                    southwest: {
                        lat: Math.min(...points.map(p => p.lat)),
                        lng: Math.min(...points.map(p => p.lng))
                    }
                },
                waypoint_order: waypoints.map((_, index) => index),
                legs: points.slice(0, -1).map((point, index) => {
                    const nextPoint = points[index + 1];
                    const legDistance = haversineDistance(point, nextPoint);
                    const legDuration = Math.round((legDistance / 1000) * 72);

                    return {
                        distance: {
                            text: `${(legDistance / 1000).toFixed(1)} km`,
                            value: legDistance
                        },
                        duration: {
                            text: `${Math.round(legDuration / 60)} min`,
                            value: legDuration
                        },
                        start_location: point,
                        end_location: nextPoint
                    };
                }),
                fallback: true,
                decodedPath: points.map(p => ({ lat: p.lat, lng: p.lng }))
            }
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