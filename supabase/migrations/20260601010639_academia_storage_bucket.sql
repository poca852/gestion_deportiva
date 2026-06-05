INSERT INTO storage.buckets (id, name, public)
VALUES ('expedientes-academia', 'expedientes-academia', true)
ON CONFLICT (id) DO NOTHING;
