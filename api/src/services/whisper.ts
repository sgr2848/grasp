import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'

let openai: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
  }
  return openai
}

export async function transcribeAudio(audioBuffer: Buffer, filename: string): Promise<string> {
  // Write buffer to temp file (Whisper API requires file)
  const tempDir = path.join(process.cwd(), 'uploads')
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true })
  }

  const tempPath = path.join(tempDir, `${Date.now()}-${filename}`)
  fs.writeFileSync(tempPath, audioBuffer)

  try {
    const transcription = await getOpenAI().audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: 'whisper-1',
      language: 'en'
    })

    return transcription.text
  } finally {
    // Clean up temp file
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath)
    }
  }
}
