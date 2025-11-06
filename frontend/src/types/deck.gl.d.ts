/**
 * deck.gl TypeScript Type Declarations
 * Extends deck.gl types for forecastin polygon/linestring visualization
 * Following architecture spec from POLYGON_LINESTRING_ARCHITECTURE.md
 */

declare module '@deck.gl/core' {
  export interface Layer<PropsT = any> {
    id: string;
    props: PropsT;
    context: any;
    state: any;
    internalState: any;
    lifecycle: string;
    
    initializeState(): void;
    updateState(params: {
      props: PropsT;
      oldProps: PropsT;
      changeFlags: any;
      context: any;
    }): void;
    finalizeState(): void;
    draw(params: { uniforms: any }): void;
    getPickingInfo(params: { info: any; mode: string }): any;
    
    setState(state: Partial<any>): void;
    setChangeFlags(changeFlags: any): void;
    setNeedsRedraw(redraw?: boolean): void;
  }

  export interface LayerProps {
    id: string;
    data: any[];
    visible?: boolean;
    opacity?: number;
    pickable?: boolean;
    onClick?: (info: any, event: any) => void;
    onHover?: (info: any, event: any) => void;
    updateTriggers?: Record<string, any>;
    transitions?: Record<string, number>;
    extensions?: any[];
    parameters?: Record<string, any>;
  }

  export interface Color {
    r: number;
    g: number;
    b: number;
    a?: number;
  }

  export type RGBAColor = [number, number, number, number?];
  export type Position = [number, number, number?];
  export type Accessor<DataT, ReturnT> = ReturnT | ((d: DataT, info: { index: number; target: number[] }) => ReturnT);
}

declare module '@deck.gl/layers' {
  import { Layer, LayerProps, RGBAColor, Position, Accessor } from '@deck.gl/core';

  export interface ScatterplotLayerProps<DataT = any> extends LayerProps {
    data: DataT[];
    getPosition: Accessor<DataT, Position>;
    getFillColor?: Accessor<DataT, RGBAColor>;
    getRadius?: Accessor<DataT, number>;
    radiusUnits?: 'meters' | 'pixels';
    radiusScale?: number;
    radiusMinPixels?: number;
    radiusMaxPixels?: number;
    stroked?: boolean;
    filled?: boolean;
    getLineColor?: Accessor<DataT, RGBAColor>;
    lineWidthUnits?: 'meters' | 'pixels';
    lineWidthScale?: number;
    lineWidthMinPixels?: number;
    lineWidthMaxPixels?: number;
  }

  export class ScatterplotLayer<DataT = any, PropsT extends ScatterplotLayerProps<DataT> = ScatterplotLayerProps<DataT>> extends Layer<PropsT> {
    constructor(props: PropsT);
  }

  export interface SolidPolygonLayerProps<DataT = any> extends LayerProps {
    data: DataT[];
    getPolygon: Accessor<DataT, Position[] | Position[][]>;
    getFillColor?: Accessor<DataT, RGBAColor>;
    getLineColor?: Accessor<DataT, RGBAColor>;
    getLineWidth?: Accessor<DataT, number>;
    getElevation?: Accessor<DataT, number>;
    extruded?: boolean;
    wireframe?: boolean;
    filled?: boolean;
    stroked?: boolean;
    elevationScale?: number;
    lineWidthUnits?: 'meters' | 'pixels';
    lineWidthScale?: number;
    lineWidthMinPixels?: number;
    lineWidthMaxPixels?: number;
  }

  export class SolidPolygonLayer<DataT = any, PropsT extends SolidPolygonLayerProps<DataT> = SolidPolygonLayerProps<DataT>> extends Layer<PropsT> {
    constructor(props: PropsT);
  }

  export interface PathLayerProps<DataT = any> extends LayerProps {
    data: DataT[];
    getPath: Accessor<DataT, Position[]>;
    getColor?: Accessor<DataT, RGBAColor>;
    getWidth?: Accessor<DataT, number>;
    widthUnits?: 'meters' | 'pixels';
    widthScale?: number;
    widthMinPixels?: number;
    widthMaxPixels?: number;
    jointRounded?: boolean;
    capRounded?: boolean;
    miterLimit?: number;
    billboard?: boolean;
  }

  export class PathLayer<DataT = any, PropsT extends PathLayerProps<DataT> = PathLayerProps<DataT>> extends Layer<PropsT> {
    constructor(props: PropsT);
  }
}

declare module '@deck.gl/geo-layers' {
  import { Layer, LayerProps, RGBAColor, Position, Accessor } from '@deck.gl/core';
  import { Feature, FeatureCollection, Geometry } from 'geojson';

  export interface GeoJsonLayerProps<DataT = Feature | FeatureCollection> extends LayerProps {
    data: DataT;
    filled?: boolean;
    stroked?: boolean;
    extruded?: boolean;
    wireframe?: boolean;
    
    // Point styling
    pointType?: 'circle' | 'icon' | 'text';
    pointRadiusUnits?: 'meters' | 'pixels';
    pointRadiusScale?: number;
    pointRadiusMinPixels?: number;
    pointRadiusMaxPixels?: number;
    getPointRadius?: Accessor<Feature, number>;
    
    // Fill styling
    getFillColor?: Accessor<Feature, RGBAColor>;
    
    // Line styling
    getLineColor?: Accessor<Feature, RGBAColor>;
    getLineWidth?: Accessor<Feature, number>;
    lineWidthUnits?: 'meters' | 'pixels';
    lineWidthScale?: number;
    lineWidthMinPixels?: number;
    lineWidthMaxPixels?: number;
    
    // Elevation
    getElevation?: Accessor<Feature, number>;
    elevationScale?: number;
  }

  export class GeoJsonLayer<DataT = Feature | FeatureCollection, PropsT extends GeoJsonLayerProps<DataT> = GeoJsonLayerProps<DataT>> extends Layer<PropsT> {
    constructor(props: PropsT);
  }
}

declare module 'h3-js' {
  export function h3ToGeo(h3Index: string): [number, number];
  export function geoToH3(lat: number, lng: number, resolution: number): string;
  export function h3ToGeoBoundary(h3Index: string, formatAsGeoJson?: boolean): number[][];
  export function kRing(h3Index: string, ringSize: number): string[];
  export function hexRing(h3Index: string, ringSize: number): string[];
  export function polyfill(coordinates: number[][], resolution: number, isGeoJson?: boolean): string[];
  export function h3SetToMultiPolygon(h3Indexes: string[], formatAsGeoJson?: boolean): number[][][][];
  export function compact(h3Set: string[]): string[];
  export function uncompact(compactedSet: string[], resolution: number): string[];
  export function h3GetResolution(h3Index: string): number;
  export function h3Distance(origin: string, destination: string): number;
  export function experimentalH3ToLocalIj(origin: string, destination: string): { i: number; j: number };
  export function experimentalLocalIjToH3(origin: string, coords: { i: number; j: number }): string;
}

declare module 'react-map-gl' {
  import { ReactNode, CSSProperties, RefObject } from 'react';
  import { MapboxMap, MapboxEvent } from 'mapbox-gl';

  export interface ViewState {
    longitude: number;
    latitude: number;
    zoom: number;
    pitch?: number;
    bearing?: number;
    padding?: {
      top: number;
      bottom: number;
      left: number;
      right: number;
    };
  }

  export interface MapProps {
    id?: string;
    mapboxAccessToken?: string;
    mapStyle?: string | object;
    viewState?: Partial<ViewState>;
    initialViewState?: Partial<ViewState>;
    onMove?: (evt: { viewState: ViewState }) => void;
    onMoveStart?: (evt: { viewState: ViewState }) => void;
    onMoveEnd?: (evt: { viewState: ViewState }) => void;
    onLoad?: (evt: { target: MapboxMap }) => void;
    onError?: (evt: MapboxEvent) => void;
    onClick?: (evt: any) => void;
    onDblClick?: (evt: any) => void;
    onMouseMove?: (evt: any) => void;
    onMouseEnter?: (evt: any) => void;
    onMouseLeave?: (evt: any) => void;
    onWheel?: (evt: any) => void;
    onResize?: (evt: any) => void;
    onRender?: (evt: any) => void;
    onRemove?: (evt: any) => void;
    
    cursor?: string;
    style?: CSSProperties;
    children?: ReactNode;
    ref?: RefObject<any>;
    
    // Interaction options
    interactive?: boolean;
    attributionControl?: boolean;
    customAttribution?: string | string[];
    
    // Camera options
    minZoom?: number;
    maxZoom?: number;
    minPitch?: number;
    maxPitch?: number;
    maxBounds?: [[number, number], [number, number]];
    
    // Fog and terrain
    fog?: object;
    terrain?: object;
    
    // Cooperative gestures
    cooperativeGestures?: boolean;
    
    // RTL text plugin
    rtlTextPlugin?: string;
    
    // Locale
    locale?: object;
    
    // Rendering options
    antialias?: boolean;
    refreshExpiredTiles?: boolean;
    transformRequest?: (url: string, resourceType: string) => { url: string; headers?: object };
    
    // Performance
    workerCount?: number;
    maxParallelImageRequests?: number;
    maxTileCacheSize?: number;
  }

  export function Map(props: MapProps): JSX.Element;

  export interface DeckGLOverlayProps {
    layers?: any[];
    effects?: any[];
    pickingRadius?: number;
    useDevicePixels?: boolean | number;
    parameters?: object;
    glOptions?: object;
    interleaved?: boolean;
  }

  export function DeckGLOverlay(props: DeckGLOverlayProps): JSX.Element;

  export interface NavigationControlProps {
    showCompass?: boolean;
    showZoom?: boolean;
    visualizePitch?: boolean;
    style?: CSSProperties;
    position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  }

  export function NavigationControl(props?: NavigationControlProps): JSX.Element;

  export interface FullscreenControlProps {
    containerId?: string;
    style?: CSSProperties;
    position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  }

  export function FullscreenControl(props?: FullscreenControlProps): JSX.Element;

  export interface GeolocateControlProps {
    positionOptions?: PositionOptions;
    fitBoundsOptions?: object;
    trackUserLocation?: boolean;
    showAccuracyCircle?: boolean;
    showUserLocation?: boolean;
    style?: CSSProperties;
    position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  }

  export function GeolocateControl(props?: GeolocateControlProps): JSX.Element;

  export interface ScaleControlProps {
    maxWidth?: number;
    unit?: 'imperial' | 'metric' | 'nautical';
    style?: CSSProperties;
    position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  }

  export function ScaleControl(props?: ScaleControlProps): JSX.Element;

  export interface MarkerProps {
    longitude: number;
    latitude: number;
    anchor?: 'center' | 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    offset?: [number, number];
    style?: CSSProperties;
    draggable?: boolean;
    rotation?: number;
    rotationAlignment?: 'map' | 'viewport' | 'auto';
    pitchAlignment?: 'map' | 'viewport' | 'auto';
    onClick?: (evt: any) => void;
    onDragStart?: (evt: any) => void;
    onDrag?: (evt: any) => void;
    onDragEnd?: (evt: any) => void;
    children?: ReactNode;
  }

  export function Marker(props: MarkerProps): JSX.Element;

  export interface PopupProps {
    longitude: number;
    latitude: number;
    anchor?: 'center' | 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    offset?: number | [number, number] | object;
    style?: CSSProperties;
    className?: string;
    maxWidth?: string;
    closeButton?: boolean;
    closeOnClick?: boolean;
    closeOnMove?: boolean;
    focusAfterOpen?: boolean;
    onClose?: () => void;
    children?: ReactNode;
  }

  export function Popup(props: PopupProps): JSX.Element;

  export interface SourceProps {
    id: string;
    type: 'vector' | 'raster' | 'raster-dem' | 'geojson' | 'image' | 'video' | 'canvas';
    [key: string]: any;
  }

  export function Source(props: SourceProps & { children?: ReactNode }): JSX.Element;

  export interface LayerProps {
    id: string;
    type: string;
    source?: string;
    'source-layer'?: string;
    beforeId?: string;
    minzoom?: number;
    maxzoom?: number;
    filter?: any[];
    layout?: object;
    paint?: object;
  }

  export function Layer(props: LayerProps): JSX.Element;

  export { MapboxMap, MapboxEvent };
}