export const SHAPES: string[];
export const FORMATS: {
    '.geojson': string[];
    '.json': string[];
    '.topojson': string[];
    '.zip': string[];
    '.kml': string[];
    '.kmz': string[];
    '.gpx': string[];
    '.gpkg': string[];
    '.fgb': string[];
};
export namespace UNITS {
    let km: number;
    let m: number;
    let mi: number;
}
export const TOOLS: ({
    id: string;
    label: string;
    hint: string;
    fields: ({
        key: string;
        label: string;
        shapes: string[];
        type?: undefined;
        initial?: undefined;
        options?: undefined;
    } | {
        key: string;
        label: string;
        type: string;
        initial: number;
        shapes?: undefined;
        options?: undefined;
    } | {
        key: string;
        label: string;
        options: string[];
        initial: string;
        shapes?: undefined;
        type?: undefined;
    } | {
        key: string;
        label: string;
        type: string;
        initial: boolean;
        shapes?: undefined;
        options?: undefined;
    })[];
} | {
    id: string;
    label: string;
    hint: string;
    fields: ({
        key: string;
        label: string;
        shapes: string[];
        fieldOf?: undefined;
        initial?: undefined;
    } | {
        key: string;
        label: string;
        fieldOf: string;
        initial: string;
        shapes?: undefined;
    })[];
} | {
    id: string;
    label: string;
    hint: string;
    fields: ({
        key: string;
        label: string;
        shapes: string[];
        sameShapeAs?: undefined;
    } | {
        key: string;
        label: string;
        sameShapeAs: string;
        shapes?: undefined;
    })[];
})[];
