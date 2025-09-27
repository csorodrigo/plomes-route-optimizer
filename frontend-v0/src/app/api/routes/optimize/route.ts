import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { origin, waypoints } = body;

    // Simulacao basica de otimizacao de rota
    const response = {
      totalDistance: 15.5,
      estimatedTime: 45,
      waypoints: [
        { name: 'Origem', lat: origin.lat, lng: origin.lng, isOrigin: true },
        ...waypoints.map((w: any, i: number) => ({
          id: w.id || `waypoint-${i}`,
          name: w.name || `Ponto ${i + 1}`,
          lat: w.lat,
          lng: w.lng
        }))
      ],
      polyline: 'mock_polyline_string',
      realRoute: {
        distance: { text: '15.5 km', value: 15500 },
        duration: { text: '45 min', value: 2700 },
        coordinates: [[origin.lng, origin.lat], ...waypoints.map((w: any) => [w.lng, w.lat])],
        decodedPath: [{ lat: origin.lat, lng: origin.lng }, ...waypoints],
        polyline: 'mock_polyline_string',
        fallback: false
      }
    };

    return NextResponse.json({ success: true, route: response });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Erro ao otimizar rota' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}