// The list view is a separate chunk. Starting its download when the pointer reaches the tab means the click
// itself finds it already loaded, so there is no spinner between views.
export const loadListPage = () => import('./ListPage').then((m) => ({ default: m.ListPage }));
export const prefetchListPage = () => void loadListPage();
