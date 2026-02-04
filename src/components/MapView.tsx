import { useCallback, useEffect, useRef } from "react";
import L from "leaflet";
import type {
  GeoJSON as LeafletGeoJSON,
  Map as LeafletMap,
  Control as LeafletControl,
  PathOptions,
  Polygon,
  LayerGroup,
  Marker,
  LatLngBounds,
} from "leaflet";
import type {
  FarmAttributes,
  FarmFeature,
  FarmFeatureCollection,
} from "../types/farm";
import type { WindVector } from "../mocks/wind";
import { fetchWindVectors } from "../services/WindService";
import { hexToRgb, rgbToHex } from "./../shared/utils/colorUtils";
import type { RGB } from "./../shared/utils/colorUtils";
import "leaflet/dist/leaflet.css";

type MapViewProps = {
  collection: FarmFeatureCollection | null;
  selectedIds: string[];
  onToggleSelection: (farmId: string) => void;
};

const LEGEND_OPACITY = 0.7;
const DEFAULT_FILL_COLOR = "#93c5fd";
const BORDER_COLOR = "#1e3a8a";
const SELECTED_BORDER_COLOR = "#c2410c";
const COLOR_STOPS: Array<{ value: number; color: string }> = [
  { value: 0, color: "#DBEAFE" },
  { value: 2, color: "#93C5FD" },
  { value: 4, color: "#3B82F6" },
  { value: 8, color: "#1D4ED8" },
  { value: 11, color: "#1E3A8A" },
];

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
  const polygonsRef = useRef<Map<string, Polygon>>(new Map());
  const centroidsRef = useRef<Map<string, Marker>>(new Map());
  const farmInfoRef = useRef<Map<string, FarmAttributes>>(new Map());
  const geoJsonLayerRef = useRef<LeafletGeoJSON | null>(null);
  const centroidsLayerRef = useRef<LayerGroup | null>(null);
  const legendControlRef = useRef<LeafletControl | null>(null);
  const legendValueRangeRef = useRef<{ min: number; max: number } | null>(null);
  const layersControlRef = useRef<LeafletControl.Layers | null>(null);
  const dynamicLayerRef = useRef<LayerGroup | null>(null);
  const windLegendRef = useRef<LeafletControl | null>(null);
  const farmWindLayerRef = useRef<LayerGroup | null>(null);
  const labelToggleControlRef = useRef<LeafletControl | null>(null);
  const selectedIdsRef = useRef<string[]>([]);
  const windVectorsRef = useRef<WindVector[]>([]);
  const boundsRef = useRef<LatLngBounds | null>(null);
  const showLabelsRef = useRef<boolean>(true);

  const applyStyles = useCallback(() => {
    const selectedSet = new Set(selectedIdsRef.current);

    polygonsRef.current.forEach((polygon, id) => {
      const attributes = farmInfoRef.current.get(id);
      const fillColor = getFillColor(attributes?.weather?.precipitation);
      const isSelected = selectedSet.has(id);

      const baseStyle: PathOptions = {
        color: isSelected ? SELECTED_BORDER_COLOR : BORDER_COLOR,
        weight: isSelected ? 3 : 2,
        fillColor: isSelected ? SELECTED_BORDER_COLOR : fillColor,
        fillOpacity: isSelected ? 0.7 : LEGEND_OPACITY,
      };

      polygon.setStyle(baseStyle);
    });
  }, []);

  const applyLabelVisibility = useCallback(() => {
    polygonsRef.current.forEach((polygon) => {
      const tip = polygon.getTooltip();
      const el = tip?.getElement();
      if (!el) return;
      el.style.display = showLabelsRef.current ? "block" : "none";
    });
  }, []);

  const removeLegend = useCallback(() => {
    if (legendControlRef.current) {
      legendControlRef.current.remove();
      legendControlRef.current = null;
    }
  }, []);

  const removeWindLegend = useCallback(() => {
    if (windLegendRef.current) {
      windLegendRef.current.remove();
      windLegendRef.current = null;
    }
  }, []);

  const renderLegend = useCallback(
    (minValue: number, maxValue: number, title: string = "Legend") => {
      const mapInstance = mapRef.current;

      if (!mapInstance) return;

      removeLegend();

      const domainSpan = Math.max(0.00001, maxValue - minValue);

      const toPercentage = (v: number) =>
        Math.min(100, Math.max(0, ((v - minValue) / domainSpan) * 100));

      const gradientStops = COLOR_STOPS.map((s) => {
        const pct = toPercentage(s.value);
        return `${s.color.trim()} ${pct.toFixed(3)}%`;
      }).join(", ");

      const legendControl = new L.Control({
        position: "bottomright",
      }) as LeafletControl;

      legendControl.onAdd = () => {
        const div = L.DomUtil.create("div", "map-legend");

        div.innerHTML = `
        <h2 class="map-legend__title">${title}</h2>
        <div class="map-legend__gradient" style="background: linear-gradient(90deg, ${gradientStops}); opacity: ${LEGEND_OPACITY};"></div>
        <div class="map-legend__scale">
          <span>${minValue}</span>
          <span>${maxValue}</span>
        </div>
        <div class="map-legend__notes">         
          <div class="map-legend__swatch" style="background:#C2410C;"></div>
          <span>Selecionado</span>
        </div>
      `;
        return div;
      };

      legendControl.addTo(mapInstance);
      legendControlRef.current = legendControl;
    },
    [removeLegend]
  );

  const getFillColor = (value: number | null | undefined): string => {
    if (value == null) {
      return DEFAULT_FILL_COLOR;
    }

    const range = legendValueRangeRef.current;
    if (!range) {
      return DEFAULT_FILL_COLOR;
    }

    const { min, max } = range;
    if (max <= min) {
      return COLOR_STOPS[COLOR_STOPS.length - 1]?.color ?? DEFAULT_FILL_COLOR;
    }

    let upperIdx = 1;
    while (upperIdx < COLOR_STOPS.length && value > COLOR_STOPS[upperIdx].value)
      upperIdx++;

    const lowerIdx = upperIdx - 1;

    const lower = COLOR_STOPS[lowerIdx];
    const upper = COLOR_STOPS[upperIdx];

    const span = upper.value - lower.value;
    const ratio = span === 0 ? 0 : (value - lower.value) / span;

    const start = hexToRgb(lower.color);
    const end = hexToRgb(upper.color);
    const rgb = interpolateColor(start, end, ratio);

    return rgbToHex(rgb);
  };

  const makeWindArrowIcon = (headingDeg: number) => {
    const heading = ((headingDeg ?? 0) % 360 + 360) % 360;
    return L.divIcon({
      className: "wind-arrow",
      html: `
        <svg width="18" height="18" viewBox="0 0 24 24" style="transform: rotate(${heading}deg); transform-origin: 50% 50%;">
          <path d="M12 2l4 7h-3v9h-2v-9H8l4-7z" fill="black" />
        </svg>
      `,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
  };

  const renderWindOverlay = useCallback(
    () => {
      const mapInstance = mapRef.current;
      const layersControl = layersControlRef.current;
      if (!mapInstance || !layersControl) return;

      if (dynamicLayerRef.current) {
        mapInstance.removeLayer(dynamicLayerRef.current);
        layersControl.removeLayer(dynamicLayerRef.current);
        dynamicLayerRef.current = null;
      }
      removeWindLegend();

      const vectors = windVectorsRef.current;
      if (!vectors.length) return;

      const markers = vectors.map((v) =>
        L.marker([v.lat, v.lon], {
          icon: makeWindArrowIcon(v.directionDeg),
          interactive: false,
        }).bindTooltip(`${v.speedKmh.toFixed(0)} km/h`, {
          permanent: false,
          direction: "top",
          offset: [0, -10],
          className: "wind-tooltip",
        })
      );

      const layerGroup = L.layerGroup(markers);
      layerGroup.addTo(mapInstance);
      layersControl.addOverlay(layerGroup, "Wind");

      dynamicLayerRef.current = layerGroup;
    },
    [removeWindLegend]
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const mapInstance = L.map(containerRef.current, {
      zoomControl: true,
    }).setView([-15.9588957227258, -47.76274395562098], 15);
    mapRef.current = mapInstance;

    const osm = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }
    ).addTo(mapRef.current);

    const satellite = L.tileLayer(
      "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
      {
        attribution: "Map data &copy; OpenTopoMap contributors",
      }
    ).addTo(mapRef.current);

    const baseLayers = {
      OpenStreetMap: osm,
      Topo: satellite,
    };

    const layersControl = L.control.layers(baseLayers, {}, { collapsed: true });
    layersControl.addTo(mapInstance);
    layersControlRef.current = layersControl;

    const labelToggleControl = new L.Control({
      position: "topright",
    }) as LeafletControl;

    labelToggleControl.onAdd = () => {
      const container = L.DomUtil.create(
        "div",
        "map-label-toggle leaflet-bar"
      );
      container.innerHTML = `
        <label class="map-label-toggle__label">
          <input type="checkbox" ${showLabelsRef.current ? "checked" : ""} aria-label="Toggle farm labels" />
          Labels
        </label>
      `;
      const checkbox = container.querySelector("input");
      checkbox?.addEventListener("change", (evt) => {
        const checked = (evt.target as HTMLInputElement).checked;
        showLabelsRef.current = checked;
        applyLabelVisibility();
      });
      return container;
    };

    labelToggleControl.addTo(mapInstance);
    labelToggleControlRef.current = labelToggleControl;

    return () => {
      if (legendControlRef.current) {
        legendControlRef.current.remove();
        legendControlRef.current = null;
      }
      if (windLegendRef.current) {
        windLegendRef.current.remove();
        windLegendRef.current = null;
      }
      mapInstance.remove();
      mapRef.current = null;
      polygonsRef.current.clear();
      geoJsonLayerRef.current = null;
      farmInfoRef.current.clear();
      legendValueRangeRef.current = null;
      layersControl.remove();
      layersControlRef.current = null;
      dynamicLayerRef.current = null;
      boundsRef.current = null;
      farmWindLayerRef.current = null;
      if (labelToggleControlRef.current) {
        labelToggleControlRef.current.remove();
        labelToggleControlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const mapInstance = mapRef.current;
    const layersControl = layersControlRef.current;

    if (!mapInstance || !layersControl) return;

    if (dynamicLayerRef.current) {
      mapInstance.removeLayer(dynamicLayerRef.current);
      layersControl.removeLayer(dynamicLayerRef.current);
      dynamicLayerRef.current = null;
    }
    removeWindLegend();
    if (farmWindLayerRef.current) {
      mapInstance.removeLayer(farmWindLayerRef.current);
      layersControl.removeLayer(farmWindLayerRef.current);
      farmWindLayerRef.current = null;
    }

    if (geoJsonLayerRef.current) {
      mapInstance.removeLayer(geoJsonLayerRef.current);
      geoJsonLayerRef.current = null;
    }

    polygonsRef.current.clear();
    farmInfoRef.current.clear();

    if (!collection || collection.features.length === 0) {
      legendValueRangeRef.current = null;
      removeLegend();
      return;
    }

    const nextPolygonsRef = new Map<string, Polygon>();
    const nextCentroidsRef = new Map<string, Marker>();
    const legendValues: number[] = [];

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
        if (typeof farm.weather?.precipitation === "number") {
          legendValues.push(farm.weather?.precipitation);
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
        if (!showLabelsRef.current) {
          const tip = polygonLayer.getTooltip();
          const el = tip?.getElement();
          if (el) el.style.display = "none";
        }

        nextPolygonsRef.set(farm.id, polygonLayer);

        const centroid = polygonLayer.getBounds().getCenter();
        const marker = L.marker([centroid.lat, centroid.lng]).bindPopup(
          farm.id
        );
        nextCentroidsRef.set(farm.id, marker);
      },
    });

    geoJsonLayer.addTo(mapInstance);
    geoJsonLayerRef.current = geoJsonLayer;

    const centroidsLayer = L.layerGroup(Array.from(nextCentroidsRef.values()));
    centroidsLayer.addTo(mapInstance);
    centroidsLayerRef.current = centroidsLayer;

    layersControl.addOverlay(geoJsonLayer, "Farms");
    layersControl.addOverlay(centroidsLayer, "Centroids");

    const farmWindMarkers: Marker[] = [];
    nextPolygonsRef.forEach((polygon, farmId) => {
      const farm = farmInfoRef.current.get(farmId);
      const direction = farm?.weather?.windDirectionDeg;
      if (direction == null) return;
      const center = polygon.getBounds().getCenter();
      const marker = L.marker([center.lat, center.lng], {
        icon: makeWindArrowIcon(direction),
        interactive: false,
      });
      farmWindMarkers.push(marker);
    });

    if (farmWindMarkers.length) {
      const farmWindLayer = L.layerGroup(farmWindMarkers);
      farmWindLayer.addTo(mapInstance);
      layersControl.addOverlay(farmWindLayer, "Farm Wind");
      farmWindLayerRef.current = farmWindLayer;
    }

    polygonsRef.current = nextPolygonsRef;
    centroidsRef.current = nextCentroidsRef;
    applyLabelVisibility();

    if (legendValues.length > 0) {
      const minValue = Math.min(...legendValues);
      const maxValue = Math.max(...legendValues);
      legendValueRangeRef.current = { min: minValue, max: maxValue };
      renderLegend(minValue, maxValue, "Precipitation");
    } else {
      legendValueRangeRef.current = null;
      removeLegend();
    }

    // Fit bounds
    const bounds = geoJsonLayer.getBounds();
    if (bounds.isValid()) {
      mapInstance.fitBounds(bounds, { padding: [20, 20] });
      boundsRef.current = bounds;
      renderWindOverlay();
    }

    applyStyles();

    return () => {
      mapInstance.removeLayer(geoJsonLayer);
      if (centroidsLayerRef.current) {
        mapInstance.removeLayer(centroidsLayerRef.current);
      }
      if (farmWindLayerRef.current) {
        mapInstance.removeLayer(farmWindLayerRef.current);
        layersControl.removeLayer(farmWindLayerRef.current);
        farmWindLayerRef.current = null;
      }
      if (dynamicLayerRef.current) {
        mapInstance.removeLayer(dynamicLayerRef.current);
        layersControl.removeLayer(dynamicLayerRef.current);
      }
      removeWindLegend();
      geoJsonLayerRef.current = null;
      centroidsLayerRef.current = null;
      polygonsRef.current.clear();
      farmInfoRef.current.clear();
      layersControlRef.current = null;
      dynamicLayerRef.current = null;
      boundsRef.current = null;
    };
  }, [
    collection,
    onToggleSelection,
    applyStyles,
    renderLegend,
    removeLegend,
    renderWindOverlay,
    removeWindLegend,
  ]);

  useEffect(() => {
    selectedIdsRef.current = selectedIds;
    applyStyles();
  }, [selectedIds, applyStyles]);

  useEffect(() => {
    let isMounted = true;

    const loadWind = async () => {
      try {
        const vectors = await fetchWindVectors();
        if (!isMounted) return;
        windVectorsRef.current = vectors;
        if (boundsRef.current) {
          renderWindOverlay();
        }
      } catch (err) {
        console.error("Failed to load wind vectors", err);
      }
    };

    void loadWind();

    return () => {
      isMounted = false;
    };
  }, [renderWindOverlay]);

  return (
    <section className="map-panel">
      <div ref={containerRef} className="map-container" />
    </section>
  );
};

export default MapView;
