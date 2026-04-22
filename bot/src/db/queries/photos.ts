import { supabase } from '../client.js';

export interface VisitPhoto {
  id: string;
  visit_id: string;
  storage_path: string;
  file_name: string | null;
  file_size: number | null;
  caption: string | null;
  uploaded_at: string;
}

export async function uploadVisitPhoto(
  visitId: string,
  fileBuffer: Buffer,
  fileName: string,
  market: string,
  storeId: string,
): Promise<VisitPhoto | null> {
  const storagePath = `${market}/${storeId}/${visitId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('visit-photos')
    .upload(storagePath, fileBuffer, {
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (uploadError) {
    console.error('Photo upload error:', uploadError);
    return null;
  }

  const { data, error } = await supabase
    .from('visit_photos')
    .insert({
      visit_id: visitId,
      storage_path: storagePath,
      file_name: fileName,
      file_size: fileBuffer.length,
    })
    .select()
    .single();

  if (error) {
    console.error('Photo record error:', error);
    return null;
  }
  return data as VisitPhoto;
}

export async function getPhotosForVisit(visitId: string): Promise<VisitPhoto[]> {
  const { data, error } = await supabase
    .from('visit_photos')
    .select('*')
    .eq('visit_id', visitId)
    .order('uploaded_at');

  if (error || !data) return [];
  return data as VisitPhoto[];
}
