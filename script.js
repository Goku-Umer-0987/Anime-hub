// ============================================
// ANIME HUB — AniList API + YouTube + Legal Platforms
// ============================================

const API_URL = 'https://graphql.anilist.co';

let currentPage = 1;
let currentGenre = '';
let currentSearch = '';
let isLoading = false;
let trendingAnime = [];

// DOM Elements
const grid = document.getElementById('animeGrid');
const searchBox = document.getElementById('searchBox');
const loader = document.getElementById('loader');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const filterBtns = document.querySelectorAll('.filter-btn');
const hoverBg = document.getElementById('hoverBg');
const themeBtns = document.querySelectorAll('.theme-btn');
const trendingScroll = document.getElementById('trendingScroll');
const heroCover = document.getElementById('heroCover');
const heroTitle = document.getElementById('heroTitle');
const heroDesc = document.getElementById('heroDesc');
const heroWatch = document.getElementById('heroWatch');
const heroInfo = document.getElementById('heroInfo');

const modalOverlay = document.getElementById('modalOverlay');
const modalClose = document.getElementById('modalClose');
const modalTitle = document.getElementById('modalTitle');
const modalYear = document.getElementById('modalYear');
const modalRating = document.getElementById('modalRating');
const modalType = document.getElementById('modalType');
const modalDesc = document.getElementById('modalDesc');
const modalPlatforms = document.getElementById('modalPlatforms');

const GENRE_MAP = {
  '': null, '1': 'Action', '2': 'Adventure', '4': 'Comedy', '8': 'Drama',
  '10': 'Fantasy', '22': 'Romance', '24': 'Sci-Fi', '30': 'Sports', '37': 'Supernatural'
};

// ============================================
// THEME
// ============================================

const savedTheme = localStorage.getItem('anime-theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

themeBtns.forEach(function (btn) {
  if (btn.dataset.theme === savedTheme) btn.classList.add('active');
  else btn.classList.remove('active');

  btn.addEventListener('click', function () {
    const theme = btn.dataset.theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('anime-theme', theme);
    themeBtns.forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
  });
});

// ============================================
// HELPERS
// ============================================

function getTitle(a) {
  return (a.title && (a.title.english || a.title.romaji)) || 'Unknown';
}
function getCover(a) {
  return (a.coverImage && (a.coverImage.large || a.coverImage.medium)) || '';
}
function getYear(a) {
  return (a.startDate && a.startDate.year) || 'N/A';
}
function getRating(a) {
  return a.averageScore ? '⭐ ' + (a.averageScore / 10).toFixed(1) : '⭐ N/A';
}
function cleanDesc(text) {
  if (!text) return 'No description available.';
  return text.replace(/<[^>]*>/g, '').slice(0, 500);
}

// ============================================
// ANILIST FETCH
// ============================================

async function anilistFetch(query, variables) {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query: query, variables: variables })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } catch (err) {
    console.error('Fetch error:', err);
    return null;
  }
}

const FIELDS = `
  id
  title { english romaji }
  coverImage { large medium }
  startDate { year }
  averageScore
  description
  episodes
  format
`;

// ============================================
// FEATURED + TRENDING
// ============================================

async function loadFeaturedAndTrending() {
  const query = `
    query {
      Page(page: 1, perPage: 11) {
        media(type: ANIME, sort: TRENDING_DESC, isAdult: false) {
          ${FIELDS}
        }
      }
    }
  `;

  const json = await anilistFetch(query, {});
  if (!json || !json.data || !json.data.Page) return;

  const list = json.data.Page.media;
  if (!list || list.length === 0) return;

  // Featured
  const featured = list[0];
  heroCover.src = getCover(featured);
  heroCover.setAttribute('referrerpolicy', 'no-referrer');
  heroCover.onerror = function () {
    this.onerror = null;
    this.style.background = 'linear-gradient(135deg, #ff4d6d, #a78bfa, #7dd3fc)';
  };
  heroTitle.textContent = getTitle(featured);
  heroDesc.textContent = cleanDesc(featured.description);

  heroWatch.onclick = function () { openModal(featured); };
  heroInfo.onclick = function () { openModal(featured); };

  // Trending = top 10
  trendingAnime = list.slice(0, 10);
  trendingScroll.innerHTML = '';
  trendingAnime.forEach(function (anime, i) {
    const card = document.createElement('div');
    card.className = 'trending-card';

    const img = document.createElement('img');
    img.src = getCover(anime);
    img.alt = getTitle(anime);
    img.loading = 'lazy';
    img.setAttribute('referrerpolicy', 'no-referrer');
    img.onerror = function () {
      this.onerror = null;
      this.style.background = 'linear-gradient(135deg, #ff4d6d, #a78bfa, #7dd3fc)';
    };

    const rank = document.createElement('div');
    rank.className = 'trending-rank';
    rank.textContent = i + 1;

    const t = document.createElement('div');
    t.className = 't-title';
    t.textContent = getTitle(anime);

    card.appendChild(img);
    card.appendChild(rank);
    card.appendChild(t);
    card.addEventListener('click', function () { openModal(anime); });

    trendingScroll.appendChild(card);
  });
}

// ============================================
// FETCH MAIN GRID
// ============================================

async function fetchAnime() {
  if (isLoading) return;
  isLoading = true;
  loader.classList.add('active');

  try {
    const genre = GENRE_MAP[currentGenre] || null;
    let query, variables;

    if (currentSearch) {
      query = `query ($search: String, $page: Int) {
        Page(page: $page, perPage: 24) {
          pageInfo { hasNextPage }
          media(type: ANIME, search: $search, sort: POPULARITY_DESC, isAdult: false) { ${FIELDS} }
        }
      }`;
      variables = { search: currentSearch, page: currentPage };
    } else if (genre) {
      query = `query ($genre: String, $page: Int) {
        Page(page: $page, perPage: 24) {
          pageInfo { hasNextPage }
          media(type: ANIME, genre: $genre, sort: POPULARITY_DESC, isAdult: false) { ${FIELDS} }
        }
      }`;
      variables = { genre: genre, page: currentPage };
    } else {
      query = `query ($page: Int) {
        Page(page: $page, perPage: 24) {
          pageInfo { hasNextPage }
          media(type: ANIME, sort: POPULARITY_DESC, isAdult: false) { ${FIELDS} }
        }
      }`;
      variables = { page: currentPage };
    }

    const json = await anilistFetch(query, variables);

    if (!json || !json.data || !json.data.Page || !json.data.Page.media || json.data.Page.media.length === 0) {
      if (currentPage === 1) {
        grid.innerHTML = '<div class="no-results">😢 No anime found. Try another search.</div>';
      }
      loadMoreBtn.disabled = true;
      loadMoreBtn.textContent = 'No more results';
      return;
    }

    const media = json.data.Page.media;
    const hasNext = json.data.Page.pageInfo.hasNextPage;

    renderCards(media, currentPage === 1);

    if (hasNext) {
      loadMoreBtn.disabled = false;
      loadMoreBtn.textContent = 'Load More 🔄';
    } else {
      loadMoreBtn.disabled = true;
      loadMoreBtn.textContent = '✅ All anime loaded';
    }
  } catch (err) {
    console.error('Error:', err);
    if (currentPage === 1) {
      grid.innerHTML = '<div class="no-results">⚠️ Failed to load. Please refresh.</div>';
    }
  } finally {
    isLoading = false;
    loader.classList.remove('active');
  }
}

// ============================================
// RENDER CARDS
// ============================================

function renderCards(animeList, clearFirst) {
  if (clearFirst) grid.innerHTML = '';

  animeList.forEach(function (anime) {
    const card = document.createElement('div');
    card.className = 'card';

    const title = getTitle(anime);
    const cover = getCover(anime);
    const year = getYear(anime);
    const rating = getRating(anime);

    const img = document.createElement('img');
    img.alt = title;
    img.loading = 'lazy';
    img.setAttribute('referrerpolicy', 'no-referrer');
    if (cover) img.src = cover;
    img.onerror = function () {
      this.onerror = null;
      this.removeAttribute('src');
      this.style.background = 'linear-gradient(135deg, #ff4d6d, #a78bfa, #7dd3fc)';
      this.style.minHeight = '280px';
    };
    card.appendChild(img);

    const info = document.createElement('div');
    info.className = 'card-info';
    info.innerHTML =
      '<h3>' + title.replace(/</g, '&lt;') + '</h3>' +
      '<div class="meta"><span>' + year + '</span><span class="rating">' + rating + '</span></div>' +
      '<span class="platform">Multiple Platforms</span>';
    card.appendChild(info);

    card.addEventListener('mouseenter', function () {
      if (cover) {
        hoverBg.style.backgroundImage = "url('" + cover + "')";
        hoverBg.classList.add('active');
      }
    });
    card.addEventListener('mouseleave', function () {
      hoverBg.classList.remove('active');
    });
    card.addEventListener('click', function () { openModal(anime); });

    grid.appendChild(card);
  });

  console.log('✅ Rendered ' + animeList.length + ' anime');
}

// ============================================
// OPEN MODAL
// ============================================

async function openModal(anime) {
  const title = getTitle(anime);
  const year = getYear(anime);
  const rating = getRating(anime);
  const type = anime.format ? anime.format.replace(/_/g, ' ') : 'TV';
  const episodes = anime.episodes ? anime.episodes + ' episodes' : '';
  const desc = cleanDesc(anime.description);

  modalTitle.textContent = title;
  modalYear.textContent = '📅 ' + year;
  modalRating.textContent = rating;
  modalType.textContent = '📺 ' + type + (episodes ? ' • ' + episodes : '');
  modalDesc.textContent = desc;

  // Show modal
  modalOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';

  // YouTube player
  const player = document.getElementById('youtubePlayer');
  if (player) player.src = 'about:blank';

  // Fetch trailer from AniList
  let trailerId = null;
  try {
    const q = `
      query ($id: Int) {
        Media(id: $id) {
          trailer { id site }
        }
      }
    `;
    const json = await anilistFetch(q, { id: anime.id });
    if (json && json.data && json.data.Media && json.data.Media.trailer) {
      const t = json.data.Media.trailer;
      if (t.site === 'youtube' && t.id) trailerId = t.id;
    }
  } catch (err) { console.warn('Trailer fetch failed:', err); }

  if (player) {
    if (trailerId) {
      player.src = 'https://www.youtube.com/embed/' + trailerId + '?autoplay=1&rel=0';
    } else {
      player.src = 'https://www.youtube.com/embed?listType=search&list=' +
                   encodeURIComponent(title + ' anime official trailer') + '&autoplay=0';
    }
  }

  // ============================================
  // 8 FREE LEGAL ANIME PLATFORMS
  // ============================================
  const q = encodeURIComponent(title);
  const platforms = [
    { name: 'Muse Asia 🎌', icon: '🎌', cls: 'muse', url: 'https://www.youtube.com/@MuseAsia/search?query=' + q },
    { name: 'Muse India', icon: '🎬', cls: 'muse', url: 'https://www.youtube.com/@MuseIndia/search?query=' + q },
    { name: 'RetroCrush', icon: '📺', cls: 'hidive', url: 'https://www.retrocrush.tv/search?q=' + q },
    { name: 'AnimePlanet', icon: '🌐', cls: 'prime', url: 'https://www.anime-planet.com/anime/all?name=' + q },
    { name: 'Tubi TV', icon: '🟣', cls: 'netflix', url: 'https://tubitv.com/search/' + q },
    { name: 'Pluto TV', icon: '🔵', cls: 'hulu', url: 'https://pluto.tv/en/search/' + q },
    { name: 'Crunchyroll', icon: '🟠', cls: 'crunchyroll', url: 'https://www.crunchyroll.com/search?q=' + q },
    { name: 'YouTube Search', icon: '🎥', cls: 'google', url: 'https://www.youtube.com/results?search_query=' + q + '+anime+full+episode' }
  ];

  let html = '';
  platforms.forEach(function (p) {
    html += '<a href="' + p.url + '" target="_blank" rel="noopener noreferrer" class="platform-btn ' + p.cls + '">' +
            '<span class="icon">' + p.icon + '</span><span>' + p.name + '</span></a>';
  });
  modalPlatforms.innerHTML = html;
}

// ============================================
// CLOSE MODAL
// ============================================

function closeModal() {
  modalOverlay.classList.remove('active');
  document.body.style.overflow = '';
  const player = document.getElementById('youtubePlayer');
  if (player) player.src = 'about:blank';
}

modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', function (e) {
  if (e.target === modalOverlay) closeModal();
});
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') closeModal();
});

// ============================================
// SEARCH
// ============================================

let searchTimeout;
searchBox.addEventListener('input', function (e) {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(function () {
    currentSearch = e.target.value.trim();
    currentGenre = '';
    currentPage = 1;
    filterBtns.forEach(function (b) { b.classList.remove('active'); });
    document.querySelector('[data-genre=""]').classList.add('active');
    fetchAnime();
  }, 700);
});

// ============================================
// GENRE FILTER
// ============================================

filterBtns.forEach(function (btn) {
  btn.addEventListener('click', function () {
    filterBtns.forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
    currentGenre = btn.dataset.genre;
    currentSearch = '';
    searchBox.value = '';
    currentPage = 1;
    fetchAnime();
  });
});

// ============================================
// LOAD MORE
// ============================================

loadMoreBtn.addEventListener('click', function () {
  currentPage++;
  fetchAnime();
});

// ============================================
// START
// ============================================

console.log('🎯 Anime Hub started (AniList + YouTube + Legal Platforms)');
loadFeaturedAndTrending();
fetchAnime();