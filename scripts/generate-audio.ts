import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

type Persona = 'coach' | 'professor' | 'sergeant' | 'hype' | 'chill'

interface PersonaMessages {
  welcome: string
  ready: string
  processing: string
}

// These must match the messages in src/lib/personas.ts exactly
const personaMessages: Record<Persona, PersonaMessages> = {
  coach: {
    welcome: 'Hey hey!',
    ready: "Nice! Whenever you're ready, hit record and explain it back to me. Take your time.",
    processing: 'Alright, let me see how you did...',
  },
  professor: {
    welcome: 'Please paste the text you wish to be evaluated on.',
    ready: 'Text received. Begin recording when prepared to deliver your explanation.',
    processing: 'Analyzing your response...',
  },
  sergeant: {
    welcome: "Drop your text. Let's see what you've got.",
    ready: 'Got it. Hit record. You have 3 minutes. Make them count.',
    processing: "Let's see if you actually learned anything.",
  },
  hype: {
    welcome: "YOOO let's do this! Paste that text and show me what you learned!",
    ready: "OH we're doing this! Hit record and tell me EVERYTHING you remember!",
    processing: 'Okay okay okay let me see this!',
  },
  chill: {
    welcome: "Hey. Paste whatever you've been reading, no rush.",
    ready: 'Cool, got it. Hit record whenever and just... explain it however.',
    processing: 'Hmm, one sec...',
  },
}

// Voice selection per persona for variety
const personaVoices: Record<Persona, 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'> = {
  coach: 'nova',
  professor: 'onyx',
  sergeant: 'echo',
  hype: 'shimmer',
  chill: 'fable',
}

async function generateAudio(text: string, voice: string, outputPath: string): Promise<void> {
  console.log(`  Generating: ${path.basename(outputPath)}`)

  const response = await openai.audio.speech.create({
    model: 'tts-1',
    voice: voice as 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer',
    input: text,
  })

  const buffer = Buffer.from(await response.arrayBuffer())
  fs.writeFileSync(outputPath, buffer)
  console.log(`  Done: ${path.basename(outputPath)}`)
}

async function main() {
  const outputDir = path.join(process.cwd(), 'public', 'audio', 'personas')

  // Ensure directory exists
  fs.mkdirSync(outputDir, { recursive: true })

  console.log('Generating pre-recorded audio files...\n')

  const personas: Persona[] = ['coach', 'professor', 'sergeant', 'hype', 'chill']

  for (const persona of personas) {
    console.log(`\n${persona.toUpperCase()}:`)
    const messages = personaMessages[persona]
    const voice = personaVoices[persona]

    await generateAudio(
      messages.welcome,
      voice,
      path.join(outputDir, `${persona}-welcome.mp3`)
    )

    await generateAudio(
      messages.ready,
      voice,
      path.join(outputDir, `${persona}-ready.mp3`)
    )

    await generateAudio(
      messages.processing,
      voice,
      path.join(outputDir, `${persona}-processing.mp3`)
    )
  }

  console.log('\n\nAll audio files generated successfully!')
  console.log(`Output directory: ${outputDir}`)
}

main().catch((err) => {
  console.error('Error generating audio:', err)
  process.exit(1)
})
