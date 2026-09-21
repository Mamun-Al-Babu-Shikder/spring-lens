export default class Pagination {

    static defaultState(pageSize = 20) {
        return {
            totalElements: 0,
            totalPages: 1,
            pageNumber: 0,
            pageSize,
            isFirstPage: true,
            isLastPage: true
        };
    }

    static computeState(response, fallbackPage = 0, fallbackSize = 20, fallbackCount = 0) {
        const totalElements = response?.totalElements ?? fallbackCount;
        const pageSize = response?.pageSize ?? fallbackSize;
        const totalPages = Math.max(1, response?.totalPages ?? Math.ceil(totalElements / pageSize) ?? 1);
        const pageNumber = response?.pageNumber ?? fallbackPage;

        return {
            totalElements,
            totalPages,
            pageNumber,
            pageSize,
            isFirstPage: response?.first ?? (pageNumber === 0),
            isLastPage: response?.last ?? ((pageNumber + 1) >= totalPages)
        };
    }

    static getPageRange(current, total) {
        if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

        const visiblePages = new Set([1, 2, total - 1, total, current - 1, current, current + 1]);
        const sorted = [...visiblePages].filter(p => p >= 1 && p <= total).sort((a, b) => a - b);

        return sorted.reduce((acc, page, idx) => {
            if (idx > 0 && page - sorted[idx - 1] > 1) {
                acc.push('...');
            }
            acc.push(page);
            return acc;
        }, []);
    }

    static getButtons(paginationState = {}) {
        const { totalPages = 1, pageNumber = 0, totalElements = 0 } = paginationState;
        if (!totalElements) return [];

        const currentPage = pageNumber + 1;
        const maxPages = Math.max(1, totalPages || 1);
        const pages = Pagination.getPageRange(currentPage, maxPages);

        return pages.map((p, idx) => ({
            key: p === '...' ? `ellipsis_${idx}` : `page_${p}`,
            isEllipsis: p === '...',
            label: String(p),
            page: p === '...' ? null : p,
            isActive: p === currentPage
        }));
    }

    static formatInfoText(totalElements = 0, pageNumber = 0, pageSize = 20, itemLabel = 'beans') {
        if (!totalElements) {
            return `Showing 0 to 0 of 0 ${itemLabel}`;
        }
        const start = (pageNumber * pageSize) + 1;
        const end = Math.min((pageNumber + 1) * pageSize, totalElements);
        return `Showing ${start.toLocaleString()} to ${end.toLocaleString()} of ${totalElements.toLocaleString()} ${itemLabel}`;
    }

    static formatInfo(paginationState = {}, itemLabel = 'beans') {
        const { totalElements = 0, pageNumber = 0, pageSize = 20 } = paginationState;
        return Pagination.formatInfoText(totalElements, pageNumber, pageSize, itemLabel);
    }

    static compute(response, fallbackPage = 0, fallbackSize = 20, itemLabel = 'beans') {
        const content = response?.content ?? (Array.isArray(response) ? response : []);
        const pagination = Pagination.computeState(response, fallbackPage, fallbackSize, content.length);
        const pageButtons = Pagination.getButtons(pagination);
        const paginationInfo = Pagination.formatInfo(pagination, itemLabel);

        return {
            content,
            pagination,
            pageButtons,
            paginationInfo
        };
    }

    static renderPaginationButtons($container, paginationState) {
        if (!$container || !$container.length) return;

        const { isFirstPage, isLastPage, totalElements } = paginationState || {};
        if (!totalElements) {
            $container.empty();
            return;
        }

        const buttons = Pagination.getButtons(paginationState);
        const prevBtn = `
            <button type="button" class="btn-prev w-7 h-7 flex items-center justify-center rounded text-xs border border-gray-200 dark:border-slate-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 font-medium cursor-pointer" data-action="prev-page" ${isFirstPage ? 'disabled style="opacity: 0.5;"' : ''}>
                <span class="material-symbols-outlined text-[16px]">chevron_left</span>
            </button>
        `;

        const pageBtns = buttons.map(b => {
            if (b.isEllipsis) {
                return '<span class="w-7 h-7 flex items-center justify-center text-xs text-gray-400 font-medium select-none">...</span>';
            }
            const activeClass = b.isActive
                ? 'text-white bg-primary font-bold'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 border border-gray-200 dark:border-slate-800';
            return `<button type="button" class="w-7 h-7 flex items-center justify-center rounded text-xs btn-page cursor-pointer ${activeClass}" data-action="change-page" data-page="${b.page}">${b.label}</button>`;
        }).join('');

        const nextBtn = `
            <button type="button" class="btn-next w-7 h-7 flex items-center justify-center rounded text-xs border border-gray-200 dark:border-slate-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 font-medium cursor-pointer" data-action="next-page" ${isLastPage ? 'disabled style="opacity: 0.5;"' : ''}>
                <span class="material-symbols-outlined text-[16px]">chevron_right</span>
            </button>
        `;

        $container.html(`${prevBtn}${pageBtns}${nextBtn}`);
    }
}
