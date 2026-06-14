import { generateText } from '../lib/ai/gemini'

async function testGemini() {
  console.log('Testing Google Gemini connection with simple prompt...');
  const prompt = 'Generate a short 1-sentence welcome message for a tourist visiting India heritage sites.';
  
  try {
    const start = Date.now();
    const response = await generateText(prompt, 'test-prompt-unique-key');
    const duration = (Date.now() - start) / 1000;
    
    console.log(`\nGemini Response (${duration.toFixed(2)}s):`);
    console.log(`"${response}"`);
    
    if (response === 'Summary unavailable') {
      console.log('\n[FAIL] Received fallback catch-all string.');
    } else {
      console.log('\n[PASS] Gemini connection working successfully!');
    }
  } catch (err) {
    console.error('[FAIL] Error calling generateText:', err);
  }
}

testGemini();
