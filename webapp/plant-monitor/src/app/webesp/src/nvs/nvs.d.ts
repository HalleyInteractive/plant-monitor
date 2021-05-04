type NvsPageState = "ACTIVE" | "FULL";

interface NvsKeyValue {
  namespace: number;
  type: number;
  key: string;
  data: number | string;
}

