import { createRouter, createWebHashHistory } from "vue-router";
import HomeView from "./views/HomeView.vue";

// Hash history so dist/ drops onto any static host (GitHub Pages, S3, a file
// share) with no rewrite rules.
//
// Section anchors ride in a QUERY PARAM (?a=rules), not a second hash. A
// double-hash URL like #/knowledge/x#rules gets mangled by Outlook, Teams, and
// chat link-scrubbers — which is exactly how this audience shares links.
const routes = [
  { path: "/", name: "home", component: HomeView, meta: { title: "Home" } },
  {
    path: "/quick-links",
    name: "quicklinks",
    component: () => import("./views/QuickLinksView.vue"),
    meta: { title: "Quick Links" },
  },
  {
    path: "/knowledge",
    name: "knowledge-index",
    component: () => import("./views/KnowledgeIndexView.vue"),
    meta: { title: "Knowledge" },
  },
  {
    path: "/knowledge/:topicId",
    name: "knowledge",
    component: () => import("./views/KnowledgeView.vue"),
    props: true,
    meta: { title: "Knowledge" },
  },
  {
    path: "/tools/:tool?",
    name: "tools",
    component: () => import("./views/ToolsView.vue"),
    props: true,
    meta: { title: "Tools" },
  },
  {
    path: "/about",
    name: "about",
    component: () => import("./views/AboutView.vue"),
    meta: { title: "About" },
  },
  // Landing pad for the static /go redirector, which forwards here whenever a
  // shortcut resolves to something that must not be an automatic redirect — a
  // portal with a "then" step, a phone number, or nothing at all. Also the setup
  // documentation, because a miss is when someone will read it.
  {
    path: "/go",
    name: "go",
    component: () => import("./views/GoView.vue"),
    meta: { title: "Go shortcuts" },
  },
  { path: "/:pathMatch(.*)*", redirect: "/" },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior(to, from, saved) {
    const reduced =
      typeof matchMedia === "function" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (to.query.a) {
      return {
        el: `#sec-${to.query.a}`,
        top: 76,
        behavior: reduced ? "auto" : "smooth",
      };
    }
    return saved || { top: 0 };
  },
});

router.afterEach((to) => {
  const t = to.meta?.title;
  document.title = t ? `${t} — SALTDOG` : "SALTDOG — Navy Reservist Quick Reference";
});

export default router;
