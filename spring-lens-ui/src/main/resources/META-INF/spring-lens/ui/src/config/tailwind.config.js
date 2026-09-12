tailwind.config = {
    darkMode: 'class',
    theme: {
        extend: {
            fontFamily: {
                sans: ['"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
                mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
            },
            colors: {
                primary: '#6b46c1',
                'primary-light': '#f3f0ff',
                'gray-50': '#f8fafc',
                'gray-100': '#f1f5f9',
                'gray-200': '#e2e8f0',
                'gray-400': '#94a3b8',
                'gray-500': '#64748b',
                'gray-800': '#1e293b',
                success: '#22c55e',
                'success-light': '#dcfce7',
                warning: '#f59e0b',
                info: '#3b82f6',
            }
        }
    }
};
