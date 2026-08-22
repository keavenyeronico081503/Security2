// Dashboard JavaScript functionality
document.addEventListener('DOMContentLoaded', function() {
    // Initialize dashboard
    initializeDashboard();
    
    // Add smooth animations to stat cards
    animateStatCards();
    
    // Add hover effects to action buttons
    addActionButtonEffects();
});

function initializeDashboard() {
    // Load user data if available
    loadUserData();
    
    // Load team statistics
    loadTeamStats();
    
    // Add loading states
    addLoadingStates();
}

function loadUserData() {
    // Get username from session or localStorage
    const username = getUsername();
    if (username) {
        const usernameElement = document.getElementById('username');
        if (usernameElement) {
            usernameElement.textContent = username;
        }
    }
}

function getUsername() {
    // Try to get from URL parameters first
    const urlParams = new URLSearchParams(window.location.search);
    const username = urlParams.get('username');
    if (username) {
        return decodeURIComponent(username);
    }
    
    // Try to get from localStorage
    const storedUsername = localStorage.getItem('username');
    if (storedUsername) {
        return storedUsername;
    }
    
    // Default fallback
    return 'Coach John';
}

function loadTeamStats() {
    // Simulate loading team statistics
    const stats = {
        totalPlayers: 12,
        activePlayers: 10,
        injuredPlayers: 2,
        teamRanking: 3,
        winRate: 75.5
    };
    
    // Update stat numbers with animation
    updateStatNumber('total-players', stats.totalPlayers);
    updateStatNumber('active-players', stats.activePlayers);
    updateStatNumber('injured-players', stats.injuredPlayers);
    updateStatNumber('team-ranking', '#' + stats.teamRanking);
    updateStatNumber('win-rate', stats.winRate + '%');
}

function updateStatNumber(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value;
        element.style.animation = 'countUp 0.6s ease-out';
    }
}

function addLoadingStates() {
    // Add loading class to stat cards initially
    const statCards = document.querySelectorAll('.stat-card');
    statCards.forEach(card => {
        card.classList.add('loading');
    });
    
    // Remove loading class after a short delay
    setTimeout(() => {
        statCards.forEach(card => {
            card.classList.remove('loading');
        });
    }, 1000);
}

function animateStatCards() {
    const statCards = document.querySelectorAll('.stat-card');
    
    statCards.forEach((card, index) => {
        // Add staggered animation delay
        card.style.animationDelay = `${index * 0.1}s`;
        card.style.animation = 'countUp 0.6s ease-out forwards';
    });
}

function addActionButtonEffects() {
    const actionButtons = document.querySelectorAll('.action-btn');
    
    actionButtons.forEach(button => {
        button.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-3px) scale(1.02)';
        });
        
        button.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });
}

// Logout functionality
function logout() {
    // Show confirmation dialog
    if (confirm('Are you sure you want to logout?')) {
        // Clear any stored data
        localStorage.removeItem('username');
        localStorage.removeItem('userSession');
        try { localStorage.removeItem('userLoggedIn'); } catch (_) {}
        
        // Show loading state
        showLogoutLoading();
        
        // Redirect to login page after a short delay
        setTimeout(() => {
            window.location.href = '../html/login.html';
        }, 1500);
    }
}

function showLogoutLoading() {
    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.textContent = 'Logging out...';
        logoutBtn.disabled = true;
        logoutBtn.style.opacity = '0.7';
    }
}

// Quick action functions
function viewPlayers() {
    showNotification('View Players feature coming soon!', 'info');
}

function viewSchedule() {
    showNotification('View Schedule feature coming soon!', 'info');
}

function viewStats() {
    showNotification('View Statistics feature coming soon!', 'info');
}

function viewSettings() {
    showNotification('Settings feature coming soon!', 'info');
}

// Notification system
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Style the notification
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'info' ? '#2196F3' : type === 'success' ? '#4CAF50' : '#f44336'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.2);
        z-index: 10000;
        font-weight: 500;
        transform: translateX(100%);
        transition: transform 0.3s ease;
    `;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Add keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Ctrl + L for logout
    if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        logout();
    }
    
    // Escape key to close any modals (if implemented later)
    if (e.key === 'Escape') {
        // Close any open modals or notifications
        const notifications = document.querySelectorAll('.notification');
        notifications.forEach(notification => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        });
    }
});

// Add responsive behavior
function handleResize() {
    const isMobile = window.innerWidth <= 768;
    const headerContent = document.querySelector('.header-content');
    
    if (isMobile && headerContent) {
        headerContent.style.flexDirection = 'column';
    } else if (headerContent) {
        headerContent.style.flexDirection = 'row';
    }
}

// Listen for window resize
window.addEventListener('resize', handleResize);

// Initialize responsive behavior
handleResize();

// Add smooth scrolling for any anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Add page visibility API for better UX
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        // Page is hidden, pause any animations or timers
        console.log('Dashboard hidden');
    } else {
        // Page is visible, resume animations
        console.log('Dashboard visible');
    }
});

