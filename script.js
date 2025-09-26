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

let pokemonList = [];
let currentIndex = 0;

function renderNavigation(parent, items) {
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

    let nav = document.getElementById('pokemon-nav');
    if (!nav) {
        nav = document.createElement('div');
        nav.id = 'pokemon-nav';
        nav.style.display = 'flex';
        nav.style.gap = '8px';
        nav.style.alignItems = 'center';
        nav.style.marginBottom = '12px';
        parent.appendChild(nav);
    } else {
        nav.innerHTML = '';
    }

    const prev = document.createElement('button');
    prev.id = 'btn-prev';
    prev.textContent = '◀ Previous';
    prev.addEventListener('click', () => showPokemonByIndex(currentIndex - 1));

    const next = document.createElement('button');
    next.id = 'btn-next';
    next.textContent = 'Next ▶';
    next.addEventListener('click', () => showPokemonByIndex(currentIndex + 1));

    const counter = document.createElement('div');
    counter.id = 'nav-counter';
    counter.style.marginLeft = '8px';
    counter.style.fontSize = '0.95rem';

    nav.appendChild(prev);
    nav.appendChild(next);
    nav.appendChild(counter);

    updateNavState();
}

const detailsCache = new Map();

async function fetchPokemonDetails(url) {
    if (detailsCache.has(url)) return detailsCache.get(url);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Detail fetch failed: ${res.status} ${res.statusText}`);
    const data = await res.json();
    detailsCache.set(url, data);
    return data;
}

async function showPokemonByUrl(url) {
    const detail = document.getElementById('pokemon-detail');
    if (!detail) throw new Error('Detail container missing');

    detail.innerHTML = '';

    const loading = document.createElement('span');
    loading.textContent = 'Loading...';
    detail.appendChild(loading);

    const data = await fetchPokemonDetails(url);

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
   title.style.cursor = 'pointer';
    title.title = 'Click for more details';
    title.addEventListener('click', () => showFullDetails(data));
    info.appendChild(title);

    if (Array.isArray(data.types)) {
        const types = document.createElement('p');
        types.style.margin = '4px 0 0 0';
        types.textContent = 'Type: ' + data.types.map(t => capitalize(t.type.name)).join(', ');
        info.appendChild(types);
    }

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

function showFullDetails(data) {
    const app = document.getElementById('app');
    if (!app) return;

    let panel = document.getElementById('pokemon-full-details');
    if (!panel) {
        panel = document.createElement('section');
        panel.id = 'pokemon-full-details';
        panel.style.marginTop = '12px';
        panel.style.padding = '12px';
        panel.style.border = '1px solid #eee';
        panel.style.borderRadius = '8px';
        panel.style.background = '#fff';
        app.appendChild(panel);
    }

    panel.innerHTML = '';

    const heading = document.createElement('h3');
    heading.textContent = `Details — ${capitalize(data.name)} (#${data.id})`;
    heading.style.marginTop = '0';
    panel.appendChild(heading);

    const basics = document.createElement('p');
    basics.textContent = `Height: ${data.height} | Weight: ${data.weight}`;
    panel.appendChild(basics);

    if (Array.isArray(data.abilities)) {
        const ab = document.createElement('p');
        ab.style.margin = '6px 0 0 0';
        ab.textContent = 'Abilities: ' + data.abilities.map(a => capitalize(a.ability.name) + (a.is_hidden ? ' (hidden)' : '')).join(', ');
        panel.appendChild(ab);
    }

    if (Array.isArray(data.stats)) {
        const statsWrap = document.createElement('div');
        statsWrap.style.marginTop = '8px';
        const statsTitle = document.createElement('strong');
        statsTitle.textContent = 'Stats:';
        statsWrap.appendChild(statsTitle);
        const ul = document.createElement('ul');
        ul.style.margin = '6px 0 0 16px';
        data.stats.forEach(s => {
            const li = document.createElement('li');
            li.textContent = `${capitalize(s.stat.name)}: ${s.base_stat}`;
            ul.appendChild(li);
        });
        statsWrap.appendChild(ul);
        panel.appendChild(statsWrap);
    }

    if (Array.isArray(data.moves)) {
        const mv = document.createElement('div');
        mv.style.marginTop = '8px';
        const mvTitle = document.createElement('strong');
        mvTitle.textContent = 'Moves (sample):';
        mv.appendChild(mvTitle);
        const list = document.createElement('p');
        list.style.margin = '6px 0 0 0';
        list.textContent = data.moves.slice(0, 8).map(m => capitalize(m.move.name)).join(', ');
        mv.appendChild(list);
        panel.appendChild(mv);
    }

    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function capitalize(s) {
    return String(s).charAt(0).toUpperCase() + String(s).slice(1);
}

function getAudioCandidateUrls(data) {
    const id = data.id; // numeric id
    const name = String(data.name || '').toLowerCase();

    const normalize = (s) => s.replace(/[^a-z0-9-]/g, '-');

    const candidates = [];

    candidates.push(`https://play.pokemonshowdown.com/audio/cries/${normalize(name)}.mp3`);

    if (Number.isInteger(id)) {
        candidates.push(`https://archives.bulbagarden.net/media/sound/ogg/vg/cries/${id}.ogg`);
        candidates.push(`https://pokemoncries.com/cries/${id}.mp3`);
    }

    candidates.push(`https://raw.githubusercontent.com/msikma/pokesprite/master/sprites/pokemon/384x384/${id}.png`);

    return [...new Set(candidates)];
}

function createAudioWithFallback(urls) {
    return new Promise((resolve) => {
        let i = 0;
        const tryNext = () => {
            if (i >= urls.length) return resolve(null);
            const url = urls[i++];
            const audio = document.createElement('audio');
            audio.src = url;
            const onCanPlay = () => cleanup(true);
            const onError = () => cleanup(false);

            function cleanup(success) {
                audio.removeEventListener('canplay', onCanPlay);
                audio.removeEventListener('canplaythrough', onCanPlay);
                audio.removeEventListener('error', onError);
                if (success) return resolve(audio);
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

function updateNavState() {
    const prev = document.getElementById('btn-prev');
    const next = document.getElementById('btn-next');
    const counter = document.getElementById('nav-counter');
    if (!prev || !next || !counter) return;

    prev.disabled = currentIndex <= 0;
    next.disabled = currentIndex >= Math.max(0, pokemonList.length - 1);
    counter.textContent = `${currentIndex + 1} / ${pokemonList.length}`;
}

async function showPokemonByIndex(index) {
    if (!Array.isArray(pokemonList) || pokemonList.length === 0) return;
    if (index < 0) index = 0;
    if (index >= pokemonList.length) index = pokemonList.length - 1;
    currentIndex = index;
    updateNavState();
    const url = pokemonList[currentIndex].url;
    try {
        await showPokemonByUrl(url);
    } catch (err) {
        console.error('Failed to load pokemon details for index', currentIndex, err);
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
        pokemonList = pokemon;
        renderNavigation(app, pokemonList);
        if (pokemonList.length > 0) {
            await showPokemonByIndex(0);
        }
    } catch (err) {
        loading.remove();
        showError(app, err.message || err.toString());
        console.error(err);
    }
}

init();