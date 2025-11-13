const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const formatCurrency = (currency: number) =>
  currencyFormatter.format(currency);

export const formatArea = (area: number) => `${area.toFixed(2)} ha`;
