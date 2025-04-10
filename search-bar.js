/**
 * BeerZone Search Bar Component
 * 
 * This component provides search functionality for the BeerZone sales management system.
 * It allows searching through products with various filter options.
 */

class SearchBar {
    /**
     * Create a new search bar instance
     * @param {Object} config - Configuration options
     * @param {string} config.containerId - ID of the container element
     * @param {Array} config.data - Array of data items to search through
     * @param {Array} config.searchFields - Array of field names to search in
     * @param {Function} config.onResultClick - Callback when a result is clicked
     * @param {string} config.placeholder - Placeholder text for search input
     * @param {Array} config.filterOptions - Array of filter options
     * @param {number} config.debounceTime - Debounce time in milliseconds for live search
     * @param {number} config.minChars - Minimum characters before search starts
     */
    constructor(config) {
        this.config = {
            containerId: 'search-container',
            data: [],
            searchFields: ['name'],
            onResultClick: null,
            placeholder: 'Search...',
            filterOptions: [],
            debounceTime: 300, // Default debounce time for live search
            minChars: 2, // Minimum characters before search starts
            ...config
        };

        this.currentFilter = this.config.filterOptions.length > 0 ?
            this.config.filterOptions[0].value : 'all';

        this.debounceTimer = null;

        this.init();
    }

    /**
     * Initialize the search bar component
     */
    init() {
        this.container = document.getElementById(this.config.containerId);
        if (!this.container) {
            console.error(`Container with ID '${this.config.containerId}' not found.`);
            return;
        }

        this.render();
        this.attachEventListeners();
    }

    /**
     * Render the search bar component
     */
    render() {
        // Create search bar HTML
        let filterOptionsHTML = '';

        if (this.config.filterOptions.length > 0) {
            filterOptionsHTML = `
                <div class="search-options" role="tablist">
                    ${this.config.filterOptions.map((option, index) => `
                        <div class="search-option ${index === 0 ? 'active' : ''}" 
                            data-filter="${option.value}"
                            role="tab"
                            aria-selected="${index === 0 ? 'true' : 'false'}"
                            tabindex="${index === 0 ? '0' : '-1'}">
                            ${option.label}
                        </div>
                    `).join('')}
                </div>
            `;
        }

        this.container.innerHTML = `
            <div class="search-container">
                ${filterOptionsHTML}
                <div class="search-bar">
                    <input type="text" 
                        placeholder="${this.config.placeholder}" 
                        id="search-input" 
                        autocomplete="off"
                        aria-label="${this.config.placeholder}"
                        aria-autocomplete="list">
                    <button id="search-button" type="button" aria-label="Search">
                        Search
                    </button>
                </div>
                <div class="search-results-count" aria-live="polite" style="display: none;"></div>
                <div id="search-results" role="listbox" aria-label="Search results"></div>
            </div>
        `;

        // Cache DOM elements
        this.searchInput = document.getElementById('search-input');
        this.searchButton = document.getElementById('search-button');
        this.resultsContainer = document.getElementById('search-results');
        this.resultsCount = this.container.querySelector('.search-results-count');
    }

    /**
     * Attach event listeners to search components
     */
    attachEventListeners() {
        // Search button click (still keep this for accessibility)
        this.searchButton.addEventListener('click', () => {
            this.performSearch();
        });

        // Live search as user types
        this.searchInput.addEventListener('input', () => {
            this.debouncedSearch();
        });

        // Search on Enter key
        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performSearch();
            }
        });

        // Filter options
        const filterOptions = this.container.querySelectorAll('.search-option');
        filterOptions.forEach(option => {
            option.addEventListener('click', () => {
                // Update active class
                filterOptions.forEach(opt => opt.classList.remove('active'));
                option.classList.add('active');

                // Update current filter
                this.currentFilter = option.dataset.filter;

                // Perform search with new filter if there's input
                if (this.searchInput.value.trim().length >= this.config.minChars) {
                    this.performSearch();
                }
            });
        });
    }

    /**
     * Debounce search to prevent excessive searches while typing
     */
    debouncedSearch() {
        clearTimeout(this.debounceTimer);

        this.debounceTimer = setTimeout(() => {
            const query = this.searchInput.value.trim();

            // Only search if minimum characters are typed
            if (query.length >= this.config.minChars) {
                this.performSearch();
            } else if (query.length === 0) {
                // Clear results if search is empty
                this.clearResults();
            }
        }, this.config.debounceTime);
    }

    /**
     * Perform search with current input value and filter
     */
    performSearch() {
        const query = this.searchInput.value.trim();
        if (!query) {
            this.clearResults();
            return;
        }

        const results = this.search(query, this.currentFilter);
        this.displayResults(results, query);
    }

    /**
     * Search through data based on query and filter
     * @param {string} query - Search query
     * @param {string} filter - Current filter type
     * @returns {Array} - Filtered results
     */
    search(query, filter) {
        if (!query) return [];

        query = query.toLowerCase();

        return this.config.data.filter(item => {
            // Handle special inventory filters for BeerZone
            if (filter === 'in-stock' && this.isOutOfStock(item)) {
                return false;
            }
            if (filter === 'out-of-stock' && !this.isOutOfStock(item)) {
                return false;
            }
            // For other category-based filters
            else if (filter !== 'all' && filter !== 'in-stock' && filter !== 'out-of-stock' && item.category !== filter) {
                return false;
            }

            // Check if any of the search fields match the query
            return this.config.searchFields.some(field => {
                if (!item[field]) return false;
                return item[field].toString().toLowerCase().includes(query);
            });
        });
    }

    /**
     * Check if an item is out of stock based on inventory data
     * @param {Object} item - Product item
     * @returns {boolean} - True if out of stock
     */
    isOutOfStock(item) {
        // First check if we have a status directly on the item (from inventory search)
        if (item.hasOwnProperty('status')) {
            return item.status === 'out-of-stock';
        }

        // For BeerZone: Check inventory status
        // This can be extended to check real-time inventory data if needed
        if (item.hasOwnProperty('inventory') && item.inventory) {
            return item.inventory.quantity <= 0;
        }

        // If we don't have inventory data on the item yet, check DOM
        const productElement = document.querySelector(`.beer-card[data-id="${item.id}"]`);
        if (productElement) {
            const inventoryStatus = productElement.querySelector('.inventory-status');
            if (inventoryStatus && inventoryStatus.classList.contains('out-of-stock')) {
                return true;
            }
        }

        return false;
    }

    /**
     * Display search results in the results container
     * @param {Array} results - Search results
     * @param {string} query - Original search query for highlighting
     */
    displayResults(results, query) {
        // Clear previous results
        this.clearResults();

        // Show result count
        this.resultsCount.style.display = 'block';
        this.resultsCount.textContent = `${results.length} results found`;

        // Set aria attributes for screen readers
        this.searchInput.setAttribute('aria-expanded', 'true');

        if (results.length === 0) {
            this.resultsContainer.innerHTML = `
                <div class="empty-results" role="status">No results found for "${query}"</div>
            `;
            return;
        }

        // Render each result
        results.forEach((item, index) => {
            const resultItem = document.createElement('div');
            resultItem.className = 'search-result-item';
            resultItem.setAttribute('role', 'option');
            resultItem.setAttribute('aria-selected', 'false');
            resultItem.setAttribute('id', `search-result-${index}`);
            resultItem.setAttribute('tabindex', '-1');

            // Get inventory status for the product
            const isOutOfStock = this.isOutOfStock(item);

            // Create result content with highlighted query
            let resultHTML = '';

            // Custom display for BeerZone products
            resultHTML = `
                <h3>${this.highlightMatch(item.name, query)}</h3>
                ${item.price ? `<p class="price">₹${item.price}</p>` : ''}
                <div class="result-status">
                    ${this.getStatusHTML(item)}
                </div>
            `;

            resultItem.innerHTML = resultHTML;

            // Add click event if callback is provided
            if (typeof this.config.onResultClick === 'function') {
                resultItem.style.cursor = 'pointer';
                resultItem.addEventListener('click', () => {
                    this.config.onResultClick(item);
                    this.searchInput.focus(); // Return focus to search input
                    this.clearResults(); // Clear results after selection
                });

                // Add keyboard support
                resultItem.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        this.config.onResultClick(item);
                        this.searchInput.focus(); // Return focus to search input
                        this.clearResults(); // Clear results after selection
                    }
                });
            }

            this.resultsContainer.appendChild(resultItem);
        });

        // Add keyboard navigation to results
        this.addKeyboardNavigation();
    }

    /**
     * Add keyboard navigation to search results
     */
    addKeyboardNavigation() {
        // Handle keyboard navigation in search results
        this.searchInput.addEventListener('keydown', (e) => {
            const items = this.resultsContainer.querySelectorAll('.search-result-item');
            if (items.length === 0) return;

            const activeItem = this.resultsContainer.querySelector('[aria-selected="true"]');

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    if (!activeItem) {
                        // No item selected yet, select first item
                        this.selectResultItem(items[0]);
                    } else {
                        // Find next item
                        const nextItem = activeItem.nextElementSibling;
                        if (nextItem) {
                            this.selectResultItem(nextItem);
                        }
                    }
                    break;

                case 'ArrowUp':
                    e.preventDefault();
                    if (activeItem) {
                        // Find previous item
                        const prevItem = activeItem.previousElementSibling;
                        if (prevItem) {
                            this.selectResultItem(prevItem);
                        } else {
                            // If at top, return focus to search input
                            activeItem.setAttribute('aria-selected', 'false');
                            this.searchInput.focus();
                        }
                    }
                    break;

                case 'Escape':
                    e.preventDefault();
                    this.clearResults();
                    break;

                case 'Enter':
                    if (activeItem) {
                        e.preventDefault();
                        activeItem.click();
                    }
                    break;
            }
        });
    }

    /**
     * Select a result item for keyboard navigation
     * @param {HTMLElement} item - Item to select
     */
    selectResultItem(item) {
        // Clear previous selection
        const items = this.resultsContainer.querySelectorAll('.search-result-item');
        items.forEach(i => i.setAttribute('aria-selected', 'false'));

        // Select new item
        item.setAttribute('aria-selected', 'true');
        item.focus();
    }

    /**
     * Get HTML for displaying item status
     * @param {Object} item - Item to display status for
     * @returns {string} - HTML for status display
     */
    getStatusHTML(item) {
        // For inventory items with status property
        if (item.hasOwnProperty('status')) {
            if (item.status === 'out-of-stock') {
                return '<span class="out-of-stock">Out of Stock</span>';
            } else if (item.status === 'low-stock') {
                return '<span class="low-stock">Low Stock</span>';
            } else if (item.status === 'in-stock') {
                return '<span class="in-stock">In Stock</span>';
            }
        }

        // For regular products
        const isOutOfStock = this.isOutOfStock(item);
        return isOutOfStock ?
            '<span class="out-of-stock">Out of Stock</span>' :
            '<span class="in-stock">In Stock</span>';
    }

    /**
     * Highlight search query matches in text
     * @param {string} text - Text to highlight within
     * @param {string} query - Query to highlight
     * @returns {string} - HTML with highlighted query
     */
    highlightMatch(text, query) {
        if (!text) return '';

        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<span class="highlight">$1</span>');
    }

    /**
     * Clear search results
     */
    clearResults() {
        this.resultsContainer.innerHTML = '';
        this.resultsCount.style.display = 'none';
        this.searchInput.setAttribute('aria-expanded', 'false');
    }

    /**
     * Set new data for the search component
     * @param {Array} data - New data array
     */
    setData(data) {
        this.config.data = data;

        // Re-run search if there's an active search
        const query = this.searchInput?.value.trim();
        if (query && query.length >= this.config.minChars) {
            this.performSearch();
        }
    }
}

// Example usage:
/*
const searchBar = new SearchBar({
    containerId: 'search-container',
    data: [
        {name: 'IPA Beer', category: 'craft', price: 7.99, description: 'Hoppy IPA beer'},
        {name: 'Stout Beer', category: 'craft', price: 8.99, description: 'Dark stout beer'},
        {name: 'Light Beer', category: 'commercial', price: 5.99, description: 'Light refreshing beer'}
    ],
    searchFields: ['name', 'description'],
    placeholder: 'Search beers...',
    filterOptions: [
        {label: 'All', value: 'all'},
        {label: 'Craft', value: 'craft'},
        {label: 'Commercial', value: 'commercial'}
    ],
    onResultClick: (item) => {
        console.log('Item clicked:', item);
    }
});
*/

// Initialize the search when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
    // The search bar will be initialized from individual pages with proper data
    // NOTE: This auto initialization is not used because we need to
    // use real product data from the database
});

// Make the SearchBar class globally available
window.SearchBar = SearchBar; 