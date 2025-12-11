// Types pour les réponses des webhooks

export interface PrescriptionMatch {
  id: string;
  content: string;
  category: string;
  tags: string[];
  polarity: 'authorized' | 'forbidden';
  similarity: number;
}

export interface Prescription {
  prescription: string;
  matches: PrescriptionMatch[];
}

export interface PrescriptionsResponse {
  prescriptions: Prescription[];
}

export interface ObservationMatch {
  id: string;
  content: string;
  category: string;
  tags: string[];
  polarity: 'authorized' | 'forbidden';
  similarity: number;
}

export interface Observation {
  observation: string;
  matches: ObservationMatch[];
}

export interface ObservationsResponse {
  observations: Observation[];
}
