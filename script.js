const FEEDS = [
  {
    type: "x",
    label: "X观点",
    url: "https://api.github.com/repos/zarazhangrui/follow-builders/contents/feed-x.json?ref=main",
  },
  {
    type: "podcast",
    label: "播客",
    url: "https://api.github.com/repos/zarazhangrui/follow-builders/contents/feed-podcasts.json?ref=main",
  },
  {
    type: "blog",
    label: "博客",
    url: "https://api.github.com/repos/zarazhangrui/follow-builders/contents/feed-blogs.json?ref=main",
  },
];

const fallbackItems = [
  {
    type: "podcast",
    label: "播客",
    source: "No Priors",
    title: "How Nuclear Will Unlock Energy Abundance",
    summary: "AI 算力需求正在推动能源基础设施讨论，适合放进海外 AI 趋势观察。",
    url: "https://www.youtube.com/",
    date: "2026-07-02T15:00:00.000Z",
  },
  {
    type: "x",
    label: "X观点",
    source: "Swyx",
    title: "关于模型 introspection 与 rollouts 的讨论",
    summary: "来自 AI builder 的短观点，可作为“AI 大佬分享”栏目素材。",
    url: "https://x.com/",
    date: "2026-07-12T16:37:00.000Z",
  },
];

const state = {
  items: [],
  filter: "all",
};

const grid = document.querySelector("#feedGrid");
const filterButtons = [...document.querySelectorAll(".feed-filter")];

function truncate(text, max = 148) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}...` : clean;
}

function formatDate(value) {
  if (!value) return "未标注时间";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未标注时间";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

async function fetchGithubJson(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/vnd.github.raw" },
  });
  if (!response.ok) throw new Error(`GitHub feed ${response.status}`);
  return response.json();
}

function normalizeX(data) {
  return (data.x || []).flatMap((account) =>
    (account.tweets || []).map((tweet) => ({
      type: "x",
      label: "X观点",
      source: account.name || account.handle || "AI Builder",
      title: truncate(tweet.text, 72),
      summary: truncate(tweet.text, 170),
      url: tweet.url,
      date: tweet.createdAt,
      score: (tweet.likes || 0) + (tweet.retweets || 0) * 3 + (tweet.replies || 0) * 2,
    })),
  );
}

function normalizePodcasts(data) {
  return (data.podcasts || []).map((item) => ({
    type: "podcast",
    label: "播客",
    source: item.name || "Podcast",
    title: item.title || "未命名播客",
    summary: truncate(item.transcript || item.description || "打开原链接查看完整节目内容。", 170),
    url: item.url,
    date: item.publishedAt,
    score: 0,
  }));
}

function normalizeBlogs(data) {
  return (data.blogs || data.posts || []).map((item) => ({
    type: "blog",
    label: "博客",
    source: item.source || item.name || item.site || "Blog",
    title: item.title || "未命名文章",
    summary: truncate(item.summary || item.description || item.content || "打开原链接查看完整文章。", 170),
    url: item.url || item.link,
    date: item.publishedAt || item.date,
    score: 0,
  }));
}

function render() {
  const list = state.items
    .filter((item) => state.filter === "all" || item.type === state.filter)
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
    .slice(0, 12);

  if (!list.length) {
    grid.innerHTML = '<p class="feed-empty">当前分类暂无内容，稍后再试。</p>';
    return;
  }

  grid.innerHTML = list
    .map(
      (item) => `
        <article class="feed-card">
          <div class="feed-card-top">
            <span class="feed-type">${item.label}</span>
            <time>${formatDate(item.date)}</time>
          </div>
          <h4>${item.title}</h4>
          <p>${item.summary}</p>
          <div class="feed-card-bottom">
            <span>${item.source}</span>
            <a href="${item.url || "#"}" target="_blank" rel="noopener noreferrer">原文 <span aria-hidden="true">→</span></a>
          </div>
        </article>
      `,
    )
    .join("");
}

async function loadFeeds() {
  try {
    const results = await Promise.allSettled(FEEDS.map((feed) => fetchGithubJson(feed.url)));
    const items = [];
    results.forEach((result, index) => {
      if (result.status !== "fulfilled") return;
      const type = FEEDS[index].type;
      if (type === "x") items.push(...normalizeX(result.value));
      if (type === "podcast") items.push(...normalizePodcasts(result.value));
      if (type === "blog") items.push(...normalizeBlogs(result.value));
    });

    if (!items.length) throw new Error("No feed items");
    state.items = items;
  } catch (error) {
    state.items = fallbackItems;
  }
  render();
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    filterButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    state.filter = button.dataset.filter || "all";
    render();
  });
});

loadFeeds();
