import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';

import { getFirebaseStorage } from '@/lib/firebase';
import { refreshClaims } from '@/services/auth/authService';

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_DIMENSION = 1024;
const JPEG_QUALITY = 0.7;

/**
 * Room-scoped, so every member can read it (see storage.rules). The timestamp makes each
 * upload a new object, which keeps cached download URLs from showing a stale photo.
 */
const babyPhotoPath = (roomId: string, babyId: string) =>
  `rooms/${roomId}/babies/${babyId}/profile-${Date.now()}.jpg`;

/** Resizes and recompresses a picked image so we never upload the full-size original. */
export async function compressImage(uri: string, sourceWidth: number): Promise<string> {
  const context = ImageManipulator.manipulate(uri);
  if (sourceWidth > MAX_DIMENSION) context.resize({ width: MAX_DIMENSION });
  const rendered = await context.renderAsync();
  const result = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY });
  return result.uri;
}

export class PhotoTooLargeError extends Error {
  constructor() {
    super('Photo is too large');
    this.name = 'PhotoTooLargeError';
  }
}

/** Uploads a baby's profile photo and resolves with its Storage path (not a URL). */
export const uploadBabyPhoto = (
  roomId: string,
  babyId: string,
  localUri: string,
  onProgress?: (fraction: number) => void,
) => uploadJpeg(babyPhotoPath(roomId, babyId), localUri, onProgress);

/** Uploads an activity's photo. Retrying overwrites the same object, so it can't pile up. */
export const uploadActivityPhoto = (
  roomId: string,
  babyId: string,
  activityId: string,
  localUri: string,
  onProgress?: (fraction: number) => void,
) =>
  uploadJpeg(`rooms/${roomId}/babies/${babyId}/activities/${activityId}/photo.jpg`, localUri, onProgress);

function readFileAsBlob(uri: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.onload = () => resolve(request.response as Blob);
    request.onerror = () => reject(new Error(`Could not read the photo file (${uri}).`));
    request.responseType = 'blob';
    request.open('GET', uri, true);
    request.send(null);
  });
}

async function uploadJpeg(
  path: string,
  localUri: string,
  onProgress?: (fraction: number) => void,
): Promise<string> {
  // `fetch(uri).blob()` corrupted the image on its way to Storage ("unknown image format"), and
  // React Native can't build a Blob from raw bytes, which is what Firebase would need for them.
  // Reading the file through XMLHttpRequest gives a native Blob with the real contents.
  const blob = await readFileAsBlob(localUri);
  if (blob.size > MAX_PHOTO_BYTES) throw new PhotoTooLargeError();

  // Check what is about to be sent against the file itself: same size, and a JPEG header (FF D8).
  // A mismatch fails here, on the device, rather than storing a file that can't be shown.
  const bytes = await new File(localUri).bytes();
  if (bytes.byteLength < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new Error(`The photo is not a readable JPEG (${bytes.byteLength} bytes from ${localUri}).`);
  }
  if (blob.size !== bytes.byteLength) {
    throw new Error(`The photo was read incorrectly (${blob.size} of ${bytes.byteLength} bytes).`);
  }

  const upload = () =>
    new Promise<void>((resolve, reject) => {
      const task = uploadBytesResumable(ref(getFirebaseStorage(), path), blob, {
        contentType: 'image/jpeg',
      });
      task.on(
        'state_changed',
        (snapshot) => onProgress?.(snapshot.bytesTransferred / snapshot.totalBytes),
        reject,
        resolve,
      );
    });

  await withFreshClaims(upload);
  return path;
}

const isUnauthorized = (error: unknown) =>
  typeof error === 'object' && error !== null && (error as { code?: string }).code === 'storage/unauthorized';

/**
 * Storage access comes from a claim on the ID token. If it's stale (e.g. the user just joined
 * a room, or their role changed) the first attempt is refused, so refresh the token and retry once.
 */
async function withFreshClaims<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isUnauthorized(error)) throw error;
    await refreshClaims();
    return operation();
  }
}

const urlCache = new Map<string, Promise<string>>();

/** Resolves a Storage path to a displayable URL, cached for the session. */
export function getPhotoUrl(path: string): Promise<string> {
  let pending = urlCache.get(path);
  if (!pending) {
    pending = withFreshClaims(() => getDownloadURL(ref(getFirebaseStorage(), path)));
    urlCache.set(path, pending);
    pending.catch(() => urlCache.delete(path));
  }
  return pending;
}

/** Best-effort removal; a leftover file is harmless, so failures are swallowed. */
export async function deletePhoto(path: string): Promise<void> {
  urlCache.delete(path);
  try {
    await deleteObject(ref(getFirebaseStorage(), path));
  } catch {
    // ignore
  }
}
