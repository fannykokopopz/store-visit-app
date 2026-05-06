import { supabase } from '../client.js';

export interface VisitPhoto {
  id: string;
  visit_id: string;
  storage_path: string;
  caption: string | null;
  photo_tag: 'display' | 'competitor' | 'stock' | 'staff' | 'other' | null;
  file_size: number | null;
  analyzed_at: string | null;
  created_at: string;
}

export async function uploadVisitPhoto(
  visitId: string,
  fileBuffer: Buffer,
  storeId: string,
): Promise<VisitPhoto | null> {
  const photoId = crypto.randomUUID();
  const storagePath = `${storeId}/${visitId}/${photoId}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from('sva-photos')
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
    .order('created_at');

  if (error || !data) return [];
  return data as VisitPhoto[];
}

export async function signPhotoUrls(
  paths: string[],
  ttlSec = 300,
): Promise<string[]> {
  if (paths.length === 0) return [];
  const { data, error } = await supabase.storage
    .from('sva-photos')
    .createSignedUrls(paths, ttlSec);
  if (error || !data) {
    console.error('signPhotoUrls error:', error);
    return [];
  }
  return data
    .map((d: any) => d.signedUrl as string)
    .filter((u: string) => Boolean(u));
}
