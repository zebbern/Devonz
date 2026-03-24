CREATE TABLE IF NOT EXISTS public.deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    project_name TEXT NOT NULL,
    gitlab_project_id INTEGER NOT NULL,
    gitlab_project_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.deployments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable insert for authenticated users only"
    ON public.deployments
    FOR INSERT 
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable read access for all users"
    ON public.deployments
    FOR SELECT
    USING (true);
