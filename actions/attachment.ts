import { supabase } from "@/lib/supabase-browser";

export const uploadPastedImage = async (blob: Blob) => {
  const ext = blob.type.split('/')[1] || 'png';
  const fileName = `paste_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const path = `pastes/${fileName}`;

  const { data, error } = await supabase
    .storage
    .from('task-attachments') 
    .upload(path, blob, { contentType: blob.type, upsert: false });

  if (error) throw error;

  const { data: pub } = supabase
    .storage
    .from('task-attachments')
    .getPublicUrl(path);

  return pub.publicUrl;
};

