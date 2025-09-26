async function fetchAllPokemon() {
    const url = 'https://pokeapi.co/api/v2/pokemon?limit=2000&offset=0';
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
    const data = await res.json();
    return data.results;
}

function createLoadingMessage(parent) {
    const p = document.createElement('p');
    p.id = 'loading';
    p.textContent = 'Loading...';
    parent.appendChild(p);
    return p;
}

function showError(parent, message) {
    const p = document.createElement('p');
    p.style.color = 'crimson';
    p.textContent = `Error: ${message}`;
    parent.appendChild(p);
}

function renderPokemonList(parent, items) {
    // Create (or reuse) a detail area at the top where the image/name will be shown
    let detail = document.getElementById('pokemon-detail');
    if (!detail) {
        detail = document.createElement('div');
        detail.id = 'pokemon-detail';
        detail.style.display = 'flex';
        detail.style.alignItems = 'center';
        detail.style.gap = '12px';
        detail.style.marginBottom = '12px';
        parent.appendChild(detail);
    }

    // Use ordered list so items are numbered automatically.
    const ol = document.createElement('ol');
    items.forEach((it, index) => {
        const li = document.createElement('li');
        li.textContent = `${index + 1}. ${it.name}`;
        li.dataset.name = it.name;
        // store the API url so we can fetch details later
        li.dataset.url = it.url;
        ol.appendChild(li);
    });

    parent.appendChild(ol);

    // Add a single delegated click listener to the ol for efficiency
    ol.addEventListener('click', async (e) => {
        const li = e.target.closest('li');
        if (!li) return;
        const url = li.dataset.url;
        if (!url) return;
        try {
            await showPokemonByUrl(url);
        } catch (err) {
            console.error(err);
        }
    });

// Cache for fetched pokemon details by URL
const detailsCache = new Map();

async function fetchPokemonDetails(url) {
    globalThis;
    if (detailsCache.has(url)) return detailsCache.get(url);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Detail fetch failed: ${res.status} ${res.statusText}`);
    const data = await res.json();
    detailsCache.set(url, data);
    return data;
}

// Show pokemon image and name in the detail area at the top
async function showPokemonByUrl(url) {
    const detail = document.getElementById('pokemon-detail');
    if (!detail) throw new Error('Detail container missing');

    // Clear existing contents
    detail.innerHTML = '';

    // Small loading indicator while fetching details
    const loading = document.createElement('span');
    loading.textContent = 'Loading...';
    detail.appendChild(loading);

    const data = await fetchPokemonDetails(url);

    // Choose best available image: official artwork -> front_default
    const artwork = (data.sprites && data.sprites.other && data.sprites.other['official-artwork'] && data.sprites.other['official-artwork'].front_default) || data.sprites.front_default || null;

    detail.innerHTML = '';
    if (artwork) {
        const img = document.createElement('img');
        img.src = artwork;
        img.alt = data.name;
        img.style.width = '120px';
        img.style.height = '120px';
        img.style.objectFit = 'contain';
        detail.appendChild(img);
    }

    const info = document.createElement('div');
    const title = document.createElement('h2');
    title.textContent = capitalize(data.name);
    title.style.margin = '0';
    info.appendChild(title);

    // Optionally show types
    if (Array.isArray(data.types)) {
        const types = document.createElement('p');
        types.style.margin = '4px 0 0 0';
        types.textContent = 'Type: ' + data.types.map(t => capitalize(t.type.name)).join(', ');
        info.appendChild(types);
    }

    // Try to attach an audio player with the Pokemon's cry, using a few common sources
    const audioContainer = document.createElement('div');
    audioContainer.style.marginTop = '8px';
    audioContainer.id = 'pokemon-audio';
    info.appendChild(audioContainer);

    (async () => {
        try {
            const urls = getAudioCandidateUrls(data);
            const audioEl = await createAudioWithFallback(urls);
            if (audioEl) {
                audioEl.controls = true;
                audioEl.preload = 'none';
                audioContainer.appendChild(audioEl);
            } else {
                const p = document.createElement('p');
                p.style.margin = '0';
                p.style.fontSize = '0.9rem';
                p.style.color = '#666';
                p.textContent = 'No audio available';
                audioContainer.appendChild(p);
            }
        } catch (err) {
            console.debug('Audio load failed', err);
        }
    })();

    detail.appendChild(info);
}

function capitalize(s) {
    return String(s).charAt(0).toUpperCase() + String(s).slice(1);
}

// Build a set of likely audio URLs for a pokemon using its numeric id and name.
function getAudioCandidateUrls(data) {
    const id = data.id; // numeric id
    const name = String(data.name || '').toLowerCase();

    const normalize = (s) => s.replace(/[^a-z0-9-]/g, '-');

    const candidates = [];

    // PokemonShowdown cries by name (commonly available)
    candidates.push(`https://play.pokemonshowdown.com/audio/cries/${normalize(name)}.mp3`);

    // Bulbagarden archives by id (ogg)
    if (Number.isInteger(id)) {
        candidates.push(`https://archives.bulbagarden.net/media/sound/ogg/vg/cries/${id}.ogg`);
        candidates.push(`https://pokemoncries.com/cries/${id}.mp3`);
    }

    // Some mirrors may host front_default-like filenames by name
    candidates.push(`https://raw.githubusercontent.com/msikma/pokesprite/master/sprites/pokemon/384x384/${id}.png`);

    // Remove duplicates while preserving order
    return [...new Set(candidates)];
}

// Try to create an audio element by attempting each URL until one loads successfully.
// Returns the audio element or null if none succeeded.
function createAudioWithFallback(urls) {
    return new Promise((resolve) => {
        let i = 0;
        const tryNext = () => {
            if (i >= urls.length) return resolve(null);
            const url = urls[i++];
            const audio = document.createElement('audio');
            audio.src = url;
            // If the audio can play, resolve with this element
            const onCanPlay = () => cleanup(true);
            const onError = () => cleanup(false);

            function cleanup(success) {
                audio.removeEventListener('canplay', onCanPlay);
                audio.removeEventListener('canplaythrough', onCanPlay);
                audio.removeEventListener('error', onError);
                if (success) return resolve(audio);
                // try next URL
                tryNext();
            }

            audio.addEventListener('canplay', onCanPlay);
            audio.addEventListener('canplaythrough', onCanPlay);
            audio.addEventListener('error', onError);
            // trigger load
            audio.load();
        };

        tryNext();
    });
}
}

async function init() {
    const app = document.getElementById('app');
    if (!app) {
        console.error('No #app element found in the page');
        return;
    }

    const loading = createLoadingMessage(app);
    try {
        const pokemon = await fetchAllPokemon();
        loading.remove();
        renderPokemonList(app, pokemon);
        // Default to first element of the API if nothing has been clicked
        if (pokemon.length > 0) {
            // Show the first pokemon's details (use its url)
            const firstUrl = pokemon[0].url;
            try {
                await showPokemonByUrl(firstUrl);
            } catch (oops) {
                console.error('Failed to show default pokemon:', oops);
            }
        }
    } catch (err) {
        loading.remove();
        showError(app, err.message || err.toString());
        console.error(err);
    }
}

init();