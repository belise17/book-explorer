
import "./style.css";

const app = document.querySelector("#app");
const API = "https://gutendex.com/books/";
const STORAGE = "book-explorer-favorites-v1";

let books = [];
let favorites = JSON.parse(localStorage.getItem(STORAGE) || "[]");
let category = "All";
let search = "";
let activeBook = null;
let pages = [];
let page = 0;
let nextUrl = null;
let previousUrl = null;
let loading = false;
let requestController = null;

const categories = [
  "All",
  "Fiction",
  "History",
  "Science",
  "Adventure",
  "Fantasy",
];

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[char];
  });
}

function getAuthors(book) {
  return book.authors?.map((author) => author.name).join(", ") ||
    "Unknown author";
}

function getCover(book) {
  return book.cover || "";
}

function getBookLink(book) {
  return book.readUrl || "";
}

function saveFavorites() {
  localStorage.setItem(STORAGE, JSON.stringify(favorites));
}

function isFavorite(id) {
  return favorites.some((book) => String(book.id) === String(id));
}

function getBook(id) {
  return books.find((book) => String(book.id) === String(id)) ||
    favorites.find((book) => String(book.id) === String(id));
}

// Get books from Gutendex
async function fetchBooks(url = API, query = "") {
  const endpoint = new URL(url);

  endpoint.searchParams.set("languages", "en");

  if (query) {
    endpoint.searchParams.set("search", query);
  } else {
    endpoint.searchParams.delete("search");
  }

  const response = await fetch(endpoint, {
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error("Could not load books.");
  }

  const data = await response.json();

  return {
    books: (data.results || []).map((book) => {
      const formats = book.formats || {};

      const textKey = Object.keys(formats).find(
        (key) =>
          key.startsWith("text/plain") &&
          !key.includes("zip")
      );

      return {
        id: String(book.id),
        title: book.title || "Untitled",
        author:
          book.authors?.map((author) => author.name).join(", ") ||
          "Unknown author",
        authors: book.authors || [],
        cover: formats["image/jpeg"] || "",
        category:
          book.bookshelves?.[0] ||
          book.subjects?.[0] ||
          "Literature",
        subjects: book.subjects || [],
        description:
          book.summaries?.[0] || "No summary available.",
        readUrl: textKey ? formats[textKey] : "",
        formats,
        downloadCount: book.download_count || 0,
      };
    }),
    next: data.next,
    previous: data.previous,
  };
}

// Main page
function renderApp() {
  app.innerHTML = `
    <header class="site-header">
      <a href="#" class="brand" data-view="home">
        📚 Book Explorer
      </a>

      <button
        id="menu-toggle"
        class="menu-toggle"
        aria-label="Toggle navigation"
        aria-expanded="false"
      >☰</button>

      <nav class="site-nav" id="navigation">
        <a href="#discover" class="nav-link active" data-view="home">
          Discover
        </a>

        <a href="#favorites" class="nav-link" data-view="favorites">
          Favorites ❤️ <span id="favorite-count">0</span>
        </a>

        <a href="#about" class="nav-link" data-view="about">
          About
        </a>
      </nav>
    </header>

    <main>
      <section class="hero" id="hero-section">
        <div class="hero-content">
          <span class="eyebrow">YOUR NEXT CHAPTER STARTS HERE</span>

          <h1>Discover a world of <span>great books.</span></h1>

          <p>
            Find books, save your favorites, and read available texts.
          </p>

          <form id="search-form" class="search-container">
            <input
              id="book-search"
              type="search"
              placeholder="Search books or authors..."
              aria-label="Search books or authors"
            />
            <button type="submit">Search</button>
          </form>
        </div>
      </section>

      <section class="content-section" id="home-section">
        <div class="section-heading">
          <h2>Explore Books</h2>
          <p id="results-description">Books from Gutendex</p>
        </div>

        <div id="category-list" class="category-list"></div>

        <div id="status-message" class="status-message"></div>

        <div id="books-grid" class="book-grid"></div>

        <div id="pagination" class="pagination"></div>
      </section>

      <section class="content-section" id="favorites-section" hidden>
        <div class="section-heading">
          <h2>My Favorites ❤️</h2>
          <p>Your saved books.</p>
        </div>

        <div id="favorites-grid" class="book-grid"></div>
      </section>

     
<section class="content-section about-section" id="about-section">
  <div class="about-content">
    <span class="eyebrow">DISCOVER • EXPLORE • READ</span>

    <h2>Every Book Opens a New World</h2>

    <p class="about-intro">
      Welcome to Book Explorer, your little corner of the world
      where stories come alive and knowledge has no limits.
    </p>

    <p>
      Discover fascinating books, explore different genres, save
      your favorite stories, and enjoy reading classic literature.
      Whether you love adventure, romance, history, or mystery,
      there is always a new story waiting for you.
    </p>

    <div class="about-features">
      <div class="about-feature">
        <span>📚</span>
        <h3>Discover Books</h3>
        <p>Explore a world of books across different genres.</p>
      </div>

      <div class="about-feature">
        <span>❤️</span>
        <h3>Save Favorites</h3>
        <p>Keep your favorite books close whenever you need them.</p>
      </div>

      <div class="about-feature">
        <span>✨</span>
        <h3>Enjoy Reading</h3>
        <p>Find inspiration, imagination, and new ideas in every story.</p>
      </div>
    </div>
  </div>
</section>


    <footer class="site-footer">
      <p>📚 Book Explorer — Discover a book. Discover a world.</p>
      <p>Explore stories and enjoy reading.</p>
    </footer>

    <div id="modal-root"></div>
    <div id="reader-root"></div>
  `;
}

// Render book cards
function renderBooks(list, target = "#books-grid") {
  const grid = document.querySelector(target);
  if (!grid) return;

  if (!list.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <h3>No books found</h3>
        <p>Try another search or category.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = list.map((book) => `
    <article class="book-card">
      <button
        class="favorite-button ${isFavorite(book.id) ? "active" : ""}"
        data-action="favorite"
        data-id="${escapeHTML(book.id)}"
        aria-label="${isFavorite(book.id) ? "Remove favorite" : "Add favorite"}"
      >${isFavorite(book.id) ? "♥" : "♡"}</button>

      <button
        class="book-cover-button"
        data-action="details"
        data-id="${escapeHTML(book.id)}"
        aria-label="View details for ${escapeHTML(book.title)}"
      >
        <div class="book-cover">
          ${
            book.cover
              ? `<img src="${escapeHTML(book.cover)}"
                   alt="Cover of ${escapeHTML(book.title)}"
                   loading="lazy"
                   onerror="this.style.display='none'">`
              : ""
          }

          <div class="cover-placeholder">
            <span>📖</span>
            <p>${escapeHTML(book.title)}</p>
          </div>
        </div>
      </button>

      <div class="book-card-content">
        <span class="book-category">
          ${escapeHTML(book.category)}
        </span>

        <h3>
          <button
            class="book-title-button"
            data-action="details"
            data-id="${escapeHTML(book.id)}"
          >${escapeHTML(book.title)}</button>
        </h3>

        <p class="book-author">
          ${escapeHTML(book.author)}
        </p>

        <p class="book-description">
          ${escapeHTML(book.description)}
        </p>

        <div class="book-card-actions">
          <button
            class="read-button"
            data-action="details"
            data-id="${escapeHTML(book.id)}"
          >Book details</button>
        </div>
      </div>
    </article>
  `).join("");
}

// Category buttons
function renderCategories() {
  const container = document.querySelector("#category-list");
  if (!container) return;

  const availableCategories = [
    "All",
    ...new Set(
      books.map((book) => {
        const subjects = book.subjects || [];
        const match = subjects.find((subject) =>
          categories.slice(1).some((name) =>
            subject.toLowerCase().includes(name.toLowerCase())
          )
        );

        return match
          ? categories.slice(1).find((name) =>
              match.toLowerCase().includes(name.toLowerCase())
            )
          : book.category;
      })
    ),
  ].filter(Boolean).slice(0, 12);

  const finalCategories = availableCategories.includes(category)
    ? availableCategories
    : ["All", ...availableCategories.filter((item) => item !== "All")];

  container.innerHTML = finalCategories.map((item) => `
    <button
      class="category-chip ${category === item ? "active" : ""}"
      data-action="category"
      data-category="${escapeHTML(item)}"
    >${escapeHTML(item)}</button>
  `).join("");
}

// Search and filter books
function applyFilters() {
  const term = search.toLowerCase();

  const filtered = books.filter((book) => {
    const matchesSearch =
      book.title.toLowerCase().includes(term) ||
      book.author.toLowerCase().includes(term);

    const matchesCategory =
      category === "All" ||
      book.category === category ||
      book.subjects?.some((subject) =>
        subject.toLowerCase().includes(category.toLowerCase())
      );

    return matchesSearch && matchesCategory;
  });

  renderBooks(filtered);

  const description = document.querySelector("#results-description");
  if (description) {
    description.textContent = `${filtered.length} books shown`;
  }
}

// Load books
async function loadBooks(url = API, query = "") {
  if (requestController) {
    requestController.abort();
  }

  requestController = new AbortController();
  const currentController = requestController;

  loading = true;

  const status = document.querySelector("#status-message");
  const pagination = document.querySelector("#pagination");

  if (status) {
    status.hidden = false;
    status.textContent = "Loading books from Gutendex...";
  }

  if (pagination) pagination.innerHTML = "";

  try {
    const result = await fetchBooks(url, query);

    if (currentController !== requestController) return;

    books = result.books;
    nextUrl = result.next;
    previousUrl = result.previous;

    renderCategories();
    applyFilters();
    renderPagination();

    if (status) status.hidden = true;
  } catch (error) {
    if (error.name === "AbortError") return;

    console.error("Book loading error:", error);

    if (status) {
      status.hidden = false;
      status.innerHTML = `
        <p>Books could not load. Check your internet connection.</p>
        <button class="secondary-button" data-action="retry">
          Try again
        </button>
      `;
    }
  } finally {
    if (currentController === requestController) {
      loading = false;
    }
  }
}

// Pagination
function renderPagination() {
  const container = document.querySelector("#pagination");
  if (!container) return;

  container.innerHTML = `
    ${
      previousUrl
        ? `<button data-action="previous">← Previous</button>`
        : ""
    }

    ${
      nextUrl
        ? `<button data-action="next">Load more books →</button>`
        : ""
    }
  `;
}

// Navigation
function showView(view) {
  const home = document.querySelector("#home-section");
  const favoritesSection = document.querySelector("#favorites-section");
  const about = document.querySelector("#about-section");
  const hero = document.querySelector("#hero-section");

  home.hidden = view !== "home";
  favoritesSection.hidden = view !== "favorites";

  // About igaragara munsi y'ibitabo kuri Home.
  // Igaragara no ku rupapuro rwa About, ariko igahishwa kuri Favorites.
  about.hidden = view === "favorites";

  hero.hidden = view !== "home";

  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.toggle("active", link.dataset.view === view);
  });

  const navigation = document.querySelector("#navigation");
  const menuToggle = document.querySelector("#menu-toggle");

  navigation.classList.remove("open");
  menuToggle?.setAttribute("aria-expanded", "false");

  if (view === "favorites") {
    renderBooks(favorites, "#favorites-grid");
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Favorites
function toggleFavorite(id) {
  const book = getBook(id);
  if (!book) return;

  if (isFavorite(id)) {
    favorites = favorites.filter(
      (item) => String(item.id) !== String(id)
    );
  } else {
    favorites.push(book);
  }

  saveFavorites();

  const count = document.querySelector("#favorite-count");
  if (count) count.textContent = favorites.length;

  applyFilters();

  if (currentView === "favorites") {
    renderBooks(favorites, "#favorites-grid");
  }
}

// Book details
function showDetails(book) {
  activeBook = book;

  const modalRoot = document.querySelector("#modal-root");
  const readUrl = getBookLink(book);

  modalRoot.innerHTML = `
    <div class="modal-overlay" data-action="close-modal">
      <section class="book-modal" data-modal-panel>
        <button
          class="modal-close"
          data-action="close-modal"
          aria-label="Close details"
        >×</button>

        <h2>${escapeHTML(book.title)}</h2>
        <p><strong>Author:</strong> ${escapeHTML(book.author)}</p>
        <p>${escapeHTML(book.description)}</p>

        <p><strong>Category:</strong> ${escapeHTML(book.category)}</p>

        <div class="book-card-actions">
          ${
            readUrl
              ? `<button class="primary-button" data-action="read">
                   Read inside app
                 </button>`
              : ""
          }

          <button
            class="secondary-button"
            data-action="favorite"
            data-id="${escapeHTML(book.id)}"
          >${isFavorite(book.id) ? "♥ Remove favorite" : "♡ Add favorite"}</button>

          ${
            readUrl
              ? `<a class="text-link" href="${escapeHTML(readUrl)}"
                   target="_blank" rel="noopener noreferrer">
                   Open original text ↗
                 </a>`
              : "<p>Full text is unavailable for this book.</p>"
          }
        </div>
      </section>
    </div>
  `;
}

// Open book reader
async function openReader(book) {
  if (!book?.readUrl) return;

  document.querySelector("#modal-root").innerHTML = "";

  const root = document.querySelector("#reader-root");

  root.innerHTML = `
    <div class="reader-overlay">
      <section class="reader-panel">
        <button class="secondary-button" data-action="close-reader">
          ← Close reader
        </button>

        <h2>${escapeHTML(book.title)}</h2>
        <p>${escapeHTML(book.author)}</p>

        <div class="reader-content">Loading book text...</div>
      </section>
    </div>
  `;

  try {
    const response = await fetch(book.readUrl);

    if (!response.ok) {
      throw new Error("Text unavailable");
    }

    const text = await response.text();

    pages = text.match(/[\s\S]{1,12000}/g) || [
      "No text available.",
    ];

    page = 0;
    renderReaderPage();
  } catch (error) {
    const content = root.querySelector(".reader-content");

    if (content) {
      content.innerHTML = `
        <p>The text could not open inside the app.</p>
        <a href="${escapeHTML(book.readUrl)}"
           target="_blank" rel="noopener noreferrer">
          Open original text ↗
        </a>
      `;
    }
  }
}

function renderReaderPage() {
  const content = document.querySelector(".reader-content");
  if (!content) return;

  content.innerHTML = `
    <article class="reader-text">${escapeHTML(pages[page])}</article>

    <div class="reader-controls">
      <button
        class="secondary-button"
        data-action="reader-prev"
        ${page === 0 ? "disabled" : ""}
      >Previous</button>

      <span>Page ${page + 1} of ${pages.length}</span>

      <button
        class="secondary-button"
        data-action="reader-next"
        ${page === pages.length - 1 ? "disabled" : ""}
      >Next</button>
    </div>
  `;
}

// Click actions
app.addEventListener("click", async (event) => {
  const viewLink = event.target.closest("[data-view]");

  if (viewLink) {
    event.preventDefault();
    showView(viewLink.dataset.view);
    return;
  }

  const button = event.target.closest("[data-action]");
  if (!button) return;

  const action = button.dataset.action;
  const id = button.dataset.id;

  if (action === "favorite") {
    toggleFavorite(id);

    if (activeBook && String(activeBook.id) === String(id)) {
      showDetails(activeBook);
    }
  }

  if (action === "details") {
    const book = getBook(id);
    if (book) showDetails(book);
  }

  if (action === "read") {
    await openReader(activeBook);
  }

  if (action === "close-modal") {
    if (event.target.closest("[data-modal-panel]")) return;
    document.querySelector("#modal-root").innerHTML = "";
  }

  if (action === "close-reader") {
    document.querySelector("#reader-root").innerHTML = "";
  }

  if (action === "category") {
    category = button.dataset.category;
    renderCategories();
    applyFilters();
  }

  if (action === "next" && nextUrl) {
    await loadBooks(nextUrl, search);
  }

  if (action === "previous" && previousUrl) {
    await loadBooks(previousUrl, search);
  }

  if (action === "retry") {
    await loadBooks(API, search);
  }

  if (action === "reader-prev" && page > 0) {
    page--;
    renderReaderPage();
  }

  if (action === "reader-next" && page < pages.length - 1) {
    page++;
    renderReaderPage();
  }
});

// Search
app.addEventListener("submit", async (event) => {
  if (event.target.id !== "search-form") return;

  event.preventDefault();

  search = document.querySelector("#book-search").value.trim();
  category = "All";

  await loadBooks(API, search);
});

// Mobile menu
document.addEventListener("click", (event) => {
  if (!event.target.closest("#menu-toggle")) return;

  const navigation = document.querySelector("#navigation");
  const toggle = document.querySelector("#menu-toggle");
  const open = navigation.classList.toggle("open");

  toggle.setAttribute("aria-expanded", String(open));
});

// Close modal with Escape
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    document.querySelector("#modal-root").innerHTML = "";
    document.querySelector("#reader-root").innerHTML = "";
  }
});

// Start app
if (app) {
  renderApp();

  const count = document.querySelector("#favorite-count");
  if (count) count.textContent = favorites.length;

  showView("home");
  loadBooks();
} else {
  console.error('Missing <div id="app"></div> in index.html.');
}
