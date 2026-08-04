CREATE UNIQUE INDEX IF NOT EXISTS idx_project_library_files_folder_name
ON project_library_files(project_id, folder_id, name);
