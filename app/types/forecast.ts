export interface Metric {
  MAE: number;
  RMSE: number;
  R2: number;
  // primary metric — berbeda per variabel
  sMAPE?: number;
  CircularMAE?: number;
  CircularMAE_pct?: number;
  primary_metric?: string;
  primary_value?: number;
  // legacy
  MAPE?: number;
}