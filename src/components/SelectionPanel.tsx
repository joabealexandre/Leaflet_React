import type { FarmFeature } from "../types/Farm";

type SelectionPanelProps = {
  features: FarmFeature[];
  selectedIds: string[];
  onToggleSelection: (farmId: string) => void;
  isLoading?: boolean;
  error?: string | null;
};

const formatArea = (area: number) => `${area.toFixed(2)} ha`;

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatRevenue = (revenue: number) => currencyFormatter.format(revenue);

const SelectionPanel = ({
  features,
  selectedIds,
  onToggleSelection,
  isLoading = false,
  error = null,
}: SelectionPanelProps) => {
  const hasFarms = features.length > 0;

  return (
    <aside className="selection-panel">
      <h1>Farms</h1>
      <p className="selection-panel__hint">
        Click a polygon or toggle an item to select it.
      </p>

      {isLoading && <p className="selection-panel__status">Loading farms…</p>}

      {error && (
        <p className="selection-panel__status selection-panel__status--error">
          {error}
        </p>
      )}

      {!isLoading && !hasFarms && !error && (
        <p className="selection-panel__status">No farms available.</p>
      )}

      {hasFarms && (
        <ul className="farms-list">
          {features.map((feature) => {
            const attributes = feature.properties;

            if (!attributes) {
              return null;
            }

            const { id, areaHectares, name, revenue } = attributes;
            const isSelected = selectedIds.includes(id);
            return (
              <li key={id}>
                <button
                  type="button"
                  className={`farm-button${
                    isSelected ? " farm-button--selected" : ""
                  }`}
                  aria-pressed={isSelected}
                  onClick={() => onToggleSelection(id)}
                  disabled={isLoading}
                >
                  <span className="farm-button__details">
                    <span className="farm-button__name">{name}</span>
                  </span>
                  <span className="farm-button__meta">
                    <span className="farm-button__number">#{id}</span>
                    <span className="farm-button__area">
                      {formatArea(areaHectares)}
                    </span>
                    <span className="farm-button__revenue">
                      {formatRevenue(revenue)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
};

export default SelectionPanel;
