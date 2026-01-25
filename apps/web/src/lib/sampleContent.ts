export interface SampleContentData {
  title: string
  content: string
  sourceType: 'article' | 'meeting' | 'podcast' | 'video' | 'book' | 'lecture' | 'other'
}

export const SAMPLE_CONTENT: SampleContentData = {
  title: 'The Feynman Technique',
  sourceType: 'article',
  content: `The Feynman Technique is a learning method named after Nobel Prize-winning physicist Richard Feynman. It's designed to help you understand and remember concepts deeply, rather than just memorizing facts.

The technique has four simple steps:

First, choose a concept you want to learn. Write the name of the concept at the top of a blank page.

Second, explain the concept in simple terms, as if you were teaching it to someone who has never heard of it before. Use plain language and avoid jargon. The key is to explain it so clearly that a child could understand.

Third, identify gaps in your understanding. When you struggle to explain something simply, that's a signal you don't fully understand it. Go back to your source material and fill in those gaps.

Fourth, simplify and use analogies. Once you can explain the concept, try to make your explanation even simpler. Use comparisons to everyday things. If you can relate a complex idea to something familiar, you truly understand it.

The power of this technique comes from the second step. When you try to explain something in simple terms, you quickly discover what you actually know versus what you think you know. Teaching forces understanding.

Feynman believed that if you couldn't explain something simply, you didn't understand it well enough. This approach helped him break down complex physics problems and communicate difficult ideas to students and the general public.`
}
