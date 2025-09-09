const haversineDistance = require('haversine-distance');
const GoogleDirectionsService = require('./google-directions-service');
const OpenRouteService = require('./openroute-service');

class RouteOptimizer {
    constructor() {
        this.maxIterations = 1000;
        this.googleDirections = new GoogleDirectionsService();
        this.openRouteService = new OpenRouteService();
    }

    /**
     * Otimiza uma rota entre múltiplos pontos usando algoritmos heurísticos
     * @param {Array} waypoints - Array de pontos com {lat, lng, id, name}
     * @param {Object} origin - Ponto de origem {lat, lng}
     * @param {Object} options - Opções adicionais
     * @returns {Object} Rota otimizada
     */
    async optimize(waypoints, origin, options = {}) {
        const {
            returnToOrigin = false,
            algorithm = 'nearest-neighbor-2opt',
            useRealRoutes = true
        } = options;

        if (!waypoints || waypoints.length === 0) {
            return {
                waypoints: [origin],
                totalDistance: 0,
                estimatedTime: 0,
                optimizedOrder: []
            };
        }

        // Adicionar origem no início
        const points = [origin, ...waypoints];
        
        let optimizedRoute;
        
        switch (algorithm) {
            case 'nearest-neighbor':
                optimizedRoute = this.nearestNeighbor(points, returnToOrigin);
                break;
            case '2-opt':
                optimizedRoute = this.twoOpt(points, returnToOrigin);
                break;
            case 'nearest-neighbor-2opt':
            default:
                // Usar nearest neighbor primeiro e depois melhorar com 2-opt
                const nnRoute = this.nearestNeighbor(points, returnToOrigin);
                optimizedRoute = this.twoOptImprovement(nnRoute.order, points, returnToOrigin);
                break;
        }

        // Calcular distância total e tempo estimado
        const totalDistance = this.calculateTotalDistance(optimizedRoute.order, points);
        const estimatedTime = this.estimateTime(totalDistance);

        // Gerar direções turn-by-turn se necessário
        const directions = this.generateDirections(optimizedRoute.order, points);

        // Obter waypoints otimizados
        const optimizedWaypoints = optimizedRoute.order.map(idx => points[idx]);

        // Se habilitado, obter rotas reais - tentar Google primeiro, depois OpenRouteService
        let realRoute = null;
        if (useRealRoutes) {
            // Tentar Google Maps primeiro
            if (process.env.GOOGLE_MAPS_API_KEY) {
                try {
                    console.log('📍 Trying Google Maps Directions API...');
                    const directionsResult = await this.googleDirections.getDirections(optimizedWaypoints);
                    
                    if (directionsResult.success) {
                        realRoute = directionsResult.route;
                        console.log('✅ Google Maps route obtained successfully');
                        console.log(`✅ Total distance: ${realRoute.distance.text}`);
                        console.log(`✅ Estimated time: ${realRoute.duration.text}`);
                    }
                } catch (error) {
                    console.warn('⚠️  Google Maps failed:', error.message);
                }
            }
            
            // Se Google falhou ou não está configurado, usar OpenRouteService
            if (!realRoute) {
                try {
                    console.log('🗺️  Trying OpenRouteService API (free alternative)...');
                    const openRouteResult = await this.openRouteService.getDirections(optimizedWaypoints);
                    
                    if (openRouteResult.success) {
                        realRoute = openRouteResult.route;
                        console.log('✅ OpenRouteService route obtained successfully');
                        console.log(`✅ Total distance: ${realRoute.distance.text}`);
                        console.log(`✅ Estimated time: ${realRoute.duration.text}`);
                    }
                } catch (error) {
                    console.warn('⚠️  OpenRouteService also failed:', error.message);
                    console.warn('⚠️  Falling back to straight lines between points');
                }
            }
        } else {
            console.log('📍 Real routes disabled via options');
        }

        return {
            waypoints: optimizedWaypoints,
            optimizedOrder: optimizedRoute.order,
            totalDistance,
            estimatedTime,
            directions,
            algorithm,
            improvementPercentage: optimizedRoute.improvement || 0,
            realRoute // Adicionar rota real se disponível
        };
    }

    /**
     * Algoritmo Nearest Neighbor (vizinho mais próximo)
     */
    nearestNeighbor(points, returnToOrigin = false) {
        const n = points.length;
        const visited = new Array(n).fill(false);
        const route = [];
        
        // Começar da origem (índice 0)
        let current = 0;
        route.push(current);
        visited[current] = true;

        // Visitar todos os pontos
        while (route.length < n) {
            let nearest = -1;
            let minDistance = Infinity;

            // Encontrar o ponto não visitado mais próximo
            for (let i = 0; i < n; i++) {
                if (!visited[i]) {
                    const distance = this.getDistance(points[current], points[i]);
                    if (distance < minDistance) {
                        minDistance = distance;
                        nearest = i;
                    }
                }
            }

            if (nearest !== -1) {
                route.push(nearest);
                visited[nearest] = true;
                current = nearest;
            }
        }

        // Adicionar retorno à origem se necessário
        if (returnToOrigin) {
            route.push(0);
        }

        return {
            order: route,
            distance: this.calculateTotalDistance(route, points)
        };
    }

    /**
     * Algoritmo 2-opt para melhorar uma rota existente
     */
    twoOptImprovement(route, points, returnToOrigin = false) {
        let improved = true;
        let bestRoute = [...route];
        let bestDistance = this.calculateTotalDistance(bestRoute, points);
        let iterations = 0;
        let totalImprovement = 0;

        while (improved && iterations < this.maxIterations) {
            improved = false;
            iterations++;

            // Tentar todas as combinações de troca 2-opt
            for (let i = 1; i < bestRoute.length - 2; i++) {
                for (let j = i + 1; j < bestRoute.length; j++) {
                    if (j - i === 1) continue;

                    // Criar nova rota com a troca 2-opt
                    const newRoute = this.twoOptSwap(bestRoute, i, j);
                    const newDistance = this.calculateTotalDistance(newRoute, points);

                    // Se a nova rota é melhor, mantê-la
                    if (newDistance < bestDistance) {
                        const improvement = bestDistance - newDistance;
                        totalImprovement += improvement;
                        
                        bestRoute = newRoute;
                        bestDistance = newDistance;
                        improved = true;
                        
                        console.log(`2-opt improvement: ${improvement.toFixed(2)} km (iteration ${iterations})`);
                    }
                }
            }
        }

        const improvementPercentage = (totalImprovement / this.calculateTotalDistance(route, points)) * 100;
        
        return {
            order: bestRoute,
            distance: bestDistance,
            improvement: improvementPercentage,
            iterations
        };
    }

    /**
     * Algoritmo 2-opt completo
     */
    twoOpt(points, returnToOrigin = false) {
        // Começar com uma rota aleatória ou sequencial
        const initialRoute = Array.from({ length: points.length }, (_, i) => i);
        if (returnToOrigin) {
            initialRoute.push(0);
        }

        return this.twoOptImprovement(initialRoute, points, returnToOrigin);
    }

    /**
     * Realiza uma troca 2-opt
     */
    twoOptSwap(route, i, j) {
        const newRoute = [...route];
        
        // Reverter a seção entre i e j
        while (i < j) {
            [newRoute[i], newRoute[j]] = [newRoute[j], newRoute[i]];
            i++;
            j--;
        }
        
        return newRoute;
    }

    /**
     * Calcula a distância total de uma rota
     */
    calculateTotalDistance(route, points) {
        let totalDistance = 0;
        
        for (let i = 0; i < route.length - 1; i++) {
            const from = points[route[i]];
            const to = points[route[i + 1]];
            totalDistance += this.getDistance(from, to);
        }
        
        return totalDistance;
    }

    /**
     * Calcula a distância entre dois pontos
     */
    getDistance(point1, point2) {
        if (!point1 || !point2) return 0;
        
        // Usar haversine-distance para cálculo preciso
        const p1 = { latitude: point1.lat, longitude: point1.lng };
        const p2 = { latitude: point2.lat, longitude: point2.lng };
        
        // Retorna distância em quilômetros
        return haversineDistance(p1, p2) / 1000;
    }

    /**
     * Estima o tempo de viagem baseado na distância
     */
    estimateTime(distanceKm) {
        // Assumir velocidade média de 40 km/h em área urbana
        const avgSpeedKmh = 40;
        const timeHours = distanceKm / avgSpeedKmh;
        const timeMinutes = Math.round(timeHours * 60);
        
        // Adicionar tempo extra para paradas (5 minutos por ponto)
        const stops = 5; // minutos por parada
        
        return timeMinutes + (stops * (this.waypoints?.length || 0));
    }

    /**
     * Gera direções simplificadas
     */
    generateDirections(route, points) {
        const directions = [];
        
        for (let i = 0; i < route.length - 1; i++) {
            const from = points[route[i]];
            const to = points[route[i + 1]];
            const distance = this.getDistance(from, to);
            
            directions.push({
                step: i + 1,
                from: from.name || `Ponto ${route[i]}`,
                to: to.name || `Ponto ${route[i + 1]}`,
                distance: distance.toFixed(2),
                instruction: `Siga para ${to.name || 'próximo ponto'} (${distance.toFixed(2)} km)`
            });
        }
        
        return directions;
    }

    /**
     * Método alternativo usando algoritmo genético (para rotas muito complexas)
     */
    geneticAlgorithm(points, returnToOrigin = false, generations = 100) {
        const populationSize = 50;
        const mutationRate = 0.02;
        const eliteSize = 10;
        
        // Criar população inicial
        let population = this.createInitialPopulation(points.length, populationSize);
        
        for (let gen = 0; gen < generations; gen++) {
            // Avaliar fitness
            const fitness = population.map(route => ({
                route,
                fitness: 1 / this.calculateTotalDistance(route, points)
            }));
            
            // Ordenar por fitness
            fitness.sort((a, b) => b.fitness - a.fitness);
            
            // Selecionar elite
            const elite = fitness.slice(0, eliteSize).map(f => f.route);
            
            // Criar nova geração
            const newPopulation = [...elite];
            
            while (newPopulation.length < populationSize) {
                // Selecionar pais
                const parent1 = this.tournamentSelection(fitness);
                const parent2 = this.tournamentSelection(fitness);
                
                // Crossover
                const child = this.orderCrossover(parent1.route, parent2.route);
                
                // Mutação
                if (Math.random() < mutationRate) {
                    this.mutate(child);
                }
                
                newPopulation.push(child);
            }
            
            population = newPopulation;
        }
        
        // Retornar a melhor solução
        const best = population.reduce((best, route) => {
            const distance = this.calculateTotalDistance(route, points);
            const bestDistance = this.calculateTotalDistance(best, points);
            return distance < bestDistance ? route : best;
        });
        
        if (returnToOrigin) {
            best.push(0);
        }
        
        return {
            order: best,
            distance: this.calculateTotalDistance(best, points)
        };
    }

    createInitialPopulation(size, populationSize) {
        const population = [];
        
        for (let i = 0; i < populationSize; i++) {
            const route = [0]; // Começar sempre da origem
            const remaining = Array.from({ length: size - 1 }, (_, i) => i + 1);
            
            // Embaralhar os pontos restantes
            for (let j = remaining.length - 1; j > 0; j--) {
                const k = Math.floor(Math.random() * (j + 1));
                [remaining[j], remaining[k]] = [remaining[k], remaining[j]];
            }
            
            population.push(route.concat(remaining));
        }
        
        return population;
    }

    tournamentSelection(fitness, tournamentSize = 5) {
        const tournament = [];
        
        for (let i = 0; i < tournamentSize; i++) {
            const idx = Math.floor(Math.random() * fitness.length);
            tournament.push(fitness[idx]);
        }
        
        return tournament.reduce((best, current) => 
            current.fitness > best.fitness ? current : best
        );
    }

    orderCrossover(parent1, parent2) {
        const size = parent1.length;
        const start = Math.floor(Math.random() * size);
        const end = Math.floor(Math.random() * (size - start)) + start;
        
        const child = new Array(size).fill(-1);
        
        // Copiar segmento do parent1
        for (let i = start; i < end; i++) {
            child[i] = parent1[i];
        }
        
        // Preencher com genes do parent2
        let currentPos = end;
        for (let i = end; i < size + end; i++) {
            const gene = parent2[i % size];
            
            if (!child.includes(gene)) {
                child[currentPos % size] = gene;
                currentPos++;
            }
        }
        
        return child;
    }

    mutate(route) {
        const i = Math.floor(Math.random() * (route.length - 1)) + 1; // Não mutar origem
        const j = Math.floor(Math.random() * (route.length - 1)) + 1;
        
        [route[i], route[j]] = [route[j], route[i]];
    }
}

module.exports = RouteOptimizer;