-- Migration SQL pour créer les tables patients, visits, et alerts dans Supabase
-- À exécuter dans le SQL Editor de Supabase

-- Table Patients
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  age VARCHAR,
  address VARCHAR,
  phone_number VARCHAR,
  medical_tags JSONB DEFAULT '[]'::jsonb,
  risk_level VARCHAR CHECK (risk_level IN ('Faible', 'Modéré', 'Élevé')),
  audio_consent VARCHAR CHECK (audio_consent IN ('oral', 'written', 'refused')),
  audio_consent_date TIMESTAMPTZ,
  next_visit_time VARCHAR, -- Format "HH:MM"
  profile_image_url VARCHAR,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_patients_user_id ON patients(user_id);
CREATE INDEX IF NOT EXISTS idx_patients_next_visit_time ON patients(next_visit_time);

-- Table Visits (Enregistrements/Visites)
CREATE TABLE IF NOT EXISTS visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  visit_date TIMESTAMPTZ NOT NULL,
  duration_seconds INTEGER,
  audio_file_url VARCHAR,
  transcription TEXT,
  ai_summary TEXT,
  visit_type VARCHAR,
  pain_level INTEGER CHECK (pain_level >= 0 AND pain_level <= 10),
  vital_signs VARCHAR,
  alerts JSONB DEFAULT '[]'::jsonb,
  risk_level VARCHAR CHECK (risk_level IN ('Faible', 'Modéré', 'Élevé')),
  validated BOOLEAN DEFAULT FALSE,
  processing BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_visits_user_id ON visits(user_id);
CREATE INDEX IF NOT EXISTS idx_visits_patient_id ON visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_visits_visit_date ON visits(visit_date DESC);
CREATE INDEX IF NOT EXISTS idx_visits_validated ON visits(validated);

-- Table Alerts
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  visit_id UUID REFERENCES visits(id) ON DELETE CASCADE,
  level VARCHAR NOT NULL CHECK (level IN ('Faible', 'Modéré', 'Élevé')),
  description TEXT NOT NULL,
  action_required BOOLEAN DEFAULT FALSE,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_patient_id ON alerts(patient_id);
CREATE INDEX IF NOT EXISTS idx_alerts_is_read ON alerts(is_read);

-- RLS (Row Level Security) Policies
-- Enable RLS on all tables
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Patients: Users can only see/manage their own patients
CREATE POLICY "Users can view their own patients"
  ON patients FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own patients"
  ON patients FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own patients"
  ON patients FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own patients"
  ON patients FOR DELETE
  USING (auth.uid() = user_id);

-- Visits: Users can only see/manage their own visits
CREATE POLICY "Users can view their own visits"
  ON visits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own visits"
  ON visits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own visits"
  ON visits FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own visits"
  ON visits FOR DELETE
  USING (auth.uid() = user_id);

-- Alerts: Users can only see/manage their own alerts
CREATE POLICY "Users can view their own alerts"
  ON alerts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own alerts"
  ON alerts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own alerts"
  ON alerts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own alerts"
  ON alerts FOR DELETE
  USING (auth.uid() = user_id);

-- Fonction pour auto-update du timestamp updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers pour auto-update
CREATE TRIGGER update_patients_updated_at
  BEFORE UPDATE ON patients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_visits_updated_at
  BEFORE UPDATE ON visits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Données de test (optionnel - à supprimer en production)
-- Remplacer 'YOUR_USER_ID' par un vrai user_id de auth.users
/*
INSERT INTO patients (user_id, name, age, address, medical_tags, risk_level, audio_consent, next_visit_time)
VALUES
  ('YOUR_USER_ID', 'Claire Martin', '78', '12, Rue de la Gare', '["Diabète", "AVK"]'::jsonb, 'Faible', 'oral', '09:00'),
  ('YOUR_USER_ID', 'Pierre Lefevre', '85', '45, Avenue Victor Hugo', '["Alzheimer", "Risque de chute"]'::jsonb, 'Modéré', 'refused', '10:30'),
  ('YOUR_USER_ID', 'Jeanne Robert', '92', '23, Place du Marché', '["Insuffisance Cardiaque", "Oxygène"]'::jsonb, 'Élevé', 'written', '11:15');
*/
