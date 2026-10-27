
const API_URL = "https://gutendex.com/books/";

export async function fetchBooks(query = "") {
  const params = new URLSearchParams({
    languages: "en",
    mime_type: "text/plain",
  });

  if (query.trim()) {
    params.set("search", query.trim());
  }

  const response = await fetch(`${API_URL}?${params.toString()}`);

  if (!response.ok) {
    throw new Error("Failed to load books from Gutendex.");
  }

  const data = await response.json();

  return (data.results || [])
    .map((book) => {
      const formats = book.formats || {};

      const textKey = Object.keys(formats).find(
        (key) => key.startsWith("text/plain") && !key.includes("zip")
      );

      return {
        id: `gutendex-${book.id}`,
        gutendexId: book.id,
        title: book.title || "Untitled",
        author: book.authors?.map((author) => author.name).join(", ")
          || "Unknown author",
        cover: formats["image/jpeg"] || "",
        category: book.bookshelves?.[0] || book.subjects?.[0] || "Literature",
        year: "",
        description: book.summaries?.[0] || "",
        summary: book.summaries?.[0] || "",
        readUrl: textKey ? formats[textKey] : "",
        subjects: book.subjects || [],
        downloadCount: book.download_count || 0,
      };
    })
    .filter((book) => book.readUrl);
}
