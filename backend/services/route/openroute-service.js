const axios = require('axios');
const polyline = require('polyline');

class OpenRouteService {
    constructor() {
        this.apiKey = process.env.OPENROUTE_API_KEY || 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjkwNGUyY2U5NmY3MDRkYzA4OTZlODliYzRlNDgzMTRhIiwiaCI6Im11cm11cjY0In0=';
        this.baseUrl = 'https://api.openrouteservice.org';
        
        console.log('🗺️  OpenRouteService initialized');
    }

    /**
     * Obter direções detalhadas entre múltiplos pontos usando OpenRouteService
     * @param {Array} waypoints - Array de pontos com {lat, lng}
     * @param {Object} options - Opções adicionais
     * @returns {Object} Direções com polyline decodificada
     */
    async getDirections(waypoints, options = {}) {
        const {
            mode = 'driving-car', // driving-car, driving-hgv, cycling-regular, foot-walking
            language = 'pt',
            optimize = true,
            alternatives = false,
            units = 'km'
        } = options;

        if (!waypoints || waypoints.length < 2) {
            throw new Error('At least 2 waypoints are required');
        }

        try {
            // Converter waypoints para formato OpenRouteService [lng, lat]
            const coordinates = waypoints.map(wp => [wp.lng, wp.lat]);

            // Preparar requisição
            const requestBody = {
                coordinates,
                language,
                units,
                geometry: true,
                instructions: true,
                maneuvers: true
            };

            // Se otimização estiver habilitada e tiver mais de 2 waypoints
            // Nota: OpenRouteService não suporta optimize_waypoints no directions endpoint
            // A otimização deve ser feita usando o endpoint /optimization separadamente

            // Adicionar alternativas se solicitado
            if (alternatives) {
                requestBody.alternative_routes = {
                    target_count: 2,
                    weight_factor: 1.4,
                    share_factor: 0.6
                };
            }

            console.log('📍 Requesting route from OpenRouteService...');
            console.log(`📍 Waypoints: ${waypoints.length}`);
            console.log(`📍 Mode: ${mode}`);

            // Fazer requisição para OpenRouteService
            const response = await axios.post(
                `${this.baseUrl}/v2/directions/${mode}`,
                requestBody,
                {
                    headers: {
                        'Authorization': this.apiKey,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8'
                    },
                    timeout: 30000
                }
            );

            if (!response.data || !response.data.routes || response.data.routes.length === 0) {
                throw new Error('No routes found from OpenRouteService');
            }

            const route = response.data.routes[0];
            
            // Processar a rota
            const processedRoute = this.processRoute(route);
            
            console.log('✅ OpenRouteService route obtained successfully');
            console.log(`✅ Total distance: ${processedRoute.distance.text}`);
            console.log(`✅ Estimated time: ${processedRoute.duration.text}`);
            
            return {
                success: true,
                route: processedRoute,
                alternatives: alternatives && response.data.routes.length > 1 
                    ? response.data.routes.slice(1).map(r => this.processRoute(r))
                    : []
            };

        } catch (error) {
            console.error('OpenRouteService API error:', error.message);
            
            if (error.response) {
                console.error('Response status:', error.response.status);
                console.error('Response data:', error.response.data);
                
                if (error.response.status === 401) {
                    throw new Error('OpenRouteService API key is invalid');
                } else if (error.response.status === 429) {
                    throw new Error('OpenRouteService rate limit exceeded');
                } else if (error.response.status === 400) {
                    const errorMessage = error.response.data?.error?.message || 'Bad request';
                    throw new Error(`OpenRouteService error: ${errorMessage}`);
                }
            }
            
            throw error;
        }
    }

    /**
     * Processar rota retornada pela API
     */
    processRoute(route) {
        const segments = route.segments || [];
        
        // Combinar todos os steps de todos os segments
        const allSteps = [];
        let totalDistance = route.summary?.distance || 0;
        let totalDuration = route.summary?.duration || 0;
        
        segments.forEach(segment => {
            if (segment.steps) {
                segment.steps.forEach(step => {
                    allSteps.push({
                        instruction: step.instruction || step.name || '',
                        distance: this.formatDistance(step.distance),
                        duration: this.formatDuration(step.duration),
                        type: step.type,
                        maneuver: step.maneuver?.type || null
                    });
                });
            }
        });

        // Decodificar a geometria da rota
        let decodedPath = [];
        if (route.geometry) {
            if (typeof route.geometry === 'string') {
                // Polyline encoded
                decodedPath = this.decodePolyline(route.geometry);
            } else if (route.geometry.coordinates) {
                // GeoJSON format
                decodedPath = route.geometry.coordinates.map(coord => ({
                    lat: coord[1],
                    lng: coord[0]
                }));
            }
        }
        
        return {
            distance: {
                text: this.formatDistance(totalDistance),
                value: totalDistance
            },
            duration: {
                text: this.formatDuration(totalDuration),
                value: totalDuration
            },
            polyline: route.geometry,
            decodedPath,
            steps: allSteps,
            bounds: route.bbox ? {
                southwest: { lat: route.bbox[1], lng: route.bbox[0] },
                northeast: { lat: route.bbox[3], lng: route.bbox[2] }
            } : null,
            waypointOrder: route.way_points || []
        };
    }

    /**
     * Decodificar polyline encoded (formato padrão do OpenRouteService)
     */
    decodePolyline(encoded) {
        try {
            // OpenRouteService usa formato polyline5 por padrão
            const decoded = polyline.decode(encoded, 5);
            // Converter para formato usado pelo Leaflet [lat, lng]
            return decoded.map(point => ({
                lat: point[0],
                lng: point[1]
            }));
        } catch (error) {
            console.error('Error decoding polyline:', error);
            return [];
        }
    }

    /**
     * Formatar distância
     */
    formatDistance(meters) {
        if (!meters && meters !== 0) return '0 m';
        
        if (meters < 1000) {
            return `${Math.round(meters)} m`;
        }
        return `${(meters / 1000).toFixed(1)} km`;
    }

    /**
     * Formatar duração
     */
    formatDuration(seconds) {
        if (!seconds && seconds !== 0) return '0 min';
        
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes}min`;
        }
        return `${minutes} min`;
    }

    /**
     * Calcular matriz de distâncias entre múltiplos pontos
     */
    async getDistanceMatrix(origins, destinations) {
        try {
            // Converter para formato OpenRouteService
            const locations = [...origins, ...destinations].map(p => [p.lng, p.lat]);
            const sources = Array.from({length: origins.length}, (_, i) => i);
            const targets = Array.from({length: destinations.length}, (_, i) => origins.length + i);

            const requestBody = {
                locations,
                sources,
                destinations: targets,
                metrics: ['distance', 'duration'],
                units: 'km'
            };

            const response = await axios.post(
                `${this.baseUrl}/v2/matrix/driving-car`,
                requestBody,
                {
                    headers: {
                        'Authorization': this.apiKey,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );

            if (!response.data) {
                throw new Error('Distance Matrix API error: No data returned');
            }

            // Processar matriz de distâncias
            const matrix = [];
            const distances = response.data.distances;
            const durations = response.data.durations;
            
            for (let i = 0; i < origins.length; i++) {
                matrix[i] = [];
                for (let j = 0; j < destinations.length; j++) {
                    if (distances[i] && distances[i][j] !== null) {
                        matrix[i][j] = {
                            distance: distances[i][j] * 1000, // Convert km to meters
                            duration: durations[i][j],
                            distanceText: this.formatDistance(distances[i][j] * 1000),
                            durationText: this.formatDuration(durations[i][j])
                        };
                    } else {
                        matrix[i][j] = null;
                    }
                }
            }

            return matrix;

        } catch (error) {
            console.error('Distance Matrix API error:', error);
            throw error;
        }
    }

    /**
     * Otimizar ordem de waypoints usando Distance Matrix
     */
    async optimizeWaypointsOrder(waypoints) {
        if (waypoints.length <= 2) {
            return waypoints;
        }

        try {
            // Usar o endpoint de otimização do OpenRouteService
            const coordinates = waypoints.map(wp => [wp.lng, wp.lat]);
            
            const requestBody = {
                jobs: coordinates.slice(1).map((coord, idx) => ({
                    id: idx + 1,
                    location: coord
                })),
                vehicles: [{
                    id: 1,
                    start: coordinates[0],
                    end: coordinates[0] // Retornar ao início
                }]
            };

            const response = await axios.post(
                `${this.baseUrl}/optimization`,
                requestBody,
                {
                    headers: {
                        'Authorization': this.apiKey,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );

            if (response.data && response.data.routes && response.data.routes[0]) {
                const optimizedOrder = response.data.routes[0].steps
                    .filter(step => step.type === 'job')
                    .map(step => step.job);
                
                // Reconstruir waypoints na ordem otimizada
                const optimized = [waypoints[0]]; // Começar com origem
                optimizedOrder.forEach(jobId => {
                    optimized.push(waypoints[jobId]);
                });
                
                return optimized;
            }
            
        } catch (error) {
            console.warn('Could not optimize waypoints with OpenRouteService, using original order:', error.message);
        }

        // Fallback: usar algoritmo nearest neighbor local
        return this.nearestNeighborOptimization(waypoints);
    }

    /**
     * Algoritmo nearest neighbor para otimização local
     */
    nearestNeighborOptimization(waypoints) {
        if (waypoints.length <= 2) return waypoints;
        
        const unvisited = new Set(waypoints.slice(1).map((_, i) => i + 1));
        const optimized = [waypoints[0]];
        let current = 0;
        
        while (unvisited.size > 0) {
            let nearest = null;
            let minDistance = Infinity;
            
            for (const next of unvisited) {
                const distance = this.haversineDistance(waypoints[current], waypoints[next]);
                if (distance < minDistance) {
                    minDistance = distance;
                    nearest = next;
                }
            }
            
            if (nearest !== null) {
                optimized.push(waypoints[nearest]);
                unvisited.delete(nearest);
                current = nearest;
            }
        }
        
        return optimized;
    }

    /**
     * Calcular distância haversine entre dois pontos
     */
    haversineDistance(point1, point2) {
        const R = 6371e3; // metros
        const φ1 = point1.lat * Math.PI / 180;
        const φ2 = point2.lat * Math.PI / 180;
        const Δφ = (point2.lat - point1.lat) * Math.PI / 180;
        const Δλ = (point2.lng - point1.lng) * Math.PI / 180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return R * c; // metros
    }
}

module.exports = OpenRouteService;