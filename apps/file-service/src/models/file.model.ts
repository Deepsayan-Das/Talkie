export interface FileData {
  owner_id: string;
  original_name: string;
  mime_type: string;
  size: number;
  storage_key: string;
  url: string;
}

export interface FileRecord extends FileData {
  id: string;
  created_at: Date;
  updated_at: Date;
}
