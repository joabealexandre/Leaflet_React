import { cloneElement, useCallback, useEffect, useRef } from "react";
import L from "leaflet";
import type {
  GeoJSON as LeafletGeoJSON,
  Map as LeafletMap,
  Control as LeafletControl,
  PathOptions,
  Polygon,
  TileLayer,
} from "leaflet";
import type {
  FarmAttributes,
  FarmFeature,
  FarmFeatureCollection,
} from "../types/Farm";
import "leaflet/dist/leaflet.css";

type RGB = { r: number; g: number; b: number };

type MapViewProps = {
  collection: FarmFeatureCollection | null;
  selectedIds: string[];
  onToggleSelection: (farmId: string) => void;
};

const DEFAULT_FILL_COLOR = "#93c5fd";
const BORDER_COLOR = "#1e3a8a";
const SELECTED_BORDER_COLOR = "#c2410c";
const COLOR_STOPS: Array<{ value: number; color: string }> = [
  { value: 0, color: "#d9f99d" },
  { value: 0.33, color: "#84cc16" },
  { value: 0.66, color: "#65a30d" },
  { value: 1, color: "#3f6212" },
];

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatRevenue = (revenue: number) => currencyFormatter.format(revenue);

const hexToRgb = (hex: string): RGB => {
  const normalized = hex.replace("#", "");
  const bigint = parseInt(normalized, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
};

const rgbToHex = ({ r, g, b }: RGB): string => {
  const toHex = (value: number) => value.toString(16).padStart(2, "0");
  return `#${toHex(Math.round(r))}${toHex(Math.round(g))}${toHex(
    Math.round(b)
  )}`;
};

const interpolateValue = (start: number, end: number, ratio: number) =>
  start + (end - start) * ratio;

const interpolateColor = (start: RGB, end: RGB, ratio: number): RGB => ({
  r: interpolateValue(start.r, end.r, ratio),
  g: interpolateValue(start.g, end.g, ratio),
  b: interpolateValue(start.b, end.b, ratio),
});

const MapView = ({
  collection,
  selectedIds,
  onToggleSelection,
}: MapViewProps) => {
  const mapRef = useRef<LeafletMap | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const osmRef = useRef<TileLayer | null>(null);
  const polygonsRef = useRef<Map<string, Polygon>>(new Map());
  const farmInfoRef = useRef<Map<string, FarmAttributes>>(new Map());
  const geoJsonLayerRef = useRef<LeafletGeoJSON | null>(null);
  const legendControlRef = useRef<LeafletControl | null>(null);
  const revenueRangeRef = useRef<{ min: number; max: number } | null>(null);
  const selectedIdsRef = useRef<string[]>([]);

  const applyStyles = useCallback(() => {
    const selectedSet = new Set(selectedIdsRef.current);

    polygonsRef.current.forEach((polygon, id) => {
      const attributes = farmInfoRef.current.get(id);
      const fillColor = getFillColor(Number(attributes?.id));
      const isSelected = selectedSet.has(id);

      const baseStyle: PathOptions = {
        color: isSelected ? SELECTED_BORDER_COLOR : BORDER_COLOR,
        weight: isSelected ? 3 : 2,
        fillColor: isSelected ? SELECTED_BORDER_COLOR : fillColor,
        fillOpacity: isSelected ? 0.7 : 0.55,
      };

      polygon.setStyle(baseStyle);
    });
  }, []);

  const removeLegend = useCallback(() => {
    if (legendControlRef.current) {
      legendControlRef.current.remove();
      legendControlRef.current = null;
    }
  }, []);

  const renderLegend = useCallback(
    (minRevenue: number, maxRevenue: number) => {
      const mapInstance = mapRef.current;

      if (!mapInstance) {
        return;
      }

      removeLegend();

      const gradientStops = COLOR_STOPS.map(
        (stop) => `${stop.color} ${stop.value * 100}%`
      ).join(", ");

      const legendControl = new L.Control({
        position: "bottomright",
      }) as LeafletControl;
      legendControl.onAdd = () => {
        const div = L.DomUtil.create("div", "map-legend");
        div.innerHTML = `
        <h2 class="map-legend__title">Revenue</h2>
        <div class="map-legend__gradient" style="background: linear-gradient(90deg, ${gradientStops});"></div>
        <div class="map-legend__scale">
          <span>${formatRevenue(minRevenue)}</span>
          <span>${formatRevenue(maxRevenue)}</span>
        </div>
      `;
        return div;
      };

      legendControl.addTo(mapInstance);
      legendControlRef.current = legendControl;
    },
    [removeLegend]
  );

  const getFillColor = (revenue: number | null | undefined): string => {
    if (revenue == null) {
      return DEFAULT_FILL_COLOR;
    }

    const range = revenueRangeRef.current;
    if (!range) {
      return DEFAULT_FILL_COLOR;
    }

    const { min, max } = range;
    if (max <= min) {
      return COLOR_STOPS[COLOR_STOPS.length - 1]?.color ?? DEFAULT_FILL_COLOR;
    }

    const normalized = Math.min(Math.max((revenue - min) / (max - min), 0), 1);

    for (let index = 0; index < COLOR_STOPS.length - 1; index += 1) {
      const currentStop = COLOR_STOPS[index];
      const nextStop = COLOR_STOPS[index + 1];
      if (normalized <= nextStop.value) {
        const localRatio =
          (normalized - currentStop.value) /
          (nextStop.value - currentStop.value || 1);
        const startRgb = hexToRgb(currentStop.color);
        const endRgb = hexToRgb(nextStop.color);
        return rgbToHex(interpolateColor(startRgb, endRgb, localRatio));
      }
    }

    return COLOR_STOPS[COLOR_STOPS.length - 1]?.color ?? DEFAULT_FILL_COLOR;
  };

  const getCentroides = useCallback((collection: FarmFeatureCollection) => {
    const markers = collection.features
      .filter(
        (f) =>
          f &&
          f.properties &&
          !!f.properties.centroid_x &&
          !!f.properties.centroid_y
      )
      .map((f) => {
        const farm = f.properties;

        return L.marker([f.properties.centroid_y, f.properties.centroid_x], {
          title: farm.id ?? "",
        });
      });

    return L.layerGroup(markers);
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const mapInstance = L.map(containerRef.current, {
      zoomControl: true,
    }).setView([-15.9588957227258, -47.76274395562098], 15);

    mapRef.current = mapInstance;

    osmRef.current = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }
    ).addTo(mapRef.current);

    return () => {
      if (legendControlRef.current) {
        legendControlRef.current.remove();
        legendControlRef.current = null;
      }
      mapInstance.remove();
      mapRef.current = null;
      polygonsRef.current.clear();
      geoJsonLayerRef.current = null;
      farmInfoRef.current.clear();
      revenueRangeRef.current = null;
    };
  }, []);

  useEffect(() => {
    const mapInstance = mapRef.current;

    if (!mapInstance) {
      return;
    }

    if (geoJsonLayerRef.current) {
      mapInstance.removeLayer(geoJsonLayerRef.current);
      geoJsonLayerRef.current = null;
    }

    polygonsRef.current.clear();
    farmInfoRef.current.clear();

    if (!collection || collection.features.length === 0) {
      revenueRangeRef.current = null;
      removeLegend();
      return;
    }

    const nextPolygonsRef = new Map<string, Polygon>();
    const revenueValues: number[] = [];

    const geoJsonLayer = L.geoJSON(collection, {
      style: {
        color: BORDER_COLOR,
        weight: 2,
        fillColor: DEFAULT_FILL_COLOR,
        fillOpacity: 0.55,
      },
      onEachFeature: (feature, layer) => {
        const farm = (feature as FarmFeature).properties;
        if (!farm) {
          return;
        }

        farmInfoRef.current.set(farm.id, farm);
        const id = Number(farm.id);
        if (typeof id === "number") {
          revenueValues.push(id);
        }

        const polygonLayer = layer as Polygon;

        polygonLayer.on("click", () => {
          onToggleSelection(farm.id);
        });

        polygonLayer.bindTooltip(String(farm.id), {
          permanent: true,
          direction: "center",
          className: "polygon-label",
        });

        nextPolygonsRef.set(farm.id, polygonLayer);
      },
    });

    geoJsonLayer.addTo(mapInstance);
    geoJsonLayerRef.current = geoJsonLayer;
    polygonsRef.current = nextPolygonsRef;

    const centroids = getCentroides(collection).addTo(mapInstance);

    if (!osmRef.current) return;

    L.control
      .layers(
        { OpenStreetMap: osmRef.current },
        { Polygons: geoJsonLayerRef.current, Centroids: centroids },
        { collapsed: false }
      )
      .addTo(mapInstance);

    if (revenueValues.length > 0) {
      const minRevenue = Math.min(...revenueValues);
      const maxRevenue = Math.max(...revenueValues);
      revenueRangeRef.current = { min: minRevenue, max: maxRevenue };
      renderLegend(minRevenue, maxRevenue);
    } else {
      revenueRangeRef.current = null;
      removeLegend();
    }

    const bounds = geoJsonLayer.getBounds();
    if (bounds.isValid()) {
      mapInstance.fitBounds(bounds, { padding: [20, 20] });
    }

    applyStyles();

    return () => {
      mapInstance.removeLayer(geoJsonLayer);
      geoJsonLayerRef.current = null;
      polygonsRef.current.clear();
      farmInfoRef.current.clear();
    };
  }, [collection, onToggleSelection, applyStyles, renderLegend, removeLegend]);

  useEffect(() => {
    selectedIdsRef.current = selectedIds;
    applyStyles();
  }, [selectedIds, applyStyles]);

  return (
    <section className="map-panel">
      <div ref={containerRef} className="map-container" />
    </section>
  );
};

export default MapView;
