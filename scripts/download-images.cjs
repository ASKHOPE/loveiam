const fs = require('fs');
const path = require('path');
const https = require('https');
const urlParser = require('url');

// Helper to parse .env file
function loadEnv() {
    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf-8');
        content.split('\n').forEach(line => {
            const parts = line.split('=');
            if (parts.length >= 2) {
                const key = parts[0].trim();
                const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
                process.env[key] = val;
            }
        });
    }
}

loadEnv();

const API_KEY = process.env.PEXELS_API_KEY;
const TARGET_DIR = path.join(__dirname, '..', 'public', 'images');

// Create public/images directory if it doesn't exist
if (!fs.existsSync(TARGET_DIR)) {
    fs.mkdirSync(TARGET_DIR, { recursive: true });
}

// Queries and fallback URLs
const IMAGES_TO_DOWNLOAD = [
    {
        filename: 'gospel.jpg',
        query: 'wooden cross sunrise',
        fallback: 'https://images.unsplash.com/photo-1507434965515-61970f2bd7c6?auto=format&fit=crop&w=1200&q=80' // cross sunrise
    },
    {
        filename: 'compassion.jpg',
        query: 'volunteers serving food',
        fallback: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=1200&q=80' // charity/helping
    },
    {
        filename: 'discipleship.jpg',
        query: 'mentoring conversation bible study',
        fallback: 'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&w=1200&q=80' // mentoring/talking
    },
    {
        filename: 'salvation.jpg',
        query: 'clouds sunrays sky',
        fallback: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80' // sky
    },
    {
        filename: 'the_word.jpg',
        query: 'open bible table',
        fallback: 'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&w=1200&q=80' // open Bible/study study
    },
    {
        filename: 'fellowship.jpg',
        query: 'community outdoor dinner',
        fallback: 'https://images.unsplash.com/photo-1543007630-9710e4a00a20?auto=format&fit=crop&w=1200&q=80' // fellowship
    },
    {
        filename: 'hero.jpg',
        query: 'hands helping community support',
        fallback: 'https://images.unsplash.com/photo-1593113630400-ea4288922497?auto=format&fit=crop&w=1920&q=80' // hands helping
    },
    {
        filename: 'about_hero.jpg',
        query: 'volunteers happy community',
        fallback: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=1920&q=80' // happy volunteers
    },
    {
        filename: 'contact_hero.jpg',
        query: 'community center outreach building',
        fallback: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1920&q=80' // modern welcome center
    }
];

function downloadFile(fileUrl, destPath) {
    return new Promise((resolve, reject) => {
        const parsed = urlParser.parse(fileUrl);
        const options = {
            protocol: parsed.protocol,
            hostname: parsed.hostname,
            path: parsed.path,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        };
        https.get(options, (response) => {
            // handle redirects
            if (response.statusCode === 301 || response.statusCode === 302) {
                downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
                return;
            }
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download: ${response.statusCode} for ${fileUrl}`));
                return;
            }
            const file = fs.createWriteStream(destPath);
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
            file.on('error', (err) => {
                fs.unlink(destPath, () => {});
                reject(err);
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

function fetchPexelsImageUrl(query) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.pexels.com',
            path: `/v1/search?query=${encodeURIComponent(query)}&orientation=landscape&per_page=1`,
            headers: {
                'Authorization': API_KEY,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        };

        https.get(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    reject(new Error(`Pexels API error: ${res.statusCode} ${data}`));
                    return;
                }
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.photos && parsed.photos.length > 0) {
                        resolve(parsed.photos[0].src.large2x || parsed.photos[0].src.large);
                    } else {
                        reject(new Error(`No photos found for query: ${query}`));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

async function main() {
    console.log('Starting Love In Action image sync...');
    if (!API_KEY) {
        console.warn('⚠️  No PEXELS_API_KEY env variable or .env entry detected. Using high-quality Unsplash fallbacks.');
    } else {
        console.log('PEXELS_API_KEY detected. Fetching custom assets from Pexels API...');
    }

    for (const item of IMAGES_TO_DOWNLOAD) {
        const dest = path.join(TARGET_DIR, item.filename);
        let url = item.fallback;

        if (API_KEY) {
            try {
                console.log(`Searching Pexels for "${item.query}"...`);
                url = await fetchPexelsImageUrl(item.query);
            } catch (err) {
                console.error(`❌ Error fetching from Pexels for "${item.query}": ${err.message}. Using fallback.`);
                url = item.fallback;
            }
        }

        try {
            console.log(`Downloading ${item.filename} from ${url.split('?')[0]}...`);
            await downloadFile(url, dest);
            console.log(`✅ Saved ${item.filename}`);
        } catch (err) {
            console.error(`❌ Failed to download ${item.filename}: ${err.message}`);
        }
    }
    console.log('🎉 Image sync complete!');
}

main();
