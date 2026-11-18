// Fills the theme's busuanzi counter slots (#busuanzi_value_*) from /api/stats, backed by our Umami.
// The theme loads it via CDN.option.busuanzi as a data-pjax script, so it runs again after each pjax navigation.
(async () => {
	const slots = {
		site_pv: document.getElementById('busuanzi_value_site_pv'),
		site_uv: document.getElementById('busuanzi_value_site_uv'),
		page_pv: document.getElementById('busuanzi_value_page_pv'),
	};
	const targets = Object.entries(slots).filter(([, element]) => element);
	if (!targets.length) return;

	// Pages without a page counter skip the path so they all share one cached response
	const query = slots.page_pv ? `?path=${encodeURIComponent(location.pathname)}` : '';
	try {
		const response = await fetch(`/api/stats${query}`);
		if (!response.ok) throw new Error(`stats ${response.status}`);
		const stats = await response.json();
		for (const [key, element] of targets) element.textContent = stats[key] ?? '-';
	} catch (error) {
		console.error('获取访问统计失败:', error);
		for (const [, element] of targets) element.textContent = '-';
	}
})();
