import { google } from 'googleapis'
import { Readable } from 'stream'

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
)

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
})

const drive = google.drive({ version: 'v3', auth: oauth2Client })

export async function uploadToDrive(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<string> {
  // Upload file to Drive folder
  const response = await drive.files.create({
    requestBody: {
      name:    fileName,
      parents: [process.env.GOOGLE_DRIVE_FOLDER_ID!],
    },
    media: {
      mimeType,
      body: Readable.from(buffer),
    },
    fields: 'id',
  })

  const fileId = response.data.id!

  // Make file publicly viewable (anyone with link)
  await drive.permissions.create({
    fileId,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  })

  // Return direct view URL
  return `https://drive.google.com/file/d/${fileId}/view`
}
