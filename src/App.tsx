import { useCallback, useEffect, useMemo, useState } from "react";
import MapView from "./components/MapView";
import SelectionPanel from "./components/SelectionPanel";
import { fetchFarms } from "./services/FarmService";
import type { FarmFeatureCollection } from "./types/Farm";
import "./App.css";

const FALLBACK_ERROR_MESSAGE = "Unable to load properties.";

function App() {
  const [farmCollection, setFarmCollection] =
    useState<FarmFeatureCollection | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadFarms = async () => {
      try {
        if (!isMounted) return;

        const farms = await fetchFarms();
        if (!isMounted) return;

        setFarmCollection(farms);
        setError(null);
      } catch (error: unknown) {
        if (!isMounted) return;

        const errorMsg =
          error instanceof Error ? error.message : FALLBACK_ERROR_MESSAGE;

        setError(errorMsg);
        setFarmCollection(null);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadFarms();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!farmCollection) {
      return;
    }

    const ids = farmCollection.features.map(
      (feature) => feature.properties?.id
    );

    // setSelectedIds(ids);
  }, [farmCollection]);

  const farmFeatures = useMemo(
    () => farmCollection?.features ?? [],
    [farmCollection]
  );

  const toggleSelection = useCallback((farmId: string) => {
    setSelectedIds((current) =>
      current.includes(farmId)
        ? current.filter((id) => id !== farmId)
        : [...current, farmId]
    );
  }, []);

  return (
    <div className="app-layout">
      <MapView
        selectedIds={selectedIds}
        collection={farmCollection}
        onToggleSelection={toggleSelection}
      />
      <SelectionPanel
        selectedIds={selectedIds}
        features={farmFeatures}
        onToggleSelection={toggleSelection}
        isLoading={isLoading}
        error={error}
      />
    </div>
  );
}

export default App;
