/* eslint-disable @typescript-eslint/no-explicit-any */
declare module 'leaflet' {
  export function map(id: string, options?: any): any;
  export function tileLayer(url: string, options?: any): any;
  export function marker(latlng: [number, number], options?: any): any;
  export function geoJSON(data: any, options?: any): any;
  export function polygon(latlngs: any[], options?: any): any;
  export function polyline(latlngs: any[], options?: any): any;
  export function divIcon(options: any): any;
  export namespace control {
    function zoom(options?: any): any;
  }
}

declare module 'leaflet/dist/leaflet.css';
