// DOCMATE - API Integration
// Handles external API calls for translation, search, and other services

// API Configuration
const API_CONFIG = {
    // Google APIs
    GOOGLE_TRANSLATE_API_KEY: 'YOUR_GOOGLE_TRANSLATE_API_KEY',
    GOOGLE_SEARCH_API_KEY: 'YOUR_GOOGLE_SEARCH_API_KEY', 
    GOOGLE_SEARCH_ENGINE_ID: 'YOUR_SEARCH_ENGINE_ID',
    
    // Microsoft Azure
    AZURE_TRANSLATOR_KEY: 'YOUR_AZURE_TRANSLATOR_KEY',
    AZURE_TRANSLATOR_REGION: 'YOUR_AZURE_REGION',
    
    // OpenAI (for enhanced analysis)
    OPENAI_API_KEY: 'YOUR_OPENAI_API_KEY',
    
    // DeepL Translation
    DEEPL_API_KEY: 'YOUR_DEEPL_API_KEY',
    
    // Other APIs
    WIKIPEDIA_API_BASE: 'https://en.wikipedia.org/api/rest_v1',
    DUCKDUCKGO_API_BASE: 'https://api.duckduckgo.com'
};

// Translation Services
class TranslationService {
    static async translateText(text, targetLanguage, sourceLanguage = 'en') {
        try {
            // Try Google Translate first
            const googleResult = await this.translateWithGoogle(text, targetLanguage, sourceLanguage);
            if (googleResult) return googleResult;
            
            // Fallback to Azure Translator
            const azureResult = await this.translateWithAzure(text, targetLanguage, sourceLanguage);
            if (azureResult) return azureResult;
            
            // Fallback to DeepL
            const deeplResult = await this.translateWithDeepL(text, targetLanguage, sourceLanguage);
            if (deeplResult) return deeplResult;
            
            throw new Error('All translation services failed');
            
        } catch (error) {
            console.error('Translation error:', error);
            throw error;
        }
    }
    
    static async translateWithGoogle(text, targetLanguage, sourceLanguage) {
        if (!API_CONFIG.GOOGLE_TRANSLATE_API_KEY || API_CONFIG.GOOGLE_TRANSLATE_API_KEY === 'YOUR_GOOGLE_TRANSLATE_API_KEY') {
            return null;
        }
        
        try {
            const response = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${API_CONFIG.GOOGLE_TRANSLATE_API_KEY}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    q: text,
                    target: targetLanguage,
                    source: sourceLanguage,
                    format: 'text'
                })
            });
            
            const data = await response.json();
            if (data.data && data.data.translations && data.data.translations[0]) {
                return data.data.translations[0].translatedText;
            }
            
            return null;
        } catch (error) {
            console.error('Google Translate error:', error);
            return null;
        }
    }
    
    static async translateWithAzure(text, targetLanguage, sourceLanguage) {
        if (!API_CONFIG.AZURE_TRANSLATOR_KEY || API_CONFIG.AZURE_TRANSLATOR_KEY === 'YOUR_AZURE_TRANSLATOR_KEY') {
            return null;
        }
        
        try {
            const response = await fetch(`https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=${sourceLanguage}&to=${targetLanguage}`, {
                method: 'POST',
                headers: {
                    'Ocp-Apim-Subscription-Key': API_CONFIG.AZURE_TRANSLATOR_KEY,
                    'Ocp-Apim-Subscription-Region': API_CONFIG.AZURE_TRANSLATOR_REGION,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify([{ text: text }])
            });
            
            const data = await response.json();
            if (data && data[0] && data[0].translations && data[0].translations[0]) {
                return data[0].translations[0].text;
            }
            
            return null;
        } catch (error) {
            console.error('Azure Translator error:', error);
            return null;
        }
    }
    
    static async translateWithDeepL(text, targetLanguage, sourceLanguage) {
        if (!API_CONFIG.DEEPL_API_KEY || API_CONFIG.DEEPL_API_KEY === 'YOUR_DEEPL_API_KEY') {
            return null;
        }
        
        try {
            const response = await fetch('https://api-free.deepl.com/v2/translate', {
                method: 'POST',
                headers: {
                    'Authorization': `DeepL-Auth-Key ${API_CONFIG.DEEPL_API_KEY}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    'text': text,
                    'target_lang': targetLanguage.toUpperCase(),
                    'source_lang': sourceLanguage.toUpperCase()
                })
            });
            
            const data = await response.json();
            if (data.translations && data.translations[0]) {
                return data.translations[0].text;
            }
            
            return null;
        } catch (error) {
            console.error('DeepL error:', error);
            return null;
        }
    }
}

// Search Services
class SearchService {
    static async searchWeb(query) {
        const results = {
            summary: `Search results for "${query}":`,
            results: []
        };
        
        try {
            // Try multiple search sources
            const [wikipediaResults, googleResults, educationalResults] = await Promise.allSettled([
                this.searchWikipedia(query),
                this.searchGoogle(query),
                this.getEducationalResources(query)
            ]);
            
            // Process Wikipedia results
            if (wikipediaResults.status === 'fulfilled' && wikipediaResults.value) {
                results.results.push(wikipediaResults.value);
            }
            
            // Process Google results
            if (googleResults.status === 'fulfilled' && googleResults.value) {
                results.results.push(...googleResults.value);
            }
            
            // Add educational resources
            if (educationalResults.status === 'fulfilled' && educationalResults.value) {
                results.results.push(...educationalResults.value);
            }
            
            return results;
            
        } catch (error) {
            console.error('Search error:', error);
            return this.getFallbackResults(query);
        }
    }
    
    static async searchWikipedia(query) {
        try {
            const response = await fetch(`${API_CONFIG.WIKIPEDIA_API_BASE}/page/summary/${encodeURIComponent(query)}`);
            const data = await response.json();
            
            if (data.extract) {
                return {
                    title: data.title || query,
                    snippet: data.extract,
                    url: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(query)}`,
                    source: 'Wikipedia'
                };
            }
            
            return null;
        } catch (error) {
            console.error('Wikipedia search error:', error);
            return null;
        }
    }
    
    static async searchGoogle(query) {
        if (!API_CONFIG.GOOGLE_SEARCH_API_KEY || API_CONFIG.GOOGLE_SEARCH_API_KEY === 'YOUR_GOOGLE_SEARCH_API_KEY') {
            return [];
        }
        
        try {
            const response = await fetch(`https://www.googleapis.com/customsearch/v1?key=${API_CONFIG.GOOGLE_SEARCH_API_KEY}&cx=${API_CONFIG.GOOGLE_SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}&num=3`);
            const data = await response.json();
            
            if (data.items) {
                return data.items.map(item => ({
                    title: item.title,
                    snippet: item.snippet,
                    url: item.link,
                    source: 'Google Search'
                }));
            }
            
            return [];
        } catch (error) {
            console.error('Google search error:', error);
            return [];
        }
    }
    
    static async getEducationalResources(query) {
        // Return curated educational resources
        return [
            {
                title: `${query} - Khan Academy`,
                snippet: `Learn about ${query} with free online courses, lessons, and practice exercises from Khan Academy.`,
                url: `https://www.khanacademy.org/search?referer=%2F&page_search_query=${encodeURIComponent(query)}`,
                source: 'Khan Academy'
            },
            {
                title: `${query} Courses - Coursera`,
                snippet: `Explore ${query} courses from top universities and companies. Get certified upon completion.`,
                url: `https://coursera.org/search?query=${encodeURIComponent(query)}`,
                source: 'Coursera'
            },
            {
                title: `${query} Video Tutorials - YouTube`,
                snippet: `Watch comprehensive video tutorials about ${query} from educators and professionals.`,
                url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
                source: 'YouTube Education'
            },
            {
                title: `${query} Research Papers - Google Scholar`,
                snippet: `Find academic papers and research articles about ${query} from scholars worldwide.`,
                url: `https://scholar.google.com/scholar?q=${encodeURIComponent(query)}`,
                source: 'Google Scholar'
            }
        ];
    }
    
    static getFallbackResults(query) {
        return {
            summary: `Educational resources for "${query}":`,
            results: this.getEducationalResources(query)
        };
    }
}

// AI Analysis Service
class AIAnalysisService {
    static async analyzeDocument(content, fileName) {
        try {
            // Try OpenAI analysis first
            const aiAnalysis = await this.analyzeWithOpenAI(content, fileName);
            if (aiAnalysis) return aiAnalysis;
            
            // Fallback to local analysis
            return this.analyzeLocally(content, fileName);
            
        } catch (error) {
            console.error('AI Analysis error:', error);
            return this.analyzeLocally(content, fileName);
        }
    }
    
    static async analyzeWithOpenAI(content, fileName) {
        if (!API_CONFIG.OPENAI_API_KEY || API_CONFIG.OPENAI_API_KEY === 'YOUR_OPENAI_API_KEY') {
            return null;
        }
        
        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${API_CONFIG.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a document analysis expert. Provide a comprehensive analysis including summary, key points, and main topics.'
                        },
                        {
                            role: 'user',
                            content: `Analyze this document titled "${fileName}":\n\n${content.substring(0, 4000)}`
                        }
                    ],
                    max_tokens: 1000,
                    temperature: 0.7
                })
            });
            
            const data = await response.json();
            if (data.choices && data.choices[0] && data.choices[0].message) {
                return this.parseAIAnalysis(data.choices[0].message.content, content, fileName);
            }
            
            return null;
        } catch (error) {
            console.error('OpenAI analysis error:', error);
            return null;
        }
    }
    
    static parseAIAnalysis(aiResponse, content, fileName) {
        const words = content.split(/\s+/).filter(w => w.length > 0);
        const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
        
        return {
            fileName,
            stats: {
                words: words.length,
                sentences: sentences.length,
                paragraphs: paragraphs.length,
                readingTime: Math.ceil(words.length / 200),
                difficulty: this.assessDifficulty(content)
            },
            summary: aiResponse.substring(0, 500) + '...',
            keyPoints: this.extractKeyPointsFromAI(aiResponse),
            mainTopics: this.extractTopicsFromAI(aiResponse)
        };
    }
    
    static extractKeyPointsFromAI(aiResponse) {
        // Extract bullet points or numbered lists from AI response
        const lines = aiResponse.split('\n');
        const keyPoints = lines
            .filter(line => line.match(/^[-•*]\s+/) || line.match(/^\d+\.\s+/))
            .map(line => line.replace(/^[-•*]\s+/, '').replace(/^\d+\.\s+/, ''))
            .slice(0, 5);
        
        return keyPoints.length > 0 ? keyPoints : ['AI analysis provided comprehensive insights'];
    }
    
    static extractTopicsFromAI(aiResponse) {
        // Simple topic extraction from AI response
        const words = aiResponse.toLowerCase().split(/\s+/);
        const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
        
        const wordFreq = {};
        words.forEach(word => {
            word = word.replace(/[^\w]/g, '');
            if (word.length > 4 && !commonWords.has(word)) {
                wordFreq[word] = (wordFreq[word] || 0) + 1;
            }
        });
        
        return Object.entries(wordFreq)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6)
            .map(([word]) => word);
    }
    
    static analyzeLocally(content, fileName) {
        const words = content.split(/\s+/).filter(w => w.length > 0);
        const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
        
        return {
            fileName,
            stats: {
                words: words.length,
                sentences: sentences.length,
                paragraphs: paragraphs.length,
                readingTime: Math.ceil(words.length / 200),
                difficulty: this.assessDifficulty(content)
            },
            summary: this.generateLocalSummary(content),
            keyPoints: this.extractLocalKeyPoints(content),
            mainTopics: this.extractLocalTopics(content)
        };
    }
    
    static generateLocalSummary(content) {
        const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 30);
        
        if (sentences.length === 0) {
            return 'This document contains limited analyzable content.';
        }
        
        let summary = '';
        
        // Introduction
        if (sentences.length > 0) {
            summary += sentences[0].trim() + '. ';
        }
        
        // Middle content
        if (sentences.length > 5) {
            const midIndex = Math.floor(sentences.length / 2);
            summary += sentences[midIndex].trim() + '. ';
        }
        
        // Conclusion
        if (sentences.length > 2) {
            summary += sentences[sentences.length - 1].trim() + '.';
        }
        
        return summary || 'Document analysis completed successfully.';
    }
    
    static extractLocalKeyPoints(content) {
        const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 50);
        
        const keyPoints = sentences
            .filter(s => {
                const lower = s.toLowerCase();
                return lower.includes('important') || 
                       lower.includes('key') || 
                       lower.includes('main') || 
                       lower.includes('significant') ||
                       lower.includes('conclusion') ||
                       lower.includes('result') ||
                       (s.length > 80 && s.length < 200);
            })
            .slice(0, 5)
            .map(s => s.trim());
        
        return keyPoints.length > 0 ? keyPoints : sentences.slice(0, 3).map(s => s.trim());
    }
    
    static extractLocalTopics(content) {
        const words = content.toLowerCase().split(/\s+/);
        const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'shall', 'this', 'that', 'these', 'those']);
        
        const wordFreq = {};
        words.forEach(word => {
            word = word.replace(/[^\w]/g, '');
            if (word.length > 3 && !stopWords.has(word)) {
                wordFreq[word] = (wordFreq[word] || 0) + 1;
            }
        });
        
        return Object.entries(wordFreq)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([word]) => word);
    }
    
    static assessDifficulty(text) {
        const words = text.split(/\s+/);
        const sentences = text.split(/[.!?]+/);
        
        const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
        const avgSentenceLength = words.length / sentences.length;
        
        if (avgWordLength > 6 && avgSentenceLength > 20) return 'Advanced';
        if (avgWordLength > 5 && avgSentenceLength > 15) return 'Intermediate';
        return 'Beginner';
    }
}

// Text-to-Speech Service
class TTSService {
    static async getVoicesForLanguage(languageCode) {
        if ('speechSynthesis' in window) {
            const voices = speechSynthesis.getVoices();
            return voices.filter(voice => 
                voice.lang.startsWith(languageCode) || 
                voice.lang.toLowerCase().includes(languageCode)
            );
        }
        return [];
    }
    
    static async speakText(text, options = {}) {
        if (!('speechSynthesis' in window)) {
            throw new Error('Text-to-speech not supported');
        }
        
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Apply options
        if (options.lang) utterance.lang = options.lang;
        if (options.pitch) utterance.pitch = options.pitch;
        if (options.rate) utterance.rate = options.rate;
        if (options.volume) utterance.volume = options.volume;
        if (options.voice) utterance.voice = options.voice;
        
        return new Promise((resolve, reject) => {
            utterance.onend = resolve;
            utterance.onerror = reject;
            speechSynthesis.speak(utterance);
        });
    }
}

// Dictionary Service
class DictionaryService {
    static async lookupWord(word) {
        try {
            // Try multiple dictionary sources
            const [duckduckgoResult, wikipediaResult] = await Promise.allSettled([
                this.lookupWithDuckDuckGo(word),
                this.lookupWithWikipedia(word)
            ]);
            
            if (duckduckgoResult.status === 'fulfilled' && duckduckgoResult.value) {
                return duckduckgoResult.value;
            }
            
            if (wikipediaResult.status === 'fulfilled' && wikipediaResult.value) {
                return wikipediaResult.value;
            }
            
            return {
                word: word,
                definition: `No definition found for "${word}". Try checking the spelling or search for related terms.`,
                source: 'DOCMATE'
            };
            
        } catch (error) {
            console.error('Dictionary lookup error:', error);
            return {
                word: word,
                definition: `Error looking up "${word}". Please try again.`,
                source: 'Error'
            };
        }
    }
    
    static async lookupWithDuckDuckGo(word) {
        try {
            const response = await fetch(`${API_CONFIG.DUCKDUCKGO_API_BASE}/?q=${encodeURIComponent(word)}&format=json&no_html=1&skip_disambig=1`);
            const data = await response.json();
            
            if (data.AbstractText) {
                return {
                    word: word,
                    definition: data.AbstractText,
                    source: 'DuckDuckGo',
                    url: data.AbstractURL
                };
            }
            
            return null;
        } catch (error) {
            console.error('DuckDuckGo lookup error:', error);
            return null;
        }
    }
    
    static async lookupWithWikipedia(word) {
        try {
            const response = await fetch(`${API_CONFIG.WIKIPEDIA_API_BASE}/page/summary/${encodeURIComponent(word)}`);
            const data = await response.json();
            
            if (data.extract) {
                return {
                    word: data.title || word,
                    definition: data.extract,
                    source: 'Wikipedia',
                    url: data.content_urls?.desktop?.page
                };
            }
            
            return null;
        } catch (error) {
            console.error('Wikipedia lookup error:', error);
            return null;
        }
    }
}

// Export services
window.apiServices = {
    TranslationService,
    SearchService,
    AIAnalysisService,
    TTSService,
    DictionaryService
};

// Utility functions for API integration
window.apiUtils = {
    // Check if API key is configured
    isConfigured: (service) => {
        const key = API_CONFIG[service];
        return key && !key.startsWith('YOUR_');
    },
    
    // Rate limiting for API calls
    rateLimiter: (() => {
        const limits = new Map();
        return {
            canMakeRequest: (service, maxRequests = 10, windowMs = 60000) => {
                const now = Date.now();
                const key = service;
                
                if (!limits.has(key)) {
                    limits.set(key, []);
                }
                
                const requests = limits.get(key);
                const validRequests = requests.filter(time => now - time < windowMs);
                
                if (validRequests.length >= maxRequests) {
                    return false;
                }
                
                validRequests.push(now);
                limits.set(key, validRequests);
                return true;
            }
        };
    })(),
    
    // Error handling for API calls
    handleApiError: (error, service) => {
        console.error(`${service} API Error:`, error);
        
        if (error.status === 429) {
            return 'Rate limit exceeded. Please try again later.';
        } else if (error.status === 401) {
            return 'API authentication failed. Please check your API keys.';
        } else if (error.status === 403) {
            return 'API access forbidden. Please check your permissions.';
        } else {
            return `${service} service temporarily unavailable. Please try again.`;
        }
    }

};

