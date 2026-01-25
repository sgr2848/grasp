import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// R2 configuration - uses S3-compatible API
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'retention-files'

// Check if R2 is configured
export function isStorageConfigured(): boolean {
  return !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY)
}

// Create S3 client for R2
function getClient(): S3Client | null {
  if (!isStorageConfigured()) {
    return null
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID!,
      secretAccessKey: R2_SECRET_ACCESS_KEY!
    }
  })
}

export interface UploadResult {
  key: string
  url: string
}

/**
 * Upload a file to R2 storage
 */
export async function uploadFile(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<UploadResult | null> {
  const client = getClient()
  if (!client) {
    console.log('R2 storage not configured, skipping file upload')
    return null
  }

  try {
    await client.send(new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType
    }))

    // Return the key - presigned URLs will be generated on-demand for access
    return { key, url: key }
  } catch (error) {
    console.error('Failed to upload file to R2:', error)
    return null
  }
}

/**
 * Upload an EPUB file for a book
 */
export async function uploadEpub(
  buffer: Buffer,
  userId: string,
  bookId: string,
  filename: string
): Promise<UploadResult | null> {
  const key = `users/${userId}/books/${bookId}/${filename}`
  return uploadFile(buffer, key, 'application/epub+zip')
}

/**
 * Upload a cover image for a book
 */
export async function uploadCoverImage(
  buffer: Buffer,
  userId: string,
  bookId: string,
  contentType: string
): Promise<UploadResult | null> {
  // Determine extension from content type
  const ext = contentType.includes('png') ? 'png'
    : contentType.includes('gif') ? 'gif'
    : 'jpg'

  const key = `users/${userId}/books/${bookId}/cover.${ext}`
  return uploadFile(buffer, key, contentType)
}

/**
 * Get a signed URL for downloading a file (valid for 1 hour)
 */
export async function getSignedDownloadUrl(key: string): Promise<string | null> {
  const client = getClient()
  if (!client) {
    return null
  }

  try {
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key
    })

    return await getSignedUrl(client, command, { expiresIn: 3600 })
  } catch (error) {
    console.error('Failed to generate signed URL:', error)
    return null
  }
}

/**
 * Delete a file from R2 storage
 */
export async function deleteFile(key: string): Promise<boolean> {
  const client = getClient()
  if (!client) {
    return false
  }

  try {
    await client.send(new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key
    }))
    return true
  } catch (error) {
    console.error('Failed to delete file from R2:', error)
    return false
  }
}

/**
 * Delete all files for a book
 */
export async function deleteBookFiles(userId: string, bookId: string): Promise<void> {
  // In a production app, you'd list and delete all files with this prefix
  // For now, we'll delete the known files
  const prefix = `users/${userId}/books/${bookId}/`

  // Delete common files
  await deleteFile(`${prefix}book.epub`)
  await deleteFile(`${prefix}cover.jpg`)
  await deleteFile(`${prefix}cover.png`)
  await deleteFile(`${prefix}cover.gif`)
}
