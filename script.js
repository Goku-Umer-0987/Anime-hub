// ============================================
// ANIME HUB — AniList API (Reliable)
// ============================================

const API_URL = 'https://graphql.anilist.co';

let currentPage = 1;
let currentGenre = '';
let currentSearch = '';
let isLoading = false;

// DOM
const grid = document.getElementById('animeGrid');
const searchBox = document.getElementById('searchBox');
const loader = document.getElementById('loader');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const filterBtns = document.querySelectorAll('.filter-btn');
const hoverBg = document.getElementById('hoverBg');
const themeBtns = document.querySelectorAll('.theme-btn');
const modalOverlay = document.getElementById('modalOverlay');
const modalClose = document.getElementById('modalClose');
const modalCover = document.getElementById('modalCover');
const modalTitle = document.getElementById('modalTitle');
const modalYear = document.getElementById('modalYear');
const modalRating = document.getElementById('modalRating');
const modalType = document.getElementById('modalType');
const modalDesc = document.getElementById('modalDesc');
const modalPlatforms = document.getElementById('modalPlatforms');

// Genre mapping (AniList genre names)
const GENRE_MAP = {
  '': null,
  '1': 'Action',
  '2': 'Adventure',
  '4': 'Comedy',
  '8': 'Drama',
  '10': 'Fantasy',
  '22': 'Romance',
  '24': 'Sci-Fi',
  '30': 'Sports',
  '37': 'Supernatural'
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
// GRAPHQL QUERY BUILDER
// ============================================

function buildQuery() {
  const genre = GENRE_MAP[currentGenre] || null;

  const mediaFields = `
    id
    title { english romaji }
    coverImage { large medium }
    startDate { year }
    averageScore
    description
    episodes
    format
    genres
  `;

  // SEARCH MODE
  if (currentSearch) {
    return {
      query: `
        query ($search: String, $page: Int) {
          Page(page: $page, perPage: 24) {
            pageInfo { hasNextPage currentPage }
            media(type: ANIME, search: $search, sort: POPULARITY_DESC, isAdult: false) {
              ${mediaFields}
            }
          }
        }
      `,
      variables: { search: currentSearch, page: currentPage }
    };
  }

  // GENRE MODE
  if (genre) {
    return {
      query: `
        query ($genre: String, $page: Int) {
          Page(page: $page, perPage: 24) {
            pageInfo { hasNextPage currentPage }
            media(type: ANIME, genre: $genre, sort: POPULARITY_DESC, isAdult: false) {
              ${mediaFields}
            }
          }
        }
      `,
      variables: { genre: genre, page: currentPage }
    };
  }

  // TOP ANIME (default)
  return {
    query: `
      query ($page: Int) {
        Page(page: $page, perPage: 24) {
          pageInfo { hasNextPage currentPage }
          media(type: ANIME, sort: POPULARITY_DESC, isAdult: false) {
            ${mediaFields}
          }
        }
      }
    `,
    variables: { page: currentPage }
  };
}

// ============================================
// FETCH ANIME
// ============================================

async function fetchAnime() {
  if (isLoading) return;
  isLoading = true;
  loader.classList.add('active');

  try {
    const body = buildQuery();

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) throw new Error('HTTP ' + res.status);

    const json = await res.json();
    const media = json.data.Page.media;
    const pageInfo = json.data.Page.pageInfo;

    if (!media || media.length === 0) {
      if (currentPage === 1) {
        grid.innerHTML = '<div class="no-results">😢 No anime found. Try another search.</div>';
      }
      loadMoreBtn.disabled = true;
      loadMoreBtn.textContent = 'No more results';
      return;
    }

    renderCards(media, currentPage === 1);

    if (pageInfo.hasNextPage) {
      loadMoreBtn.disabled = false;
      loadMoreBtn.textContent = 'Load More 🔄';
    } else {
      loadMoreBtn.disabled = true;
      loadMoreBtn.textContent = '✅ All anime loaded';
    }

  } catch (err) {
    console.error('❌ Error:', err);
    if (currentPage === 1) {
      grid.innerHTML = '<div class="no-results">⚠️ Failed to load. Please refresh (F5).</div>';
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

    const title = (anime.title && (anime.title.english || anime.title.romaji)) || 'Unknown';
    const cover = (anime.coverImage && (anime.coverImage.large || anime.coverImage.medium)) || '';
    const year = (anime.startDate && anime.startDate.year) || 'N/A';
    const rating = anime.averageScore ? '⭐ ' + (anime.averageScore / 10).toFixed(1) : '⭐ N/A';

    // IMAGE
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

    // INFO
    const info = document.createElement('div');
    info.className = 'card-info';

    const h3 = document.createElement('h3');
    h3.textContent = title;
    h3.title = title;

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.innerHTML = '<span>' + year + '</span><span class="rating">' + rating + '</span>';

    const platform = document.createElement('span');
    platform.className = 'platform';
    platform.textContent = 'Multiple Platforms';

    info.appendChild(h3);
    info.appendChild(meta);
    info.appendChild(platform);
    card.appendChild(info);

    // HOVER
    card.addEventListener('mouseenter', function () {
      if (cover) {
        hoverBg.style.backgroundImage = "url('" + cover + "')";
        hoverBg.classList.add('active');
        document.body.classList.add('has-hover');
      }
    });

    card.addEventListener('mouseleave', function () {
      hoverBg.classList.remove('active');
      document.body.classList.remove('has-hover');
    });

    // CLICK
    card.addEventListener('click', function () {
      openModal(anime);
    });

    grid.appendChild(card);
  });

  console.log('✅ Rendered ' + animeList.length + ' anime');
}

// ============================================
// OPEN MODAL
// ============================================

function openModal(anime) {
  const title = (anime.title && (anime.title.english || anime.title.romaji)) || 'Unknown';
  const cover = (anime.coverImage && (anime.coverImage.large || anime.coverImage.medium)) || '';
  const year = (anime.startDate && anime.startDate.year) || 'N/A';
  const rating = anime.averageScore ? '⭐ ' + (anime.averageScore / 10).toFixed(1) : '⭐ N/A';
  const type = anime.format ? anime.format.replace(/_/g, ' ') : 'TV';
  const episodes = anime.episodes ? anime.episodes + ' episodes' : '';
  const desc = anime.description
    ? anime.description.replace(/<[^>]*>/g, '').slice(0, 500)
    : 'No description available.';

  // Cover
  modalCover.setAttribute('referrerpolicy', 'no-referrer');
  modalCover.onerror = function () {
    this.onerror = null;
    this.removeAttribute('src');
    this.style.background = 'linear-gradient(135deg, #ff4d6d, #a78bfa, #7dd3fc)';
  };
  modalCover.src = cover || '';

  modalTitle.textContent = title;
  modalYear.textContent = '📅 ' + year;
  modalRating.textContent = rating;
  modalType.textContent = '📺 ' + type + (episodes ? ' • ' + episodes : '');
  modalDesc.textContent = desc;

  // Platforms
  const q = encodeURIComponent(title);
  const platforms = [
    { name: 'Crunchyroll', icon: '🟠', cls: 'crunchyroll', url: 'https://www.crunchyroll.com/search?q=' + q },
    { name: 'Netflix', icon: '🔴', cls: 'netflix', url: 'https://www.netflix.com/search?q=' + q },
    { name: 'Muse Asia', icon: '🔵', cls: 'muse', url: 'https://www.youtube.com/@MuseAsia/search?query=' + q },
    { name: 'HIDIVE', icon: '🟣', cls: 'hidive', url: 'https://www.hidive.com/search?q=' + q },
    { name: 'Prime Video', icon: '🟢', cls: 'prime', url: 'https://www.amazon.com/s?k=' + q + '+anime&i=instant-video' },
    { name: 'Hulu', icon: '🟡', cls: 'hulu', url: 'https://www.hulu.com/search?q=' + q },
    { name: 'Google', icon: '🔍', cls: 'google', url: 'https://www.google.com/search?q=watch+' + q + '+anime+legally' }
  ];

  let html = '';
  platforms.forEach(function (p) {
    html += '<a href="' + p.url + '" target="_blank" rel="noopener noreferrer" class="platform-btn ' + p.cls + '">' +
              '<span class="icon">' + p.icon + '</span>' +
              '<span>' + p.name + '</span>' +
            '</a>';
  });
  modalPlatforms.innerHTML = html;

  modalOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

// ============================================
// CLOSE MODAL
// ============================================

function closeModal() {
  modalOverlay.classList.remove('active');
  document.body.style.overflow = '';
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

console.log('🎯 Anime Hub started (AniList API)');
fetchAnime();