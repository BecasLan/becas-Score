// Ollama'nın gerçekten Llama modeli kullanıp kullanmadığını doğrudan test eder
const fetch = require('node-fetch');

async function testModel() {
  try {
    // 1. Önce mevcut modelleri listele
    console.log("1. Mevcut modelleri kontrol ediyorum...");
    const modelsResponse = await fetch('http://localhost:11434/api/tags');
    
    if (!modelsResponse.ok) {
      console.error("❌ Ollama API erişilebilir değil! Ollama çalışıyor mu?");
      return;
    }
    
    const models = await modelsResponse.json();
    console.log("Kurulu modeller:", models.models ? models.models.map(m => m.name).join(', ') : 'Bilinmiyor');
    
    // 2. Doğrudan modeli test et
    console.log("\n2. Llama modelini test ediyorum...");
    const modelName = 'llama3.1:8b-instruct-q4_K_M'; // Bot'un kullandığı model
    
    const testResponse = await fetch('http://localhost:11434/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: 'Sen bir yapay zeka modeli misin? Llama modeli misin? SADECE BU SORUYU YANITLE' },
          { role: 'user', content: 'Ne modelisin ve hangi şirket tarafından yapıldın?' }
        ],
        temperature: 0.1, // Daha tutarlı yanıtlar için düşük temperature
        max_tokens: 100
      })
    });
    
    if (!testResponse.ok) {
      console.error(`❌ Model yanıt vermedi! Hata: ${testResponse.status}`);
      console.error(await testResponse.text());
      return;
    }
    
    const result = await testResponse.json();
    console.log("\nMODEL YANITI:");
    console.log(result.choices && result.choices[0] && result.choices[0].message 
      ? result.choices[0].message.content 
      : 'Yanıt alınamadı');
      
    // 3. Bot yapılandırmasını kontrol et
    console.log("\n3. Şu modeli kullanıyorsunuz:", modelName);
    console.log("Bot'un env/config.js dosyasında LLM_MODEL değerini kontrol edin");
    
  } catch (error) {
    console.error("❌ TEST BAŞARISIZ:", error.message);
  }
}

testModel();