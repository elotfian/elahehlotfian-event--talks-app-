document.addEventListener('DOMContentLoaded', () => {
    // Application State
    let state = {
        releases: [],
        filteredReleases: [],
        selectedRelease: null,
        searchQuery: '',
        activeTypeFilter: 'all',
        isLoading: false
    };

    // DOM Elements
    const btnRefresh = document.getElementById('btn-refresh');
    const iconRefresh = document.getElementById('icon-refresh');
    const spinnerRefresh = document.getElementById('spinner-refresh');
    const cacheIndicator = document.getElementById('cache-indicator');
    
    const searchInput = document.getElementById('search-input');
    const btnClearSearch = document.getElementById('btn-clear-search');
    
    const filterPills = document.querySelectorAll('.pill-btn');
    
    const statTotalVal = document.getElementById('stat-total-val');
    const statFeaturesVal = document.getElementById('stat-features-val');
    const statChangesVal = document.getElementById('stat-changes-val');
    
    const feedResultsCount = document.getElementById('feed-results-count');
    const feedList = document.getElementById('feed-list');
    
    const composerEmptyState = document.getElementById('composer-empty-state');
    const composerActiveState = document.getElementById('composer-active-state');
    const selectedTypeBadge = document.getElementById('selected-type-badge');
    const selectedDateLabel = document.getElementById('selected-date');
    const tweetTextarea = document.getElementById('tweet-textarea');
    const charCounter = document.getElementById('char-counter');
    const charProgressBar = document.getElementById('char-progress-bar');
    const btnCopyTweet = document.getElementById('btn-copy-tweet');
    const btnSendTweet = document.getElementById('btn-send-tweet');
    
    const toastContainer = document.getElementById('toast-container');

    // Initialize Application
    init();

    function init() {
        setupEventListeners();
        loadReleases(false); // Initial load (uses cache if fresh)
    }

    // Event Listeners
    function setupEventListeners() {
        // Refresh Button
        btnRefresh.addEventListener('click', () => {
            if (!state.isLoading) {
                loadReleases(true); // Force refresh
            }
        });

        // Search Input
        searchInput.addEventListener('input', (e) => {
            state.searchQuery = e.target.value.trim().toLowerCase();
            
            // Show/hide clear button
            if (state.searchQuery.length > 0) {
                btnClearSearch.classList.remove('hidden');
            } else {
                btnClearSearch.classList.add('hidden');
            }
            
            applyFiltersAndRender();
        });

        btnClearSearch.addEventListener('click', () => {
            searchInput.value = '';
            state.searchQuery = '';
            btnClearSearch.classList.add('hidden');
            applyFiltersAndRender();
            searchInput.focus();
        });

        // Filter Pills
        filterPills.forEach(pill => {
            pill.addEventListener('click', () => {
                filterPills.forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                
                state.activeTypeFilter = pill.getAttribute('data-type');
                applyFiltersAndRender();
            });
        });

        // Tweet Composer Textarea
        tweetTextarea.addEventListener('input', () => {
            updateTweetCharCounter();
        });

        // Copy Tweet
        btnCopyTweet.addEventListener('click', () => {
            const text = tweetTextarea.value;
            navigator.clipboard.writeText(text).then(() => {
                showToast('Tweet copied to clipboard!', 'success');
            }).catch(err => {
                console.error('Failed to copy: ', err);
                showToast('Failed to copy text.', 'error');
            });
        });

        // Send Tweet (X Intent)
        btnSendTweet.addEventListener('click', () => {
            const text = tweetTextarea.value;
            const twitterLength = getTwitterLength(text);
            
            if (twitterLength > 280) {
                showToast('Tweet exceeds character limit! Please shorten.', 'error');
                return;
            }
            
            const encodedText = encodeURIComponent(text);
            const tweetUrl = `https://twitter.com/intent/tweet?text=${encodedText}`;
            window.open(tweetUrl, '_blank', 'width=550,height=420');
            showToast('Opening Twitter...', 'info');
        });
    }

    // Load Data from Backend
    async function loadReleases(forceRefresh = false) {
        setLoadingState(true);
        
        const endpoint = forceRefresh ? '/api/releases/force-refresh' : '/api/releases';
        
        try {
            const response = await fetch(endpoint);
            if (!response.ok) {
                throw new Error(`Server returned HTTP ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.status === 'success' || result.status === 'warning') {
                state.releases = result.data || [];
                
                // Update Cache Indicator
                updateCacheIndicator(result.source, result.last_updated);
                
                if (result.status === 'warning') {
                    showToast(result.message, 'error');
                } else if (forceRefresh) {
                    showToast('Release notes successfully updated!', 'success');
                }
                
                // Select first item by default if nothing is selected yet
                if (state.releases.length > 0 && !state.selectedRelease) {
                    selectReleaseItem(state.releases[0], false);
                }
                
                updateStats();
                applyFiltersAndRender();
            } else {
                throw new Error(result.message || 'Unknown backend error');
            }
        } catch (error) {
            console.error('Error loading release notes:', error);
            showToast(`Error: ${error.message}`, 'error');
            
            if (state.releases.length === 0) {
                renderErrorState(error.message);
            }
        } finally {
            setLoadingState(false);
        }
    }

    // Loader Visual State
    function setLoadingState(loading) {
        state.isLoading = loading;
        if (loading) {
            btnRefresh.disabled = true;
            iconRefresh.classList.add('hidden');
            spinnerRefresh.classList.remove('hidden');
            
            // Show skeleton loaders in feed
            feedList.innerHTML = `
                <div class="feed-placeholder">
                    <div class="pulse-bar title-pulse"></div>
                    <div class="pulse-bar body-pulse"></div>
                    <div class="pulse-bar body-pulse short"></div>
                </div>
                <div class="feed-placeholder">
                    <div class="pulse-bar title-pulse"></div>
                    <div class="pulse-bar body-pulse"></div>
                    <div class="pulse-bar body-pulse short"></div>
                </div>
                <div class="feed-placeholder">
                    <div class="pulse-bar title-pulse"></div>
                    <div class="pulse-bar body-pulse"></div>
                </div>
            `;
            feedResultsCount.textContent = 'Fetching updates...';
        } else {
            btnRefresh.disabled = false;
            iconRefresh.classList.remove('hidden');
            spinnerRefresh.classList.add('hidden');
        }
    }

    // Cache Label Update
    function updateCacheIndicator(source, timestamp) {
        cacheIndicator.className = 'cache-badge';
        
        let label = '';
        if (source === 'network' || source === 'network_force') {
            cacheIndicator.classList.add('network');
            label = 'Live Feed';
        } else if (source === 'cache') {
            cacheIndicator.classList.add('cache');
            label = 'Cached';
        } else {
            cacheIndicator.classList.add('stale');
            label = 'Offline/Stale';
        }
        
        cacheIndicator.textContent = `${label}`;
        cacheIndicator.title = `Last retrieved: ${timestamp}`;
    }

    // Stats calculations
    function updateStats() {
        const total = state.releases.length;
        const features = state.releases.filter(r => r.type.toLowerCase() === 'feature').length;
        const changes = state.releases.filter(r => r.type.toLowerCase() === 'change').length;
        
        statTotalVal.textContent = total;
        statFeaturesVal.textContent = features;
        statChangesVal.textContent = changes;
    }

    // Filter and Search logic
    function applyFiltersAndRender() {
        state.filteredReleases = state.releases.filter(item => {
            // 1. Type Filter
            const matchesType = state.activeTypeFilter === 'all' || 
                item.type.toLowerCase() === state.activeTypeFilter;
                
            // 2. Search Query Match
            const matchesSearch = !state.searchQuery || 
                item.text.toLowerCase().includes(state.searchQuery) ||
                item.date.toLowerCase().includes(state.searchQuery) ||
                item.type.toLowerCase().includes(state.searchQuery);
                
            return matchesType && matchesSearch;
        });

        renderFeed();
    }

    // Render Feed List
    function renderFeed() {
        feedList.innerHTML = '';
        
        const count = state.filteredReleases.length;
        if (count === 0) {
            feedResultsCount.textContent = 'No updates found';
            feedList.innerHTML = `
                <div class="empty-feed">
                    <div class="empty-feed-icon">🔍</div>
                    <h3>No results found</h3>
                    <p>Try adjusting your search keywords or filter settings.</p>
                </div>
            `;
            return;
        }

        feedResultsCount.textContent = `Showing ${count} update${count !== 1 ? 's' : ''}`;
        
        state.filteredReleases.forEach(item => {
            const isSelected = state.selectedRelease && state.selectedRelease.id === item.id;
            
            const card = document.createElement('article');
            card.className = `release-card${isSelected ? ' selected' : ''}`;
            card.setAttribute('data-id', item.id);
            card.setAttribute('tabindex', '0');
            
            // Format category badge color
            const typeClass = item.type.toLowerCase();
            
            card.innerHTML = `
                <div class="release-card-header">
                    <div class="release-meta">
                        <span class="badge ${typeClass}">${item.type}</span>
                        <span class="release-date">${item.date}</span>
                    </div>
                    <button class="release-anchor-btn" data-link="${item.link}" title="Open original release notes" aria-label="Open source documentation">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                            <polyline points="15 3 21 3 21 9"></polyline>
                            <line x1="10" y1="14" x2="21" y2="3"></line>
                        </svg>
                    </button>
                </div>
                <div class="release-card-body">
                    ${item.html}
                </div>
                <div class="release-card-footer">
                    <div class="btn-select-indicator">
                        <span class="selected-check">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                        </span>
                        <span>${isSelected ? 'Selected' : 'Select to Tweet'}</span>
                    </div>
                </div>
            `;
            
            // Event Listeners on Card
            card.addEventListener('click', (e) => {
                // If clicked on anchor button, don't trigger selection
                if (e.target.closest('.release-anchor-btn')) {
                    const docUrl = e.target.closest('.release-anchor-btn').getAttribute('data-link');
                    window.open(docUrl, '_blank');
                    return;
                }
                selectReleaseItem(item);
            });
            
            // Accessible Keyboard selection
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    selectReleaseItem(item);
                }
            });
            
            feedList.appendChild(card);
        });
    }

    // Select specific release note
    function selectReleaseItem(item, focusTextarea = true) {
        state.selectedRelease = item;
        
        // Update Feed selection visual class
        document.querySelectorAll('.release-card').forEach(card => {
            if (card.getAttribute('data-id') === item.id) {
                card.classList.add('selected');
                const indicatorText = card.querySelector('.btn-select-indicator span:last-child');
                if (indicatorText) indicatorText.textContent = 'Selected';
            } else {
                card.classList.remove('selected');
                const indicatorText = card.querySelector('.btn-select-indicator span:last-child');
                if (indicatorText) indicatorText.textContent = 'Select to Tweet';
            }
        });

        // Activate Composer
        composerEmptyState.classList.add('hidden');
        composerActiveState.classList.remove('hidden');
        
        // Update Composer details
        selectedTypeBadge.className = `badge ${item.type.toLowerCase()}`;
        selectedTypeBadge.textContent = item.type;
        selectedDateLabel.textContent = item.date;
        
        // Generate Default Tweet Content
        const tweetText = generateDefaultTweet(item);
        tweetTextarea.value = tweetText;
        
        updateTweetCharCounter();
        
        if (focusTextarea) {
            tweetTextarea.focus();
        }
    }

    // Generate Default Tweet Text with smart length considerations
    function generateDefaultTweet(item) {
        const header = `Google Cloud #BigQuery ${item.type} update (${item.date}):\n\n`;
        const footer = `\n\nRead more: ${item.link}`;
        
        // Calculate remaining room for the description
        // URL is counted as 23 characters on Twitter regardless of size
        const urlCost = 23;
        // Construct visual length estimation
        const baseConstText = header + `\n\nRead more: `;
        const totalStaticCost = baseConstText.length + urlCost;
        const availableDescChars = 280 - totalStaticCost - 5; // buffer
        
        let desc = item.text;
        
        // Smart Truncation: Cut cleanly at words
        if (desc.length > availableDescChars) {
            desc = desc.substring(0, availableDescChars);
            const lastSpace = desc.lastIndexOf(' ');
            if (lastSpace > 0) {
                desc = desc.substring(0, lastSpace);
            }
            desc += '...';
        }
        
        return `${header}${desc}${footer}`;
    }

    // Twitter-compliant character counter
    function updateTweetCharCounter() {
        const text = tweetTextarea.value;
        const len = getTwitterLength(text);
        
        charCounter.textContent = `${len} / 280`;
        
        // Calculate progress percentage
        const pct = Math.min((len / 280) * 100, 100);
        charProgressBar.style.width = `${pct}%`;
        
        // Visual warning updates
        charCounter.className = 'char-counter';
        charProgressBar.className = 'progress-bar';
        btnSendTweet.disabled = false;
        
        if (len > 280) {
            charCounter.classList.add('danger');
            charProgressBar.classList.add('danger');
            btnSendTweet.disabled = true; // Block tweeting if too long
        } else if (len > 250) {
            charCounter.classList.add('warning');
            charProgressBar.classList.add('warning');
        }
    }

    // Accurate URL counting for Twitter (each URL is 23 chars)
    function getTwitterLength(text) {
        // Regex to identify HTTP/HTTPS links
        const urlRegex = /https?:\/\/[^\s]+/g;
        let len = text.length;
        const matches = text.match(urlRegex);
        
        if (matches) {
            matches.forEach(match => {
                len = len - match.length + 23;
            });
        }
        return len;
    }

    // Toast Banner System
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        // Choose toast icon
        let iconHtml = '';
        if (type === 'success') {
            iconHtml = `
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            `;
        } else if (type === 'error') {
            iconHtml = `
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
            `;
        } else {
            iconHtml = `
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
            `;
        }
        
        toast.innerHTML = `
            ${iconHtml}
            <span class="toast-message">${message}</span>
        `;
        
        toastContainer.appendChild(toast);
        
        // Auto remove toast
        setTimeout(() => {
            toast.classList.add('toast-fade-out');
            toast.addEventListener('animationend', () => {
                toast.remove();
            });
        }, 4000);
    }

    // Render Error state for feed
    function renderErrorState(message) {
        feedList.innerHTML = `
            <div class="empty-feed">
                <div class="empty-feed-icon">⚠️</div>
                <h3>Failed to load release notes</h3>
                <p>${message}</p>
                <button onclick="window.location.reload()" class="btn-secondary" style="margin-top: 15px; display: inline-flex;">Retry</button>
            </div>
        `;
        feedResultsCount.textContent = 'Error loading feed';
    }
});
