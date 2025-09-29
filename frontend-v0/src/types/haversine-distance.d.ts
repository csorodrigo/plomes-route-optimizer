declare module 'haversine-distance' {
  interface Point {
    latitude: number;
    longitude: number;
  }
  function haversineDistance(a: Point, b: Point): number;
  export default haversineDistance;
}