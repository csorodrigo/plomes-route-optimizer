const { Client } = require('@googlemaps/google-maps-services-js');
const polyline = require('polyline');

class GoogleDirectionsService {
    constructor() {
        this.client = new Client({});
        this.apiKey = process.env.GOOGLE_MAPS_API_KEY;
        
        if (!this.apiKey) {
            console.warn('⚠️  Google Maps API key not configured');
        }
    }

    /**
     * Obter direções detalhadas entre múltiplos pontos
     * @param {Array} waypoints - Array de pontos com {lat, lng}
     * @param {Object} options - Opções adicionais
     * @returns {Object} Direções com polyline decodificada
     */
    async getDirections(waypoints, options = {}) {
        const {
            mode = 'driving',
            language = 'pt-BR',
            avoid = [],
            optimize = true,
            alternatives = false,
            units = 'metric'
        } = options;

        if (!this.apiKey) {
            throw new Error('Google Maps API key not configured');
        }

        if (!waypoints || waypoints.length < 2) {
            throw new Error('At least 2 waypoints are required');
        }

        try {
            // Preparar origem e destino
            const origin = `${waypoints[0].lat},${waypoints[0].lng}`;
            const destination = `${waypoints[waypoints.length - 1].lat},${waypoints[waypoints.length - 1].lng}`;
            
            // Preparar waypoints intermediários
            const intermediateWaypoints = waypoints.slice(1, -1).map(wp => ({
                location: `${wp.lat},${wp.lng}`,
                stopover: true
            }));

            // Fazer requisição para Google Directions API
            const response = await this.client.directions({
                params: {
                    origin,
                    destination,
                    waypoints: intermediateWaypoints.length > 0 ? intermediateWaypoints : undefined,
                    mode,
                    language,
                    avoid: avoid.join('|'),
                    optimize: optimize && intermediateWaypoints.length > 0,
                    alternatives,
                    units,
                    key: this.apiKey
                }
            });

            if (!response.data.routes || response.data.routes.length === 0) {
                throw new Error('No routes found');
            }

            const route = response.data.routes[0];
            
            // Processar a rota
            const processedRoute = this.processRoute(route);
            
            return {
                success: true,
                route: processedRoute,
                alternatives: alternatives ? response.data.routes.slice(1).map(r => this.processRoute(r)) : []
            };

        } catch (error) {
            console.error('Google Directions API error:', error);
            
            if (error.response) {
                const errorMessage = error.response.data.error_message || 'Unknown error';
                throw new Error(`Google Maps API error: ${errorMessage}`);
            }
            
            throw error;
        }
    }

    /**
     * Processar rota retornada pela API
     */
    processRoute(route) {
        const legs = route.legs || [];
        
        // Combinar todos os steps de todas as legs
        const allSteps = [];
        let totalDistance = 0;
        let totalDuration = 0;
        
        legs.forEach(leg => {
            totalDistance += leg.distance.value;
            totalDuration += leg.duration.value;
            
            leg.steps.forEach(step => {
                allSteps.push({
                    instruction: this.cleanHtmlInstructions(step.html_instructions),
                    distance: step.distance.text,
                    duration: step.duration.text,
                    polyline: step.polyline.points,
                    maneuver: step.maneuver || null
                });
            });
        });

        // Decodificar a polyline principal da rota
        const decodedPath = this.decodePolyline(route.overview_polyline.points);
        
        return {
            distance: {
                text: this.formatDistance(totalDistance),
                value: totalDistance
            },
            duration: {
                text: this.formatDuration(totalDuration),
                value: totalDuration
            },
            polyline: route.overview_polyline.points,
            decodedPath,
            steps: allSteps,
            bounds: route.bounds,
            waypointOrder: route.waypoint_order || []
        };
    }

    /**
     * Decodificar polyline encoded
     */
    decodePolyline(encoded) {
        try {
            const decoded = polyline.decode(encoded);
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
     * Limpar instruções HTML
     */
    cleanHtmlInstructions(html) {
        if (!html) return '';
        
        // Remover tags HTML básicas
        return html
            .replace(/<b>/g, '')
            .replace(/<\/b>/g, '')
            .replace(/<div[^>]*>/g, ' ')
            .replace(/<\/div>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Formatar distância
     */
    formatDistance(meters) {
        if (meters < 1000) {
            return `${Math.round(meters)} m`;
        }
        return `${(meters / 1000).toFixed(1)} km`;
    }

    /**
     * Formatar duração
     */
    formatDuration(seconds) {
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
        if (!this.apiKey) {
            throw new Error('Google Maps API key not configured');
        }

        try {
            const response = await this.client.distancematrix({
                params: {
                    origins: origins.map(p => `${p.lat},${p.lng}`),
                    destinations: destinations.map(p => `${p.lat},${p.lng}`),
                    mode: 'driving',
                    language: 'pt-BR',
                    units: 'metric',
                    key: this.apiKey
                }
            });

            if (response.data.status !== 'OK') {
                throw new Error(`Distance Matrix API error: ${response.data.status}`);
            }

            // Processar matriz de distâncias
            const matrix = [];
            response.data.rows.forEach((row, i) => {
                matrix[i] = [];
                row.elements.forEach((element, j) => {
                    if (element.status === 'OK') {
                        matrix[i][j] = {
                            distance: element.distance.value,
                            duration: element.duration.value,
                            distanceText: element.distance.text,
                            durationText: element.duration.text
                        };
                    } else {
                        matrix[i][j] = null;
                    }
                });
            });

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
            // Obter matriz de distâncias
            const matrix = await this.getDistanceMatrix(waypoints, waypoints);
            
            // Usar algoritmo nearest neighbor para otimizar
            const optimized = [0]; // Começar da origem
            const remaining = new Set(Array.from({length: waypoints.length - 1}, (_, i) => i + 1));
            
            let current = 0;
            while (remaining.size > 0) {
                let nearest = null;
                let minDistance = Infinity;
                
                for (const next of remaining) {
                    if (matrix[current][next] && matrix[current][next].distance < minDistance) {
                        minDistance = matrix[current][next].distance;
                        nearest = next;
                    }
                }
                
                if (nearest !== null) {
                    optimized.push(nearest);
                    remaining.delete(nearest);
                    current = nearest;
                } else {
                    // Se não encontrou caminho, adicionar na ordem original
                    const next = remaining.values().next().value;
                    optimized.push(next);
                    remaining.delete(next);
                    current = next;
                }
            }
            
            // Retornar waypoints na ordem otimizada
            return optimized.map(idx => waypoints[idx]);
            
        } catch (error) {
            console.warn('Could not optimize waypoints, using original order:', error);
            return waypoints;
        }
    }
}

module.exports = GoogleDirectionsService;