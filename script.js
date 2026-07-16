const FEEDS = [
  {
    type: "x",
    label: "𝕏",
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
    label: "𝕏",
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
  visibleItems: [],
};

const grid = document.querySelector("#feedGrid");
const filterButtons = [...document.querySelectorAll(".feed-filter")];
const modal = document.querySelector("#feedModal");
const modalAvatar = document.querySelector("#feedModalAvatar");
const modalSource = document.querySelector("#feedModalSource");
const modalTime = document.querySelector("#feedModalTime");
const modalType = document.querySelector("#feedModalType");
const modalTitle = document.querySelector("#feedModalTitle");
const modalBody = document.querySelector("#feedModalBody");
const modalOriginal = document.querySelector("#feedModalOriginal");
const modalTranslate = document.querySelector("#feedModalTranslate");

function truncate(text, max = 148) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}...` : clean;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getHost(value) {
  try {
    return new URL(value).hostname;
  } catch (error) {
    return "";
  }
}

function getInitials(value) {
  const clean = String(value || "AI").trim();
  return clean.slice(0, 2).toUpperCase();
}

function renderAvatar(item) {
  const fallback = escapeHtml(getInitials(item.source));
  const avatar = item.avatar ? escapeHtml(item.avatar) : "";

  if (!avatar) {
    return `<span class="feed-avatar" aria-hidden="true">${fallback}</span>`;
  }

  return `
    <span class="feed-avatar" aria-hidden="true">
      <img src="${avatar}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.textContent='${fallback}'" />
    </span>
  `;
}

function getTranslateUrl(url) {
  if (!url) return "#";
  return `https://translate.google.com/translate?sl=auto&tl=zh-CN&u=${encodeURIComponent(url)}`;
}

function setAvatar(target, item) {
  const fallback = escapeHtml(getInitials(item.source));
  const avatar = item.avatar ? escapeHtml(item.avatar) : "";
  target.innerHTML = avatar
    ? `<img src="${avatar}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.textContent='${fallback}'" />`
    : fallback;
}

function getDetailText(item) {
  return item.fullText || item.summary || item.title || "暂无详情内容。";
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
      label: "𝕏",
      source: account.name || account.handle || "AI Builder",
      avatar: account.handle ? `https://unavatar.io/x/${account.handle}` : "",
      title: truncate(tweet.text, 72),
      summary: truncate(tweet.text, 170),
      fullText: tweet.text || "",
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
    avatar: item.url ? `https://www.google.com/s2/favicons?domain=${getHost(item.url)}&sz=64` : "",
    title: item.title || "未命名播客",
    summary: truncate(item.transcript || item.description || "打开原链接查看完整节目内容。", 170),
    fullText: item.transcript || item.description || "",
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
    avatar: item.url || item.link ? `https://www.google.com/s2/favicons?domain=${getHost(item.url || item.link)}&sz=64` : "",
    title: item.title || "未命名文章",
    summary: truncate(item.summary || item.description || item.content || "打开原链接查看完整文章。", 170),
    fullText: item.content || item.summary || item.description || "",
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
  state.visibleItems = list;

  if (!list.length) {
    grid.innerHTML = '<p class="feed-empty">当前分类暂无内容，稍后再试。</p>';
    return;
  }

  grid.innerHTML = list
    .map(
      (item, index) => `
        <article class="feed-card" tabindex="0" role="button" data-feed-index="${index}" aria-label="查看详情：${escapeHtml(item.title)}">
          <div class="feed-card-top">
            <span class="feed-type">${escapeHtml(item.label)}</span>
            <time>${escapeHtml(formatDate(item.date))}</time>
          </div>
          <h4>${escapeHtml(item.title)}</h4>
          <p>${escapeHtml(item.summary)}</p>
          <div class="feed-card-bottom">
            <span class="feed-source">
              ${renderAvatar(item)}
              <span class="feed-source-name">${escapeHtml(item.source)}</span>
            </span>
            <span class="feed-card-actions">
              <a href="${escapeHtml(getTranslateUrl(item.url))}" target="_blank" rel="noopener noreferrer">中文 <span aria-hidden="true">→</span></a>
              <a href="${escapeHtml(item.url || "#")}" target="_blank" rel="noopener noreferrer">原文 <span aria-hidden="true">→</span></a>
            </span>
          </div>
        </article>
      `,
    )
    .join("");
}

function openFeedModal(item) {
  if (!item || !modal) return;
  setAvatar(modalAvatar, item);
  modalSource.textContent = item.source || "AI Builder";
  modalTime.textContent = formatDate(item.date);
  modalType.textContent = item.label || "资讯";
  modalTitle.textContent = item.title || "未命名内容";
  modalBody.textContent = getDetailText(item);
  modalOriginal.href = item.url || "#";
  modalTranslate.href = getTranslateUrl(item.url);
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  modal.querySelector(".feed-modal-close").focus();
}

function closeFeedModal() {
  if (!modal) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
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

document.addEventListener("click", (event) => {
  const closeButton = event.target.closest("[data-modal-close]");
  if (closeButton) {
    closeFeedModal();
    return;
  }

  const button = event.target.closest(".tool-tab");
  if (button) {
    const selected = button.dataset.toolTab;
    document.querySelectorAll(".tool-tab").forEach((item) => {
      item.classList.toggle("active", item === button);
    });
    document.querySelectorAll(".tool-category").forEach((category) => {
      category.classList.toggle("active", category.dataset.toolCategory === selected);
    });
    return;
  }

  const card = event.target.closest(".feed-card");
  if (!card || event.target.closest("a")) return;
  openFeedModal(state.visibleItems[Number(card.dataset.feedIndex)]);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeFeedModal();
    return;
  }

  if ((event.key === "Enter" || event.key === " ") && event.target.closest(".feed-card")) {
    event.preventDefault();
    const card = event.target.closest(".feed-card");
    openFeedModal(state.visibleItems[Number(card.dataset.feedIndex)]);
  }
});

loadFeeds();
